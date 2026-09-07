/**
 * 画素が動いた対象を手元で開くコマンド。
 *
 * @remarks
 * 落ちた story と画面は、使い捨ての作業ツリーで開いて見ます。コメントが並べるのはそのコマンド
 * そのもので、**読み手は端末へ貼ります**。したがって差し込む値（ブランチ名・id）は
 * [`accepted-chars.ts`](accepted-chars.ts) が許す文字集合を外れた時点で 1 行ごと落とします。
 *
 * **綴りと落とす判断を 1 つにします。** 綴りだけを共有して判定を呼ぶ側に残すと、判定を書き忘れた
 * 面が「貼れるコマンド」を出し続けます。組み立てられなければ `null` を返す形にして、忘れられない
 * ようにしてあります。
 */

import { containsUnsafe } from "./accepted-chars.js";

/** 開く対象の種類。make の入口と、渡す変数の名前を決める。 */
export const REVIEW_KIND = {
  /** story 単位の撮影（`vrt/`）。 */
  story: "story",
  /** 画面単位の巡回（`e2e/`）。 */
  screen: "screen",
} as const;

/** {@link REVIEW_KIND} のいずれか。 */
export type ReviewKind = (typeof REVIEW_KIND)[keyof typeof REVIEW_KIND];

/** 種類ごとの make の入口と、対象を渡す変数の名前。 */
const REVIEW_TARGET = {
  [REVIEW_KIND.story]: { target: "vrt-review", variable: "VRT_ONLY" },
  [REVIEW_KIND.screen]: { target: "e2e-review", variable: "E2E_ONLY" },
} as const;

/** {@link composeReviewCommand} が受け取るもの。 */
export type ReviewCommandInput = {
  /** 開く対象の種類。 */
  readonly kind: ReviewKind;
  /** 対象の id をカンマで並べたもの。 */
  readonly ids: string;
  /** 作業ツリーが指すブランチ。 */
  readonly headRef: string;
  /**
   * 成果物を引く実行。
   *
   * @remarks
   * 撮り直しの完了コメントは渡しません。そちらが指すのは既に置き場へ入った画像で、実行の
   * 成果物ではないためです。
   */
  readonly runId?: string;
};

/**
 * 作業ツリーの後始末。コマンドを出す面はすべてこれを添える。
 *
 * @remarks
 * 中断しても消えません。添え忘れると、溜まっていることに気付く手立てが無くなります。
 */
export const REVIEW_WORKTREE_NOTE =
  "作業ツリーは Ctrl-C では消えません。溜まったら `make review-clean` で片付けてください。";

/**
 * 手元で開くコマンドを 1 行組み立てる。
 *
 * @param input - 対象の種類・id・ブランチ・実行
 * @returns コマンド。対象が 1 つも無いか、差し込む値が文字集合を外れていれば `null`
 */
export function composeReviewCommand(input: ReviewCommandInput): string | null {
  if (input.ids === "" || containsUnsafe(input.ids, input.headRef, input.runId ?? "")) {
    return null;
  }

  const { target, variable } = REVIEW_TARGET[input.kind];
  const run = input.runId === undefined ? "" : ` RUN='${input.runId}'`;

  return `make ${target} BRANCH='${input.headRef}'${run} ${variable}='${input.ids}'`;
}
