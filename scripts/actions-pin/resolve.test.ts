import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const execFileMock = vi.hoisted(() => vi.fn());

vi.mock("node:child_process", () => ({ execFile: execFileMock }));

import {
  classifyMoves,
  isMovingTag,
  type MoveCandidate,
  refAgeDays,
  resolveSHA,
  selectSHA,
} from "./resolve";

const SHA = "9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0";
const OTHER_SHA = "bf7454d06d71f1098171f2acdf0cd4708d7b5920";
const NOW = new Date("2026-08-07T00:00:00.000Z");

/** `execFile` の callback へ標準出力を返す。 */
function respondWith(stdout: string): void {
  execFileMock.mockImplementation(
    (_command: string, _args: string[], _options: unknown, callback: unknown) => {
      (callback as (e: null, r: { stdout: string; stderr: string }) => void)(null, {
        stdout,
        stderr: "",
      });
    },
  );
}

/** URL ごとに status と body を返す fetch を差し込む。 */
function stubFetch(routes: { match: string; status: number; body?: unknown }[]): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const route = routes.find((entry) => url.includes(entry.match));

      return {
        status: route?.status ?? 500,
        json: async () => route?.body ?? {},
      };
    }),
  );
}

const candidate = (key: string, tag: string, sha: string): MoveCandidate => ({ key, tag, sha });

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  execFileMock.mockReset();
});

describe("isMovingTag", () => {
  // ----- 正常系 -----
  it("bare な major 番号を前進してよい宣言として扱う", () => {
    expect(isMovingTag("v6")).toBe(true);
    expect(isMovingTag("6")).toBe(true);
  });

  // ----- 異常系 -----
  it("patch まで書いた版を不変として扱う", () => {
    expect(isMovingTag("v6.1.0")).toBe(false);
    expect(isMovingTag("v6.1")).toBe(false);
  });

  it("ブランチ名を不変として扱う", () => {
    expect(isMovingTag("main")).toBe(false);
  });
});

describe("classifyMoves", () => {
  // ----- 正常系 -----
  it("moving tag の移動を採用してよいものへ分ける", () => {
    const report = classifyMoves(
      new Map([["actions/checkout@v7", SHA]]),
      [candidate("actions/checkout@v7", "v7", OTHER_SHA)],
      new Set(),
    );

    expect(report.accepted).toEqual([{ key: "actions/checkout@v7", from: SHA, to: OTHER_SHA }]);
    expect(report.repointed).toEqual([]);
  });

  it("明示的に許可されたキーの移動を採用してよいものへ分ける", () => {
    const report = classifyMoves(
      new Map([["actions/checkout@v7.0.0", SHA]]),
      [candidate("actions/checkout@v7.0.0", "v7.0.0", OTHER_SHA)],
      new Set(["actions/checkout@v7.0.0"]),
    );

    expect(report.accepted).toHaveLength(1);
  });

  it("記録が無いキーは移動として扱わない", () => {
    const report = classifyMoves(
      new Map(),
      [candidate("actions/checkout@v7", "v7", SHA)],
      new Set(),
    );

    expect(report).toEqual({ repointed: [], accepted: [] });
  });

  it("解決先が変わらないキーは移動として扱わない", () => {
    const report = classifyMoves(
      new Map([["actions/checkout@v7", SHA]]),
      [candidate("actions/checkout@v7", "v7", SHA)],
      new Set(),
    );

    expect(report).toEqual({ repointed: [], accepted: [] });
  });

  // ----- 異常系 -----
  it("不変を宣言した tag の移動を付け替えとして疑う", () => {
    const report = classifyMoves(
      new Map([["actions/checkout@v7.0.0", SHA]]),
      [candidate("actions/checkout@v7.0.0", "v7.0.0", OTHER_SHA)],
      new Set(),
    );

    expect(report.repointed).toEqual([
      { key: "actions/checkout@v7.0.0", from: SHA, to: OTHER_SHA },
    ]);
    expect(report.accepted).toEqual([]);
  });
});

describe("selectSHA", () => {
  // ----- 正常系 -----
  it("annotated tag の deref を最優先で採る", () => {
    const out = [`${OTHER_SHA}\trefs/tags/v7`, `${SHA}\trefs/tags/v7^{}`].join("\n");

    expect(selectSHA(out, "v7")).toBe(SHA);
  });

  it("deref が無ければ軽量 tag を採る", () => {
    expect(selectSHA(`${SHA}\trefs/tags/v7`, "v7")).toBe(SHA);
  });

  it("tag が無ければ branch head を採る", () => {
    expect(selectSHA(`${SHA}\trefs/heads/main`, "main")).toBe(SHA);
  });

  it("2 列でない行を読み飛ばす", () => {
    const out = ["余計な 行 が 3 列以上", `${SHA}\trefs/tags/v7`].join("\n");

    expect(selectSHA(out, "v7")).toBe(SHA);
  });

  // ----- 異常系 -----
  it("対応する ref が無ければ落とす", () => {
    expect(() => selectSHA(`${SHA}\trefs/tags/v6`, "v7")).toThrow('ref "v7" が見つかりません');
  });

  it("出力が空なら落とす", () => {
    expect(() => selectSHA("", "v7")).toThrow('ref "v7" が見つかりません');
  });
});

