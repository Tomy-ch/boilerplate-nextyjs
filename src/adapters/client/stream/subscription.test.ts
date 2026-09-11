// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import * as z from "zod/mini";

import { createAppError } from "@/errors/app-error";
import { ErrorKind } from "@/errors/error-kind";

import { toStreamCursor } from "./cursor";
import {
  openStream,
  STREAM_STOP_REASON,
  type StreamConnection,
  type StreamDeps,
  type StreamSourceHandlers,
  type StreamState,
} from "./subscription";

const TICKET_PATH = "/api/inquiries/me/stream-ticket";

const STREAM_URL = "https://api.example.test/v1/streams/s1?ticket=raw";

const schema = z.object({
  type: z.literal("message.created"),
  payload: z.object({ id: z.string() }),
});

type Event = z.infer<typeof schema>;

function envelope(sequence: number, type = "message.created"): string {
  return JSON.stringify({
    eventId: `e${sequence}`,
    streamId: "s1",
    sequence: String(sequence),
    type,
    occurredAt: "2026-09-01T12:00:00Z",
    schemaVersion: 1,
    payload: { id: `m${sequence}` },
  });
}

function control(action: string, retryAfterMs?: number): string {
  return JSON.stringify({ action, reason: "SERVER_DRAINING", retryAfterMs });
}

/** 時計・乱数・待機・接続を手元で進められる購読を組み立てる。 */
function harness(
  options: {
    readonly cursor?: number | null;
    readonly connection?: () => Promise<StreamConnection>;
    readonly hidden?: boolean;
  } = {},
) {
  const timers = new Map<number, { readonly run: () => void; readonly delayMs: number }>();
  const sources: { url: string; handlers: StreamSourceHandlers; closed: boolean }[] = [];
  const states: StreamState[] = [];
  const received: Event[][] = [];

  let nextTimerId = 1;
  let hidden = options.hidden ?? false;
  let resyncs = 0;
  let visible: (() => void) | null = null;

  const requestConnection = vi.fn<StreamDeps["requestConnection"]>(
    options.connection ?? (async () => ({ url: STREAM_URL, expiresAt: 10_000 })),
  );

  const subscription = openStream<Event>({
    ticketPath: TICKET_PATH,
    cursor: options.cursor === null ? null : toStreamCursor(options.cursor ?? 0),
    schema,
    onEvents: (events) => received.push([...events]),
    onState: (state) => states.push(state),
    onResync: () => {
      resyncs += 1;
    },
    deps: {
      requestConnection,
      createSource: (url, handlers) => {
        const source = { url, handlers, closed: false };

        sources.push(source);

        return {
          close: () => {
            source.closed = true;
          },
        };
      },
      setTimer: (run, delayMs) => {
        const id = nextTimerId;

        nextTimerId += 1;
        timers.set(id, { run, delayMs });

        return () => {
          timers.delete(id);
        };
      },
      random: () => 0.5,
      now: () => 0,
      isHidden: () => hidden,
      onVisible: (listener) => {
        visible = listener;

        return () => {
          visible = null;
        };
      },
    },
  });

  return {
    subscription,
    requestConnection,
    sources,
    states,
    received,
    resyncs: () => resyncs,
    latest: () => sources.at(-1),
    /** 溜まっている待機を 1 つ進める。待機が無ければ何もしない。 */
    runTimers: () => {
      for (const [id, timer] of [...timers]) {
        timers.delete(id);
        timer.run();
      }
    },
    delays: () => [...timers.values()].map((timer) => timer.delayMs),
    show: () => {
      hidden = false;
      visible?.();
    },
  };
}

