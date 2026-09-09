import { describe, expect, it, vi } from "vitest";

import { type FetchJson, publishedAt, routeOf } from "./published";

/** URL ごとに応答を返す fetch。無い URL は 404。 */
function responding(routes: Record<string, { status?: number; body?: unknown }>): FetchJson {
  return vi.fn(async (url: string) => {
    const route = routes[url];

    return route === undefined
      ? { status: 404, body: null }
      : { status: route.status ?? 200, body: route.body ?? null };
  });
}

describe("routeOf", () => {
  // ----- 正常系 -----
  it("aqua / ubi / github は GitHub Releases の経路", () => {
    expect(routeOf("aqua:rhysd/actionlint")).toEqual({
      kind: "channel",
      channel: "github-release",
    });
    expect(routeOf("ubi:owner/repo")).toEqual({ kind: "channel", channel: "github-release" });
    expect(routeOf("github:owner/repo")).toEqual({ kind: "channel", channel: "github-release" });
  });

  it("npm / pipx / pypi は公開レジストリの経路", () => {
    expect(routeOf("npm:left-pad")).toEqual({ kind: "channel", channel: "registry" });
    expect(routeOf("pipx:graphifyy")).toEqual({ kind: "channel", channel: "registry" });
    expect(routeOf("pypi:graphifyy")).toEqual({ kind: "channel", channel: "registry" });
  });

  it("core: の言語ランタイムは、どの言語でも窓の対象外", () => {
    expect(routeOf("core:node")).toEqual({ kind: "excluded" });
    expect(routeOf("core:python")).toEqual({ kind: "excluded" });
    expect(routeOf("core:go")).toEqual({ kind: "excluded" });
  });

  // ----- 異常系 -----
  it("経路を持たない backend は none。対象外（excluded）とは別の出口", () => {
    expect(routeOf("go:github.com/x/y")).toEqual({ kind: "none" });
    expect(routeOf("cargo:ripgrep")).toEqual({ kind: "none" });
  });

  it("backend の無いキーは none。core と読まない", () => {
    expect(routeOf("node")).toEqual({ kind: "none" });
    expect(routeOf("core")).toEqual({ kind: "none" });
  });
});

