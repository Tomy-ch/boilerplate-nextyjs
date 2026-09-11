/**
 * 差分から、その PR を測るべきかを決める。
 *
 * @remarks
 * 全数の計測は保護ブランチと日次に置いてあります。ここが答えるのは**その待ち方では遅すぎる
 * 差分かどうか**だけです。
 *
 * **ここが答えるのは、待たずに測ってしまう理由だけです。**ラベルを勧めるところまでの合図は
 * [`../deferred-checks/recommend.ts`](../deferred-checks/recommend.ts) が 3 つの検査ぶんまとめて
 * 持ち、ここが force と答えた差分では計測を勧めません。
 */

import type { Change } from "../lib/numstat";

/** 差分に対する判定。 */
export type Trigger =
  | {
      readonly kind: "force";
      /** なぜ測るのか。人が読む。 */
      readonly reasons: readonly string[];
    }
  | {
      /** 保護ブランチでの計測に任せる。 */
      readonly kind: "skip";
    };

/** 画面の宣言。ここが動くのは、画面が増えたか開き方が変わったとき。 */
const SCREEN_DECLARATION = "e2e/lib/screens.ts";

/** 全画面が通る器。layout 自身と、layout が組む shell の部品。 */
const SHELL_SUFFIX = "/layout.tsx";
const SHELL_COMPONENTS = "src/components/shell/";

/**
 * そのパスが待たずに測る理由に当たるなら、その理由。
 *
 * @remarks
 * どちらも「その差分が何を意味するか」で選んでいます。画面を足すと宣言が必ず動くので、前者は
 * **一度も測られていない画面が生まれた**ことを指します。後者は全画面が通る器です。
 */
function forceReasonOf(path: string): string | undefined {
  if (path === SCREEN_DECLARATION) {
    return "画面の宣言が動いています。まだ一度も測られていない画面があるかもしれません";
  }

  if (
    (path.startsWith("src/app/") && path.endsWith(SHELL_SUFFIX)) ||
    path.startsWith(SHELL_COMPONENTS)
  ) {
    return "器（layout と、それが組む shell の部品）が動いています。全ての画面がこれを通ります";
  }

  return undefined;
}

/**
 * 差分を判定する。
 *
 * @param changes - 変更されたファイルと、その変更行数。
 *
 * @remarks
 * 器を 1 行だけ直した差分は量では拾えませんが、効く範囲は全画面です。構造で見るのはそのためです。
 */
export function decideTrigger(changes: readonly Change[]): Trigger {
  const reasons = [
    ...new Set(
      changes
        .map((change) => forceReasonOf(change.path))
        .filter((reason): reason is string => reason !== undefined),
    ),
  ];

  return reasons.length > 0 ? { kind: "force", reasons } : { kind: "skip" };
}
