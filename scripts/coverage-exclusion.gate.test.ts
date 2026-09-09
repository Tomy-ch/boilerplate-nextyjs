import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { describe, expect, it } from "vitest";

import { findExclusionDrift } from "./lib/coverage-exclusion";
import { EXCLUDED_FROM_CHECKS } from "./lib/untested-modules";

/**
 * カバレッジ除外が、所有側の README にも記録されているかのゲート。
 *
 * @remarks
 * 検査の中身は `lib/coverage-exclusion.ts` が持ち、ここはツリーの走査だけを担う
 * (`test-requirement.gate.test.ts` と同形)。
 *
 * 記録が無いと、その層を読む人は自分のディレクトリに穴があることに気づけない —— 除外は
 * `scripts/lib/` を開いた人にしか見えないものになる。
 *
 * **ゲートが見るのは記録の有無だけで、承認は見ない。** 除外を増やしてよいかの判断は PR の
 * レビューに残る。機械が代われるのは「書いてあるか」までである。
 */

const REPOSITORY_ROOT = resolve(import.meta.dirname, "..");

/**
 * 走査しない名前。依存と生成物には書き手の手が入らない。
 *
 * @remarks
 * 除外の列で絞るのは `test-requirement.gate.test.ts` と同じ理由による。既定を「全部見る」に
 * しておかないと、新しく生えたディレクトリの README が記録を残したまま走査の外へ落ちる。
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

/** README を持つディレクトリ(リポジトリルート相対、区切りは `/`)。 */
function* walkReadmeDirectories(directory: string): Generator<string> {
  if (existsSync(join(directory, "README.md"))) {
    yield relative(REPOSITORY_ROOT, directory).split(sep).join("/");
  }

  for (const entry of readdirSync(directory)) {
    const absolute = join(directory, entry);

    if (!isSkipped(entry) && statSync(absolute).isDirectory()) {
      yield* walkReadmeDirectories(absolute);
    }
  }
}

function readReadme(directory: string): string | null {
  const path = join(REPOSITORY_ROOT, directory, "README.md");

  return existsSync(path) ? readFileSync(path, "utf8") : null;
}

// リポジトリ全体を走査するため、既定の 5 秒では足りない。全量を並列で回すと取り合いでさらに伸び、
// 走査の遅さがそのまま赤になる（`docs/testing-conventions.md`「リポジトリ全体を走査するゲート」）。
const TIMEOUT_MS = 300_000;

describe("カバレッジ除外の記録", () => {
  it(
    "除外は所有 README の記録と一致する",
    () => {
      const readmeDirectories = [...walkReadmeDirectories(REPOSITORY_ROOT)];

      // 宣言と走査のどちらかが空振りすると、違反ゼロを報告したままゲートが黙る。宣言の列を組み替えた
      // ときと走査の除外を広げすぎたときに起きる壊れ方がこれなので、違反より先に「見た件数」を主張する。
      expect(EXCLUDED_FROM_CHECKS.length).toBeGreaterThan(0);
      expect(readmeDirectories.length).toBeGreaterThan(0);
      expect(findExclusionDrift([...EXCLUDED_FROM_CHECKS], readReadme, readmeDirectories)).toEqual(
        [],
      );
    },
    TIMEOUT_MS,
  );
});