describe("publishedAt", () => {
  // ----- 正常系 -----
  it("GitHub Releases は v 付きの tag の published_at を読む", async () => {
    const fetchJson = responding({
      "https://api.github.com/repos/rhysd/actionlint/releases/tags/v1.7.12": {
        body: { published_at: "2026-03-30T17:49:21Z" },
      },
    });

    await expect(
      publishedAt({ key: "aqua:rhysd/actionlint", version: "1.7.12" }, fetchJson),
    ).resolves.toEqual(new Date("2026-03-30T17:49:21Z"));
  });

  it("v 付きの tag が無ければ、版そのものの tag を試す", async () => {
    const fetchJson = responding({
      "https://api.github.com/repos/owner/repo/releases/tags/1.0.0": {
        body: { published_at: "2026-01-01T00:00:00Z" },
      },
    });

    await expect(
      publishedAt({ key: "ubi:owner/repo", version: "1.0.0" }, fetchJson),
    ).resolves.toEqual(new Date("2026-01-01T00:00:00Z"));
  });

  it("ubi の付加指定（[exe=...]）は repo 名に含めない", async () => {
    const fetchJson = responding({
      "https://api.github.com/repos/owner/repo/releases/tags/v1.0.0": {
        body: { published_at: "2026-01-01T00:00:00Z" },
      },
    });

    await expect(
      publishedAt({ key: "ubi:owner/repo[exe=tool]", version: "1.0.0" }, fetchJson),
    ).resolves.toEqual(new Date("2026-01-01T00:00:00Z"));
  });

  it("npm は time の版ごとの公開日時を読む", async () => {
    const fetchJson = responding({
      "https://registry.npmjs.org/left-pad": {
        body: { time: { "1.3.0": "2018-04-09T01:10:45.796Z" } },
      },
    });

    await expect(
      publishedAt({ key: "npm:left-pad", version: "1.3.0" }, fetchJson),
    ).resolves.toEqual(new Date("2018-04-09T01:10:45.796Z"));
  });

  it("PyPI は配布物のうち最も早い upload 時刻を読む", async () => {
    const fetchJson = responding({
      "https://pypi.org/pypi/graphifyy/0.9.25/json": {
        body: {
          urls: [
            { upload_time_iso_8601: "2026-07-22T22:57:08.071655Z" },
            { upload_time_iso_8601: "2026-07-22T22:57:06.463771Z" },
          ],
        },
      },
    });

    await expect(
      publishedAt({ key: "pipx:graphifyy[extra]", version: "0.9.25" }, fetchJson),
    ).resolves.toEqual(new Date("2026-07-22T22:57:06.463771Z"));
  });

  // ----- 異常系 -----
  it("GitHub Releases にどちらの tag も無ければ落とす", async () => {
    await expect(
      publishedAt({ key: "aqua:owner/repo", version: "9.9.9" }, responding({})),
    ).rejects.toThrow("owner/repo に release v9.9.9 / 9.9.9 がありません");
  });

  it("GitHub Releases が 404 以外で失敗したら、次の tag を試さず落とす", async () => {
    const fetchJson = responding({
      "https://api.github.com/repos/owner/repo/releases/tags/v1.0.0": { status: 403 },
      "https://api.github.com/repos/owner/repo/releases/tags/1.0.0": {
        body: { published_at: "2026-01-01T00:00:00Z" },
      },
    });

    await expect(
      publishedAt({ key: "aqua:owner/repo", version: "1.0.0" }, fetchJson),
    ).rejects.toThrow("owner/repo の release v1.0.0 の取得に失敗しました（HTTP 403）");
  });

  it("published_at を日時として読めなければ落とす", async () => {
    const fetchJson = responding({
      "https://api.github.com/repos/owner/repo/releases/tags/v1.0.0": {
        body: { published_at: null },
      },
    });

    await expect(
      publishedAt({ key: "aqua:owner/repo", version: "1.0.0" }, fetchJson),
    ).rejects.toThrow("owner/repo の release v1.0.0 の published_at を日時として読めません");
  });

  it("npm の取得に失敗したら落とす", async () => {
    await expect(
      publishedAt({ key: "npm:left-pad", version: "1.3.0" }, responding({})),
    ).rejects.toThrow("left-pad の取得に失敗しました（HTTP 404）");
  });

  it("npm の time にその版が無ければ落とす", async () => {
    const fetchJson = responding({ "https://registry.npmjs.org/left-pad": { body: {} } });

    await expect(publishedAt({ key: "npm:left-pad", version: "1.3.0" }, fetchJson)).rejects.toThrow(
      "left-pad@1.3.0 の time を日時として読めません",
    );
  });

  it("PyPI の取得に失敗したら落とす", async () => {
    await expect(
      publishedAt({ key: "pipx:graphifyy", version: "0.9.25" }, responding({})),
    ).rejects.toThrow("graphifyy@0.9.25 の取得に失敗しました（HTTP 404）");
  });

  it("PyPI に配布物が無ければ落とす。0 件は「公開日時が無い」であって「古い」ではない", async () => {
    const fetchJson = responding({ "https://pypi.org/pypi/graphifyy/0.9.25/json": { body: {} } });

    await expect(
      publishedAt({ key: "pipx:graphifyy", version: "0.9.25" }, fetchJson),
    ).rejects.toThrow("graphifyy@0.9.25 に配布物がありません");
  });

  it("窓の対象外の言語ランタイムは、問い合わせずに落とす", async () => {
    const fetchJson = responding({});

    await expect(publishedAt({ key: "core:node", version: "24.14.1" }, fetchJson)).rejects.toThrow(
      "core:node は窓の対象外で、公開日時を引きません",
    );
    expect(fetchJson).not.toHaveBeenCalled();
  });

  it("経路を持たない backend は落とす", async () => {
    await expect(
      publishedAt({ key: "go:github.com/x/y", version: "1.0.0" }, responding({})),
    ).rejects.toThrow("go:github.com/x/y の backend は公開日時を引く経路を持ちません");
  });
});
