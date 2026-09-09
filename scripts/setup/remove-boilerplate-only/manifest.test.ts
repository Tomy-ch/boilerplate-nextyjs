import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { listFilesRecursive, readUtf8File, toRelativePath } from "../lib/file-utils";
import { stripMarkers } from "../lib/markers";
import { ROOT_DIR } from "../lib/runtime";
import {
  BINARY_EXTENSIONS,
  BOILERPLATE_ONLY_MARKER,
  EXCLUDED_DIRECTORIES,
  EXCLUDED_PATH_PREFIXES,
  SELF_DESTRUCT_PATHS,
} from "./manifest";
import { isStripTarget } from "./strip-target";

const exists = (relativePath: string): boolean => fs.existsSync(path.join(ROOT_DIR, relativePath));

const isDirectory = (relativePath: string): boolean =>
  exists(relativePath) && fs.statSync(path.join(ROOT_DIR, relativePath)).isDirectory();

/** 剥がしが走査するのと同じ範囲のファイル。判定は本番と同じものを通す。 */
function scanTargets(): string[] {
  return listFilesRecursive(ROOT_DIR, { excludedDirectories: EXCLUDED_DIRECTORIES })
    .map((filePath) => toRelativePath(filePath).split(path.sep).join("/"))
    .filter((relativePath) =>
      isStripTarget(relativePath, BINARY_EXTENSIONS, EXCLUDED_PATH_PREFIXES),
    );
}

// リポジトリ全体を走査するため、既定の 5 秒では足りない。全量を並列で回すと取り合いでさらに伸び、
// 走査の遅さがそのまま赤になる（`docs/testing-conventions.md`「リポジトリ全体を走査するゲート」）。
const TIMEOUT_MS = 300_000;

describe("EXCLUDED_DIRECTORIES", () => {
  // ----- 正常系 -----
  it("すべて区切りを含まないディレクトリ名である", () => {
    // 走査は `excludedDirectories.has(entry.name)` で**名前を完全一致**させる。区切りを
    // 含む要素は一度も一致せず、除外が無言で効かないまま走査が生成物の配下へ降りる。
    expect([...EXCLUDED_DIRECTORIES].filter((name) => name.includes("/"))).toEqual([]);
  });
});

describe("EXCLUDED_PATH_PREFIXES", () => {
  // ----- 正常系 -----
  it("すべて区切りで終わる", () => {
    expect(EXCLUDED_PATH_PREFIXES.filter((prefix) => !prefix.endsWith("/"))).toEqual([]);
  });

  it("外した区画を自消滅でも消す", () => {
    const uncovered = EXCLUDED_PATH_PREFIXES.filter(
      (prefix) => !SELF_DESTRUCT_PATHS.includes(prefix.replace(/\/$/, "")),
    );

    expect(uncovered).toEqual([]);
  });
});

describe("SELF_DESTRUCT_PATHS", () => {
  // ----- 正常系 -----
  it("宣言したパスがすべて実在する", () => {
    expect(SELF_DESTRUCT_PATHS.filter((target) => !exists(target))).toEqual([]);
  });

  it("剥がしの道具自身を含む", () => {
    expect(SELF_DESTRUCT_PATHS).toContain("scripts/setup/remove-boilerplate-only");
  });

  it("剥がしを起動する CI をすべて含む", () => {
    const workflows = listFilesRecursive(path.join(ROOT_DIR, ".github/workflows"))
      .map((filePath) => toRelativePath(filePath).split(path.sep).join("/"))
      .filter((relativePath) => relativePath.endsWith(".yaml"));
    const runners = workflows.filter((relativePath) =>
      readUtf8File(path.join(ROOT_DIR, relativePath))?.includes(
        "scripts/setup/remove-boilerplate-only",
      ),
    );

    expect(runners.filter((runner) => !SELF_DESTRUCT_PATHS.includes(runner))).toEqual([]);
  });

  // 見るのはリテラルの言及だけで、TypeScript の import グラフは辿らない。捕まえたいのは
  // 「`pnpm exec tsx scripts/<区画>` で起動される区画」であり、その起動は Makefile か workflow の
  // 文字列として必ず現れる。相対 import しか経路を持たない区画は、この検査には載らない。
  it(
    "消える検査だけが呼ぶ scripts の区画を、道具ごと消す",
    () => {
      const covered = (relativePath: string): boolean =>
        SELF_DESTRUCT_PATHS.some(
          (target) => relativePath === target || relativePath.startsWith(`${target}/`),
        );
      const referrers = new Map<string, string[]>();

      for (const relativePath of scanTargets()) {
        for (const [, area] of (readUtf8File(path.join(ROOT_DIR, relativePath)) ?? "").matchAll(
          /scripts\/([a-z0-9][a-z0-9-]*)/g,
        )) {
          const key = `scripts/${area}`;

          // 区画そのものと、その中からの言及は数えない。中だけで閉じた参照は「誰が要るか」を
          // 答えないので、これを数えると消してよい区画が消せなくなる。
          if (relativePath.startsWith(`${key}/`) || !isDirectory(key)) {
            continue;
          }

          referrers.set(key, [...(referrers.get(key) ?? []), relativePath]);
        }
      }

      expect(
        [...referrers]
          .filter(([area, from]) => !covered(area) && from.every(covered))
          .map(([area]) => area),
      ).toEqual([]);
    },
    TIMEOUT_MS,
  );

  it("共有機構は消さない", () => {
    const shared = "scripts/setup/lib/markers.ts";

    expect(SELF_DESTRUCT_PATHS.some((target) => shared.startsWith(target))).toBe(false);
  });
});

describe("BOILERPLATE_ONLY_MARKER", () => {
  // ----- 正常系 -----
  // サンプル側の定数を import せず literal で持つ。`remove-sample/` はサンプル破棄で消えるため、
  // テンプレートから作って破棄を先に走らせた側でこのテストが解決不能な import で落ちる。
  it("サンプル破棄とは別の族を指す", () => {
    expect(BOILERPLATE_ONLY_MARKER).not.toBe("sample");
  });

  it(
    "リポジトリ全体でマーカーの対応が取れている",
    () => {
      const broken = scanTargets().filter((relativePath) => {
        const content = readUtf8File(path.join(ROOT_DIR, relativePath));

        if (content === null) {
          return false;
        }

        try {
          stripMarkers(content, BOILERPLATE_ONLY_MARKER);

          return false;
        } catch {
          return true;
        }
      });

      expect(broken).toEqual([]);
    },
    TIMEOUT_MS,
  );
});
