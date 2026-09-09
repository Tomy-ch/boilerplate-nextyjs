import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { findUndeclaredDirectories } from "./lib/test-requirement";

/**
 * テストを持つディレクトリが、負う層別責務を宣言しているかのゲート。
 *
 * @remarks
 * 検査の中身は `lib/test-requirement.ts` が持ち、ここはツリーの走査だけを担う
 * (`one-to-one.gate.test.ts` と同形)。
 *
 * 宣言が無いと、層別責務表のどの行に照らせばよいかが引けない。レビューする側は「何を果たす
 * べきか」を対象の見た目から推測することになり、推測は次に同じディレクトリを見る人と一致しない。
 */

const REPOSITORY_ROOT = resolve(import.meta.dirname, "..");

/**
 * 走査しない名前。依存と生成物には書き手の手が入らない。
 *
 * @remarks
 * 隣の `one-to-one.gate.test.ts` / `doc-links.gate.test.ts` が**残す列**（`SCAN_ROOTS`）で絞るのに
 * 対し、ここは**除外の列**で絞る。あちらは走査範囲がカバレッジ母数と揃っている必要があり、根を
 * 1 つ足すことがテストを書く義務を伴うため、足す判断を宣言として残す。ここが求めるのは README
 * 1 行の宣言だけで、義務を伴わない。だから既定を「全部見る」にでき、新しく生えたディレクトリが
 * 宣言を欠いたまま無検査で増えることもない。
 *
 * 除外するのはリポジトリが自分で書いていないものだけで、隠しディレクトリは道具の作業場所
 * （作業ツリー・キャッシュ）として一括で外す。
 */
const SKIPPED_DIRECTORIES = new Set([
  "node_modules",
  "dist",
  "coverage",
  "coverage-scripts",
  "tmp",
  "storybook-static",
]);

/** 隠しディレクトリのうち、リポジトリが自分で書いていて走査する対象。 */
const SCANNED_HIDDEN_DIRECTORIES = new Set([".storybook"]);

function isSkipped(name: string): boolean {
  if (SKIPPED_DIRECTORIES.has(name)) return true;

  return name.startsWith(".") && !SCANNED_HIDDEN_DIRECTORIES.has(name);
}

const TEST_PATTERN = /\.test\.tsx?$/;

function* walk(directory: string): Generator<string> {
  for (const entry of readdirSync(directory)) {
    const absolute = join(directory, entry);

    if (statSync(absolute).isDirectory()) {
      if (!isSkipped(entry)) yield* walk(absolute);
      continue;
    }

    if (TEST_PATTERN.test(entry)) yield absolute;
  }
}

function readReadme(directory: string): string | null {
  const path = join(REPOSITORY_ROOT, directory, "README.md");

  return existsSync(path) ? readFileSync(path, "utf8") : null;
}

/** 走査で見つけたテストファイル(リポジトリルート相対)。 */
function collectTestFiles(): string[] {
  return [...walk(REPOSITORY_ROOT)].map((file) =>
    relative(REPOSITORY_ROOT, file).split("\\").join("/"),
  );
}

// リポジトリ全体を走査するため、既定の 5 秒では足りない。全量を並列で回すと取り合いでさらに伸び、
// 走査の遅さがそのまま赤になる（`docs/testing-conventions.md`「リポジトリ全体を走査するゲート」）。
const TIMEOUT_MS = 300_000;

describe("層別責務の宣言", () => {
  it(
    "テストを持つディレクトリは、負う層別責務を遡って引ける",
    () => {
      const testFiles = collectTestFiles();

      // 走査が空振りすると、違反ゼロを報告したままゲートが黙る。除外の列を増やしたときに
      // 起きる壊れ方がこれなので、違反より先に「見た件数」を主張する。
      expect(testFiles.length).toBeGreaterThan(0);
      expect(findUndeclaredDirectories(testFiles, readReadme)).toEqual([]);
    },
    TIMEOUT_MS,
  );
});
