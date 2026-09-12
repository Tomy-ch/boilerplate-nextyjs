// リリース運用の手順を、走らせずに組み立てるための語彙。
//
// ブランチを切る側([branch.ts](branch.ts))とタグを打つ側([tag.ts](tag.ts))は「何を、どの順で」
// だけを決め、実際に走らせるのは入口([index.ts](index.ts))が担う。どちらも取り消せない操作
// (push / 既定ブランチの張り替え / gh release create)を含むため、判断を走らせずに確かめられる
// 形にしておかないと、確かめる術が「一度やってみる」しか残らない。

/** 走らせる外部コマンド 1 つ。 */
export type ReleaseCommand = {
  readonly command: string;
  readonly args: readonly string[];
};

/** 手順 1 つ。人へ出す 1 行か、走らせる 1 コマンドのどちらか。 */
export type ReleaseStep =
  | { readonly kind: "log"; readonly message: string }
  | ({ readonly kind: "run" } & ReleaseCommand);

/** 出荷済みの断面を持つブランチ。リリースブランチもタグもここから派生する。 */
export const PRODUCTION_BRANCH = "production";

/** 人へ出す 1 行。 */
export function logStep(message: string): ReleaseStep {
  return { kind: "log", message };
}

/**
 * 走らせる 1 コマンド。引数は配列のまま持つ。
 *
 * @remarks
 * 1 本の文字列へ畳むと走らせる側がシェルを一段挟むことになり、版番号やブランチ名が展開の
 * 対象になります。
 */
export function runStep(command: string, args: readonly string[]): ReleaseStep {
  return { kind: "run", command, args };
}

/**
 * 版を数える前に、リモートのタグを取り込む段。
 *
 * @remarks
 * 手元に無いタグは最新として選べません。取り込みを飛ばすと、直前に誰かが打ったタグを見落とし、
 * 既に在る版をもう一度作りにいきます。
 */
export const FETCH_TAGS_STEPS: readonly ReleaseStep[] = [
  logStep("🔄 最新のタグを取得中..."),
  runStep("git", ["fetch", "--tags", "origin"]),
  logStep("✅ 最新のタグを取得完了"),
];