/** 発券の往復（microtask）を消化する。 */
async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("openStream", () => {
  // ----- 接続 -----
  it("開始位置を載せて繋ぐ", async () => {
    const stream = harness({ cursor: 4 });

    await settle();

    expect(stream.latest()?.url).toContain("after=4");
  });

  it("開始位置を持たないときは、発券が束ねた位置から始める", async () => {
    const stream = harness({ cursor: null });

    await settle();

    expect(stream.latest()?.url).not.toContain("after=");
  });

  it("繋がったことを状態として伝える", async () => {
    const stream = harness();

    await settle();
    stream.latest()?.handlers.onOpen();

    expect(stream.states.at(-1)).toEqual({ kind: "open" });
  });

  // ----- 受信 -----
  it("窓を閉じてから、整列した event を流す", async () => {
    const stream = harness();

    await settle();
    stream.latest()?.handlers.onOpen();
    stream.latest()?.handlers.onEvent(envelope(2));
    stream.latest()?.handlers.onEvent(envelope(1));

    expect(stream.received).toEqual([]);

    stream.runTimers();

    expect(stream.received.at(0)?.map((event) => event.payload.id)).toEqual(["m1", "m2"]);
  });

  it("取り直しで窓を捨てた後に窓が閉じても、上へは何も流れない", async () => {
    const stream = harness({ cursor: 5 });

    await settle();
    stream.latest()?.handlers.onOpen();
    // 窓へ 1 件入れて閉じる時刻を仕掛けたあと、遅れて届いた event で取り直しへ入る。
    stream.latest()?.handlers.onEvent(envelope(6));
    stream.latest()?.handlers.onEvent(envelope(3));
    stream.subscription.resume(toStreamCursor(9));
    stream.runTimers();

    expect(stream.received).toEqual([]);
  });

  it("契約に無い種別の event を上へ流さない", async () => {
    const stream = harness();

    await settle();
    stream.latest()?.handlers.onOpen();
    stream.latest()?.handlers.onEvent(envelope(1, "message.unknown"));
    stream.runTimers();

    expect(stream.received).toEqual([]);
  });

  it("封筒として読めない本文で購読を止めない", async () => {
    const stream = harness();

    await settle();
    stream.latest()?.handlers.onOpen();
    stream.latest()?.handlers.onEvent("{");
    stream.latest()?.handlers.onEvent(envelope(1));
    stream.runTimers();

    expect(stream.received.at(0)?.map((event) => event.payload.id)).toEqual(["m1"]);
  });

  // ----- 取り直し -----
  it("窓を越えて遅れた event を見つけたら、正本の取り直しを求める", async () => {
    const stream = harness({ cursor: 5 });

    await settle();
    stream.latest()?.handlers.onOpen();
    stream.latest()?.handlers.onEvent(envelope(3));

    expect(stream.resyncs()).toBe(1);
    expect(stream.latest()?.closed).toBe(true);
  });

  it("取り直しを待つあいだは張り直さない", async () => {
    const stream = harness({ cursor: 5 });

    await settle();
    stream.latest()?.handlers.onOpen();
    stream.latest()?.handlers.onEvent(envelope(3));
    stream.runTimers();
    await settle();

    expect(stream.sources).toHaveLength(1);
  });

  it("取り直した位置で張り直す", async () => {
    const stream = harness({ cursor: 5 });

    await settle();
    stream.latest()?.handlers.onOpen();
    stream.latest()?.handlers.onEvent(envelope(3));
    stream.subscription.resume(toStreamCursor(9));
    await settle();

    expect(stream.sources).toHaveLength(2);
    expect(stream.latest()?.url).toContain("after=9");
  });

  // ----- 張り直し -----
  it("繋がる前に落ちたら、発券からやり直す", async () => {
    const stream = harness();

    await settle();
    stream.latest()?.handlers.onError();
    stream.runTimers();
    await settle();

    expect(stream.requestConnection).toHaveBeenCalledTimes(2);
  });

  it("繋がった後に落ちたら、期限の内側は同じ発券で張り直す", async () => {
    const stream = harness();

    await settle();
    stream.latest()?.handlers.onOpen();
    stream.latest()?.handlers.onError();
    stream.runTimers();
    await settle();

    expect(stream.requestConnection).toHaveBeenCalledTimes(1);
    expect(stream.sources).toHaveLength(2);
  });

  it("期限の切れた発券では繋がず、取り直す", async () => {
    const stream = harness({ connection: async () => ({ url: STREAM_URL, expiresAt: -1 }) });

    await settle();
    stream.latest()?.handlers.onOpen();
    stream.latest()?.handlers.onError();
    stream.runTimers();
    await settle();

    expect(stream.requestConnection).toHaveBeenCalledTimes(2);
  });

  it("流し終えた位置から張り直す", async () => {
    const stream = harness();

    await settle();
    stream.latest()?.handlers.onOpen();
    stream.latest()?.handlers.onEvent(envelope(7));
    stream.runTimers();
    stream.latest()?.handlers.onError();
    stream.runTimers();
    await settle();

    expect(stream.latest()?.url).toContain("after=7");
  });

  // ----- 打ち切り -----
  it("発券が unauthenticated なら打ち切る", async () => {
    const stream = harness({
      connection: () => Promise.reject(createAppError(ErrorKind.UNAUTHENTICATED)),
    });

    await settle();

    expect(stream.states.at(-1)).toEqual({
      kind: "stopped",
      reason: STREAM_STOP_REASON.unauthenticated,
    });
  });

  it("発券が permission-denied なら打ち切る", async () => {
    const stream = harness({
      connection: () => Promise.reject(createAppError(ErrorKind.PERMISSION_DENIED)),
    });

    await settle();

    expect(stream.states.at(-1)).toEqual({
      kind: "stopped",
      reason: STREAM_STOP_REASON.permissionDenied,
    });
  });

  it("購読する対象が無いなら打ち切る", async () => {
    const stream = harness({
      connection: () => Promise.reject(createAppError(ErrorKind.NOT_FOUND)),
    });

    await settle();

    expect(stream.states.at(-1)).toEqual({
      kind: "stopped",
      reason: STREAM_STOP_REASON.absent,
    });
  });

  it("打ち切った後は張り直さない", async () => {
    const stream = harness({
      connection: () => Promise.reject(createAppError(ErrorKind.UNAUTHENTICATED)),
    });

    await settle();
    stream.runTimers();
    await settle();

    expect(stream.requestConnection).toHaveBeenCalledTimes(1);
  });

  it("発券が落ちただけなら、間を置いて張り直す", async () => {
    const stream = harness({
      connection: () => Promise.reject(createAppError(ErrorKind.UNAVAILABLE)),
    });

    await settle();

    expect(stream.states.at(-1)).toEqual({ kind: "reconnecting" });
    expect(stream.delays()).toHaveLength(1);
  });

  // ----- 制御指示 -----
  it("打ち切りの指示で、自分から閉じて止まる", async () => {
    const stream = harness();

    await settle();
    stream.latest()?.handlers.onOpen();
    stream.latest()?.handlers.onControl(control("STOP"));

    expect(stream.latest()?.closed).toBe(true);
    expect(stream.states.at(-1)).toEqual({
      kind: "stopped",
      reason: STREAM_STOP_REASON.server,
    });
  });

  it("再同期の指示で、正本の取り直しを求める", async () => {
    const stream = harness();

    await settle();
    stream.latest()?.handlers.onOpen();
    stream.latest()?.handlers.onControl(control("RESYNC"));

    expect(stream.resyncs()).toBe(1);
    expect(stream.latest()?.closed).toBe(true);
  });

  it("再認証の指示で、発券からやり直す", async () => {
    const stream = harness();

    await settle();
    stream.latest()?.handlers.onOpen();
    stream.latest()?.handlers.onControl(control("REAUTHENTICATE"));
    stream.runTimers();
    await settle();

    expect(stream.requestConnection).toHaveBeenCalledTimes(2);
  });

  it("再接続の指示で、同じ発券のまま張り直す", async () => {
    const stream = harness();

    await settle();
    stream.latest()?.handlers.onOpen();
    stream.latest()?.handlers.onControl(control("RECONNECT"));
    stream.runTimers();
    await settle();

    expect(stream.requestConnection).toHaveBeenCalledTimes(1);
    expect(stream.sources).toHaveLength(2);
  });

  it("待ってからの再接続の指示で、示された目安を散らして待つ", async () => {
    const stream = harness();

    await settle();
    stream.latest()?.handlers.onOpen();
    stream.latest()?.handlers.onControl(control("RETRY_LATER", 4_000));

    // 目安にも散らしを掛ける。同じ値が全 client へ配られるため、そのまま待つと山が崩れない。
    expect(stream.delays()).toEqual([3_000]);
  });

  it("読めない制御指示を無視する", async () => {
    const stream = harness();

    await settle();
    stream.latest()?.handlers.onOpen();
    stream.latest()?.handlers.onControl("{");

    expect(stream.latest()?.closed).toBe(false);
  });

  // ----- 画面の可視性 -----
  it("画面が見えていないあいだは繋がない", async () => {
    const stream = harness({ hidden: true });

    await settle();

    expect(stream.requestConnection).not.toHaveBeenCalled();
  });

  it("見えたら繋ぐ", async () => {
    const stream = harness({ hidden: true });

    await settle();
    stream.show();
    await settle();

    expect(stream.requestConnection).toHaveBeenCalledTimes(1);
  });

  // ----- 後片付け -----
  it("閉じたら接続も閉じる", async () => {
    const stream = harness();

    await settle();
    stream.subscription.close();

    expect(stream.latest()?.closed).toBe(true);
  });

  it("閉じた後は状態も event も流れない", async () => {
    const stream = harness();

    await settle();
    stream.latest()?.handlers.onOpen();

    const source = stream.latest();

    stream.subscription.close();
    source?.handlers.onEvent(envelope(1));
    stream.runTimers();

    const statesAfterClose = stream.states.length;

    source?.handlers.onOpen();

    expect(stream.received).toEqual([]);
    expect(stream.states).toHaveLength(statesAfterClose);
  });

  it("閉じた後に届いた遅延では、取り直しを求めない", async () => {
    const stream = harness({ cursor: 5 });

    await settle();
    stream.latest()?.handlers.onOpen();

    const source = stream.latest();

    stream.subscription.close();
    source?.handlers.onEvent(envelope(3));

    expect(stream.resyncs()).toBe(0);
  });

  it("閉じた後に接続が落ちても、張り直しを仕掛けない", async () => {
    const stream = harness();

    await settle();

    const source = stream.latest();

    stream.subscription.close();
    source?.handlers.onError();

    expect(stream.delays()).toEqual([]);
  });

  it("打ち切った後は、待機が明けても繋ぎにいかない", async () => {
    const stream = harness({
      connection: () => Promise.reject(createAppError(ErrorKind.PERMISSION_DENIED)),
    });

    await settle();
    stream.runTimers();
    await settle();

    expect(stream.sources).toHaveLength(0);
  });

  it("閉じた後の再開を受け付けない", async () => {
    const stream = harness();

    await settle();
    stream.subscription.close();
    stream.subscription.resume(toStreamCursor(3));
    await settle();

    expect(stream.sources).toHaveLength(1);
  });
});