describe("resolveSHA", () => {
  // ----- 正常系 -----
  it("ls-remote の出力から SHA を解決する", async () => {
    respondWith(`${SHA}\trefs/tags/v7^{}\n`);

    await expect(resolveSHA("actions/checkout", "v7")).resolves.toBe(SHA);
  });

  it("tag をオプションとして解釈させないため --end-of-options を挟む", async () => {
    respondWith(`${SHA}\trefs/tags/-v7\n`);

    await resolveSHA("actions/checkout", "-v7");

    expect(execFileMock.mock.calls[0]?.[1]).toEqual([
      "ls-remote",
      "https://github.com/actions/checkout",
      "--end-of-options",
      "-v7",
      "-v7^{}",
    ]);
  });

  // ----- 異常系 -----
  it("対応する ref が無ければ落とす", async () => {
    respondWith("");

    await expect(resolveSHA("actions/checkout", "v7")).rejects.toThrow('ref "v7" が見つかりません');
  });
});

describe("refAgeDays", () => {
  // ----- 正常系 -----
  it("Release と commit のうち新しい方の経過日数を返す", async () => {
    stubFetch([
      { match: "/releases/tags/", status: 200, body: { published_at: "2026-07-08T00:00:00Z" } },
      {
        match: "/commits/",
        status: 200,
        body: { commit: { committer: { date: "2026-08-04T00:00:00Z" } } },
      },
    ]);

    await expect(refAgeDays("actions/checkout", "v7", SHA)).resolves.toBe(3);
  });

  it("トークンがあれば Authorization を添えて問い合わせる", async () => {
    vi.stubEnv("GITHUB_TOKEN", "token-value");
    stubFetch([
      { match: "/releases/tags/", status: 404 },
      {
        match: "/commits/",
        status: 200,
        body: { commit: { committer: { date: "2026-08-02T00:00:00Z" } } },
      },
    ]);

    await refAgeDays("actions/checkout", "v7", SHA);

    const [, init] = (globalThis.fetch as unknown as { mock: { calls: unknown[][] } }).mock
      .calls[0] as [string, { headers: Record<string, string> }];

    expect(init.headers["Authorization"]).toBe("Bearer token-value");
  });

  it("トークンが無ければ Authorization を添えない", async () => {
    vi.stubEnv("GITHUB_TOKEN", "");
    vi.stubEnv("GH_TOKEN", "");
    stubFetch([
      { match: "/releases/tags/", status: 404 },
      {
        match: "/commits/",
        status: 200,
        body: { commit: { committer: { date: "2026-08-02T00:00:00Z" } } },
      },
    ]);

    await refAgeDays("actions/checkout", "v7", SHA);

    const [, init] = (globalThis.fetch as unknown as { mock: { calls: unknown[][] } }).mock
      .calls[0] as [string, { headers: Record<string, string> }];

    expect(init.headers).not.toHaveProperty("Authorization");
  });

  it("Release が無ければ commit の日付だけで判断する", async () => {
    stubFetch([
      { match: "/releases/tags/", status: 404 },
      {
        match: "/commits/",
        status: 200,
        body: { commit: { committer: { date: "2026-08-02T00:00:00Z" } } },
      },
    ]);

    await expect(refAgeDays("actions/checkout", "v7", SHA)).resolves.toBe(5);
  });

  // ----- 異常系 -----
  it("Release の問い合わせが想定外の応答なら落とす", async () => {
    stubFetch([{ match: "/releases/tags/", status: 500 }]);

    await expect(refAgeDays("actions/checkout", "v7", SHA)).rejects.toThrow(
      /releases\/tags\/v7 status=500/,
    );
  });

  it("commit の問い合わせが想定外の応答なら落とす", async () => {
    stubFetch([
      { match: "/releases/tags/", status: 404 },
      { match: "/commits/", status: 403 },
    ]);

    await expect(refAgeDays("actions/checkout", "v7", SHA)).rejects.toThrow(
      /commits\/.* status=403/,
    );
  });

  it("commit の日付を取れなければ落とす", async () => {
    stubFetch([
      { match: "/releases/tags/", status: 404 },
      { match: "/commits/", status: 200, body: {} },
    ]);

    await expect(refAgeDays("actions/checkout", "v7", SHA)).rejects.toThrow(
      `commit ${SHA} の日付を取得できませんでした`,
    );
  });
});
