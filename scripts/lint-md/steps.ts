// Markdown の検査を通す順の宣言。実行そのものは入口([index.ts](index.ts))が持つ。
//
// **チェーンを `package.json` から出してあるのは、JSON がコメントを持てないためである。**
// 剥がしで消える段（`premise-lint`）をここへ置くと、行を差し替えマーカーで囲える。`package.json`
// を剥がしが書き換える形は採らない —— pnpm は `package.json` の変更をロックファイルとの食い違いと
// 見なして `ERR_PNPM_VERIFY_DEPS_BEFORE_RUN` で止まるため、剥がした直後のツリーで全コマンドが
// 落ちる。

/** 検査 1 段。 */
export type LintStep = {
  /** 失敗時に名指しする名前。 */
  name: string;
  /** 実行するコマンドと引数。 */
  command: readonly string[];
};

/**
 * 通す順の段。
 *
 * @remarks
 * 前の段が落ちたら後ろは走らせません。`&&` で繋いでいたときと同じで、体裁が崩れたままの本文へ
 * 意味の検査を当てても、読む価値のある指摘になりません。
 */
export const LINT_STEPS: readonly LintStep[] = [
  { name: "markdownlint", command: ["markdownlint-cli2"] },
  { name: "mermaid-lint", command: ["tsx", "scripts/mermaid-lint"] },
  { name: "skill-lint", command: ["tsx", "scripts/skill-lint"] },
  // boilerplate-only:begin
  { name: "premise-lint", command: ["tsx", "scripts/premise-lint"] },
  // boilerplate-only:end
];
