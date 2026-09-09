// 対応表が指す文書の実在を見るゲート。
//
// 表の**不完全さは欠陥ではない** —— エントリの無いパスは何も出さず、いつもの索引読解に落ちる。
// 欠陥なのは**間違ったエントリ**だけで、指し先が消えた表は、読み手に「これで足りた」と
// 判断させたうえで何も渡さない。だから見るのは実在と形だけにする。

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const REPOSITORY_ROOT = path.resolve(import.meta.dirname, "..");
const ROUTES_PATH = ".agents/doc-router/routes.conf";

type Route = {
  readonly line: number;
  readonly pattern: string;
  readonly doc: string;
  readonly why: string;
};

function parseRoutes(): readonly Route[] {
  return readFileSync(path.join(REPOSITORY_ROOT, ROUTES_PATH), "utf8")
    .split("\n")
    .flatMap((raw, index) => {
      const line = raw.trim();

      if (line === "" || line.startsWith("#")) {
        return [];
      }

      const [pattern, rest] = [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)];
      const hash = rest.indexOf("#");

      return [
        {
          line: index + 1,
          pattern: pattern.trim(),
          doc: (hash < 0 ? rest : rest.slice(0, hash)).trim(),
          why: hash < 0 ? "" : rest.slice(hash + 1).trim(),
        },
      ];
    });
}

describe("doc-router の対応表", () => {
  const routes = parseRoutes();

  // ----- 正常系 -----
  it("エントリを 1 件以上持つ", () => {
    expect(routes.length).toBeGreaterThan(0);
  });

  it("指し先の文書がすべて実在する", () => {
    const missing = routes.filter((route) => !existsSync(path.join(REPOSITORY_ROOT, route.doc)));

    expect(missing.map((route) => `${ROUTES_PATH}:${route.line} → ${route.doc}`)).toEqual([]);
  });

  it("エントリごとに、なぜその文書かを持つ", () => {
    const bare = routes.filter((route) => route.why === "");

    expect(bare.map((route) => `${ROUTES_PATH}:${route.line} → ${route.pattern}`)).toEqual([]);
  });

  // ----- 異常系 -----
  it("最近接の README を行き先にしない", () => {
    // 上へ辿れば導出できるものを表に書くと、表と木の 2 つが同じ問いに答え、片方だけが古くなる。
    const nearest = routes.filter(
      (route) => route.doc.startsWith("src/") && route.doc.endsWith("README.md"),
    );

    expect(nearest.map((route) => `${ROUTES_PATH}:${route.line}`)).toEqual([]);
  });

  it("同じ glob を 2 度宣言しない", () => {
    const seen = new Map<string, number>();
    const duplicated: string[] = [];

    for (const route of routes) {
      const key = `${route.pattern} = ${route.doc}`;

      if (seen.has(key)) {
        duplicated.push(`${ROUTES_PATH}:${route.line} と :${seen.get(key)}`);
      }

      seen.set(key, route.line);
    }

    expect(duplicated).toEqual([]);
  });
});
