import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { ROOT_DIR } from "../lib/runtime";
import {
  assertWithinRoot,
  findMisplacedRestorations,
  findOccupiedRestorations,
  findRedundantPaths,
} from "./plan";
import {
  BINARY_EXTENSIONS,
  EXCLUDED_DIRECTORIES,
  EXCLUDED_PATH_PREFIXES,
  MARKER_LITERAL_FILES,
  SAMPLE_MARKER,
  SAMPLE_PATHS,
  SAMPLE_RESTORATIONS,
} from "./sample-manifest";

const exists = (relativePath: string): boolean => fs.existsSync(path.join(ROOT_DIR, relativePath));

describe("SAMPLE_PATHS", () => {
  // ----- 正常系 -----
  it("宣言したパスがすべて実在する", () => {
    expect(SAMPLE_PATHS.filter((target) => !exists(target))).toEqual([]);
  });

  it("すべてリポジトリの内側を指す", () => {
    expect(() => {
      for (const target of SAMPLE_PATHS) {
        assertWithinRoot(target, ROOT_DIR);
      }
    }).not.toThrow();
  });

  it("他の対象に含まれる宣言を持たない", () => {
    expect(findRedundantPaths(SAMPLE_PATHS)).toEqual([]);
  });

  it("破棄の道具自身を含む", () => {
    expect(SAMPLE_PATHS).toContain("scripts/setup/remove-sample");
  });
});

describe("SAMPLE_RESTORATIONS", () => {
  // ----- 正常系 -----
  it("宣言した雛形がすべて実在する", () => {
    expect(SAMPLE_RESTORATIONS.filter(({ from }) => !exists(from))).toEqual([]);
  });

  it("雛形は削除対象の内側にあり、置き直す先は外側にある", () => {
    expect(findMisplacedRestorations(SAMPLE_RESTORATIONS, SAMPLE_PATHS)).toEqual([]);
  });

  it("置き直す先が、残す側の実物を指していない", () => {
    expect(findOccupiedRestorations(SAMPLE_RESTORATIONS, exists)).toEqual([]);
  });

  it("すべてリポジトリの内側を指す", () => {
    expect(() => {
      for (const { from, to } of SAMPLE_RESTORATIONS) {
        assertWithinRoot(from, ROOT_DIR);
        assertWithinRoot(to, ROOT_DIR);
      }
    }).not.toThrow();
  });

  it("入口の画面を置き直す", () => {
    expect(SAMPLE_RESTORATIONS.map(({ to }) => to)).toContain("src/app/page.tsx");
  });
});

describe("MARKER_LITERAL_FILES", () => {
  // ----- 正常系 -----
  it("宣言したファイルがすべて実在する", () => {
    expect(MARKER_LITERAL_FILES.filter((target) => !exists(target))).toEqual([]);
  });

  it("マーカーの形を実際に含む", () => {
    const withoutMarker = MARKER_LITERAL_FILES.filter(
      (target) =>
        !fs.readFileSync(path.join(ROOT_DIR, target), "utf8").includes(`${SAMPLE_MARKER}:`),
    );

    expect(withoutMarker).toEqual([]);
  });
});

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
});

describe("BINARY_EXTENSIONS", () => {
  // ----- 正常系 -----
  it("すべてドットで始まり小文字である", () => {
    expect(
      BINARY_EXTENSIONS.filter(
        (extension) => !extension.startsWith(".") || extension !== extension.toLowerCase(),
      ),
    ).toEqual([]);
  });
});