/** ブラウザの `EventSource` の代わり。組み立てと登録された listener だけを覚える。 */
class FakeEventSource {
  static instances: FakeEventSource[] = [];

  readonly listeners = new Map<string, ((event: Event) => void)[]>();

  closed = false;

  constructor(readonly url: string) {
    FakeEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: (event: Event) => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  close(): void {
    this.closed = true;
  }

  emit(type: string, event: Event): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }
}

/** 発券の中継が返す応答。 */
function ticketResponse(): Response {
  return new Response(JSON.stringify({ url: STREAM_URL, expiresAt: "2100-01-01T00:00:00.000Z" }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.restoreAllMocks();
  FakeEventSource.instances = [];
});

describe("openStream（既定の道具）", () => {
  /** 道具を差し替えずに購読を開く。ブラウザ側の既定がそのまま動く。 */
  function openWithBrowserDefaults(onEvents: (events: readonly Event[]) => void = () => undefined) {
    return openStream<Event>({
      ticketPath: TICKET_PATH,
      cursor: toStreamCursor(4),
      schema,
      onEvents,
      onState: () => undefined,
      onResync: () => undefined,
    });
  }

  it("発券の中継を POST で叩き、返った URL へ開始位置を載せて繋ぐ", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => ticketResponse());

    vi.stubGlobal("fetch", fetchImpl);
    vi.stubGlobal("EventSource", FakeEventSource);

    const subscription = openWithBrowserDefaults();

    await settle();

    expect(fetchImpl.mock.calls[0]?.[0]).toBe(TICKET_PATH);
    expect(fetchImpl.mock.calls[0]?.[1]).toMatchObject({ method: "POST" });
    expect(FakeEventSource.instances[0]?.url).toContain("after=4");

    subscription.close();
  });

  it("届いた本文を整列して上へ流す", async () => {
    vi.stubGlobal("fetch", async () => ticketResponse());
    vi.stubGlobal("EventSource", FakeEventSource);

    const received: Event[][] = [];
    const subscription = openWithBrowserDefaults((events) => received.push([...events]));

    await settle();

    const source = FakeEventSource.instances[0];

    source?.emit("open", new Event("open"));
    source?.emit("message", new MessageEvent("message", { data: envelope(5) }));

    await new Promise((resolve) => setTimeout(resolve, 300));

    expect(received.at(0)).toHaveLength(1);

    subscription.close();
  });

  it("本文を持たない event を上へ流さない", async () => {
    vi.stubGlobal("fetch", async () => ticketResponse());
    vi.stubGlobal("EventSource", FakeEventSource);

    const received: Event[][] = [];
    const subscription = openWithBrowserDefaults((events) => received.push([...events]));

    await settle();

    const source = FakeEventSource.instances[0];

    source?.emit("open", new Event("open"));
    source?.emit("message", new Event("message"));

    await new Promise((resolve) => setTimeout(resolve, 300));

    expect(received).toEqual([]);

    subscription.close();
  });

  it("制御指示を読み、打ち切りの指示で自分から閉じる", async () => {
    vi.stubGlobal("fetch", async () => ticketResponse());
    vi.stubGlobal("EventSource", FakeEventSource);

    const subscription = openWithBrowserDefaults();

    await settle();

    const source = FakeEventSource.instances[0];

    source?.emit("open", new Event("open"));
    source?.emit("control", new MessageEvent("control", { data: control("STOP") }));

    expect(source?.closed).toBe(true);

    subscription.close();
  });

  it("接続が落ちたら、その接続を閉じて張り直しへ移る", async () => {
    vi.stubGlobal("fetch", async () => ticketResponse());
    vi.stubGlobal("EventSource", FakeEventSource);

    const subscription = openWithBrowserDefaults();

    await settle();

    const source = FakeEventSource.instances[0];

    source?.emit("error", new Event("error"));

    expect(source?.closed).toBe(true);

    subscription.close();
  });

  it("画面が見えていないあいだは繋がず、見えたら繋ぐ", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => ticketResponse());

    vi.stubGlobal("fetch", fetchImpl);
    vi.stubGlobal("EventSource", FakeEventSource);

    const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    const subscription = openWithBrowserDefaults();

    await settle();

    expect(fetchImpl).not.toHaveBeenCalled();

    hidden.mockReturnValue(false);
    document.dispatchEvent(new Event("visibilitychange"));
    await settle();

    expect(fetchImpl).toHaveBeenCalledOnce();

    subscription.close();
  });

  it("見えないまま通知が来ても繋ぎにいかない", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => ticketResponse());

    vi.stubGlobal("fetch", fetchImpl);
    vi.stubGlobal("EventSource", FakeEventSource);
    vi.spyOn(document, "hidden", "get").mockReturnValue(true);

    const subscription = openWithBrowserDefaults();

    await settle();
    document.dispatchEvent(new Event("visibilitychange"));
    await settle();

    expect(fetchImpl).not.toHaveBeenCalled();

    subscription.close();
  });

  it("閉じた後は、待機も可視性の登録も残さない", async () => {
    vi.stubGlobal("fetch", async () => ticketResponse());
    vi.stubGlobal("EventSource", FakeEventSource);

    const removeEventListener = vi.spyOn(document, "removeEventListener");
    const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    const subscription = openWithBrowserDefaults();

    await settle();
    subscription.close();
    hidden.mockReturnValue(false);
    document.dispatchEvent(new Event("visibilitychange"));

    expect(removeEventListener).toHaveBeenCalledWith("visibilitychange", expect.any(Function));
  });
});
