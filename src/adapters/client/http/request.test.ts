import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { findAppError } from "@/errors/app-error";
import { ErrorKind } from "@/errors/error-kind";

import { request } from "./request";

const schema = z.object({ ok: z.boolean() });

function stubFetch(status: number, body: unknown): ReturnType<typeof vi.fn<typeof fetch>> {
  const fetchImpl = vi.fn<typeof fetch>(async () => new Response(JSON.stringify(body), { status }));

  vi.stubGlobal("fetch", fetchImpl);

  return fetchImpl;
}

async function kindOf(run: () => Promise<unknown>): Promise<string | undefined> {
  try {
    await run();
  } catch (error) {
    return findAppError(error)?.kind;
  }

  return undefined;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("request", () => {
  // ----- 正常系 -----
  it("検証を通った応答を返す", async () => {
    stubFetch(200, { ok: true });

    await expect(request("/api/ping", schema)).resolves.toEqual({ ok: true });
  });

  it("打ち切りの signal をそのまま渡す", async () => {
    const fetchImpl = stubFetch(200, { ok: true });
    const signal = new AbortController().signal;

    await request("/api/ping", schema, signal);

    expect(fetchImpl.mock.calls[0]?.[1]).toMatchObject({ signal });
  });

  // ----- 異常系 -----
  it("予算を超えた要求を、送らずに uri-too-long で落とす", async () => {
    const fetchImpl = stubFetch(200, { ok: true });

    expect(await kindOf(() => request(`/api/ping?keyword=${"x".repeat(8_000)}`, schema))).toBe(
      ErrorKind.URI_TOO_LONG,
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("中継が返した 414 を uri-too-long へ写す", async () => {
    stubFetch(414, {});

    expect(await kindOf(() => request("/api/ping", schema))).toBe(ErrorKind.URI_TOO_LONG);
  });

  it("400 を invalid-argument へ写す", async () => {
    stubFetch(400, {});

    expect(await kindOf(() => request("/api/ping", schema))).toBe(ErrorKind.INVALID_ARGUMENT);
  });

  it("401 を unauthenticated へ写し、内部の失敗へ畳まない", async () => {
    stubFetch(401, {});

    expect(await kindOf(() => request("/api/ping", schema))).toBe(ErrorKind.UNAUTHENTICATED);
  });

  it("分類の定まらない status を internal へ畳む", async () => {
    stubFetch(503, {});

    expect(await kindOf(() => request("/api/ping", schema))).toBe(ErrorKind.INTERNAL);
  });

  it("契約と違う応答を internal として落とす", async () => {
    stubFetch(200, { ok: "yes" });

    expect(await kindOf(() => request("/api/ping", schema))).toBe(ErrorKind.INTERNAL);
  });
});
