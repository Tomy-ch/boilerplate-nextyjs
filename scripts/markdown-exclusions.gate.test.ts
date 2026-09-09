import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

import { EXCLUDE_DIRS, EXCLUDE_PREFIXES } from "./lib/markdown-files";

/**
 * Markdown の走査範囲が、markdownlint-cli2 と揃っているかのゲート。
 *
 * @remarks
 * `lib/markdown-files.ts` は「対象範囲は markdownlint-cli2 の `ignores` と揃える」と宣言して
 * います。片方だけが見るファイルがあると「markdownlint は通るのに mermaid-lint で落ちる」
 * 形の差が出ます。
 *
 * **走査の実装ではなく宣言どうしを突き合わせます。** 走査の振る舞いは
 * `lib/markdown-files.test.ts` が持つので、ここが見るのは 2 つの設定が同じものを指しているか
 * だけです。
 */

const REPOSITORY_ROOT = resolve(import.meta.dirname, "..");

/** markdownlint-cli2 の設定。 */
const CONFIG_PATH = resolve(REPOSITORY_ROOT, ".markdownlint-cli2.yaml");

/** 走査の除外を markdownlint-cli2 の glob へ写す。名前で外すものはどの階層にも当てる。 */
function toIgnoreGlobs(): string[] {
  return [
    ...[...EXCLUDE_DIRS].map((name) => `**/${name}/**`),
    ...EXCLUDE_PREFIXES.map((prefix) => `${prefix.replaceAll("\\", "/")}/**`),
  ];
}

/** 設定が宣言する `ignores`。 */
function declaredIgnores(): string[] {
  const config = parse(readFileSync(CONFIG_PATH, "utf8")) as { ignores?: unknown };
  const ignores = config.ignores;
  if (!Array.isArray(ignores)) {
    throw new Error("`.markdownlint-cli2.yaml` に ignores がありません");
  }

  return ignores.map(String);
}

describe("Markdown 走査範囲の突合", () => {
  // ----- 正常系 -----
  it("mermaid-lint の除外と markdownlint-cli2 の ignores が同じものを指す", () => {
    expect([...declaredIgnores()].sort()).toEqual([...toIgnoreGlobs()].sort());
  });
});
