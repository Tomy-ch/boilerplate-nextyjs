import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { findBrokenDocLinks, formatBrokenDocLinks } from "./lib/doc-links";
import { collectMarkdownFiles } from "./lib/markdown-files";

/**
 * 文書を指す相対リンクが、実在するかを見るゲート。
 *
 * @remarks
 * 検査の中身は {@link findBrokenDocLinks} が持ち、ここはツリーの走査だけを担う。ゲートを
 * `scripts/` へ置くのは、これがアプリの振る舞いではなく開発機構の検査だから
 * （`one-to-one.gate.test.ts` と同形）。
 *
 * `pnpm lint:md` は Markdown の体裁だけを見てリンク先の実在は見ないため、この検査はそちらでは
 * 代替できない。
 *
 * 見る先は 2 系統ある。Markdown は本文（コードフェンスとコードスパンを除く）、ソースはコメント行。
 */

const REPOSITORY_ROOT = resolve(import.meta.dirname, "..");

/** ソースを走査する範囲（リポジトリルート相対）。ここに並ばないディレクトリは丸ごと無検査になる。 */
const SCAN_ROOTS = [
  "src",
  "scripts",
  "tokens",
  "mocks",
  "docs-viewer/src",
  "eslint-rules",
  "baseline/lib",
  "vrt",
  "e2e",
  ".storybook",
] as const;

/** 走査しない名前。生成物と依存は書き手の手が入らない。 */
const SKIPPED_DIRECTORIES = new Set(["node_modules", "gen", "__mocks__"]);

/** 走査対象の拡張子。 */
const SOURCE_PATTERN = /\.tsx?$/;

function* walk(directory: string): Generator<string> {
  for (const entry of readdirSync(directory)) {
    const absolute = join(directory, entry);

    if (statSync(absolute).isDirectory()) {
      if (!SKIPPED_DIRECTORIES.has(entry)) yield* walk(absolute);
      continue;
    }

    if (SOURCE_PATTERN.test(entry)) yield absolute;
  }
}

function brokenIn(files: readonly string[]) {
  return files.flatMap((file) =>
    findBrokenDocLinks(file, readFileSync(join(REPOSITORY_ROOT, file), "utf8"), REPOSITORY_ROOT),
  );
}

// リポジトリ全体を走査するため、既定の 5 秒では足りない。全量を並列で回すと取り合いでさらに伸び、
// 走査の遅さがそのまま赤になる（`docs/testing-conventions.md`「リポジトリ全体を走査するゲート」）。
const TIMEOUT_MS = 300_000;

/**
 * 走査対象の下限。
 *
 * @remarks
 * 走査対象そのものが空へ縮退すると、壊れたリンクも 0 件になり、ゲートが「違反なし」を報告する
 * 向きに壊れたことを結果からは見分けられない。だから下限を置く。
 *
 * 実数より十分低く採る。**現在の件数に合わせると、ファイルを 1 つ消すたびに落ちる**ゲートに
 * なってしまう。ここが守るのは縮退であって増減ではない。
 */
const MINIMUM_SOURCES = 500;
const MINIMUM_MARKDOWN = 200;

describe("文書リンクの解決", () => {
  // ----- 正常系 -----
  it(
    "ソースのコメントから文書を指す相対リンクは、すべて実在する",
    () => {
      const files = SCAN_ROOTS.flatMap((root) =>
        [...walk(join(REPOSITORY_ROOT, root))].map((file) => relative(REPOSITORY_ROOT, file)),
      );

      expect(files.length).toBeGreaterThan(MINIMUM_SOURCES);
      expect(formatBrokenDocLinks(brokenIn(files), REPOSITORY_ROOT)).toBe("");
    },
    TIMEOUT_MS,
  );

  it(
    "Markdown 本文の相対リンクは、すべて実在する",
    () => {
      const files = collectMarkdownFiles(REPOSITORY_ROOT);

      expect(files.length).toBeGreaterThan(MINIMUM_MARKDOWN);
      expect(formatBrokenDocLinks(brokenIn(files), REPOSITORY_ROOT)).toBe("");
    },
    TIMEOUT_MS,
  );
});
