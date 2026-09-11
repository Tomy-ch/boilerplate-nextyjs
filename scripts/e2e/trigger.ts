/**
 * 差分から、その PR でジャーニーと画面の比較を回すべきかを決める。
 *
 * @remarks
 * 全数は保護ブランチへの merge と日次が持ちます（`.github/workflows/e2e.yaml` 冒頭）。ここが
 * 答えるのは**その待ち方では遅すぎる差分かどうか**だけで、
 * [`../lighthouse/trigger.ts`](../lighthouse/trigger.ts) と同じ位置にいます。
 *
 * **待たせる代償は、検出が 1 merge 遅れることだけではありません** —— 基準画像の撮り直しは PR の
 * 実行が出した報告にしか乗らないため（`baseline/README.md`）、merge 後に食い違うと撮り直す相手を
 * 名指しできる PR がもう居ません。この非対称が線を決めています（`.github/workflows/e2e.yaml` 冒頭の
 * "Why this does not run on every pull request"）。
 *
 * **ここが挙げるのは、届く範囲が全画面で、しかもそれが差分の見た目から分からないものだけです。**
 * mock の応答やジャーニーの宣言も画面を動かしますが、動かしていることは書いた人に見えているので、
 * ラベルの側（[`../deferred-checks/recommend.ts`](../deferred-checks/recommend.ts)）に残します。
 * 見えているものまでここへ足すと、ほとんどの PR で回る検査になり、先送りにしている意味が消えます。
 */

import type { Change } from "../lib/numstat";
import { matchesPathRule, type PathRule } from "../lib/path-rule";

/** 差分に対する判定。 */
export type Trigger =
  | {
      readonly kind: "force";
      /** なぜ回すのか。人が読む。 */
      readonly reasons: readonly string[];
    }
  | {
      /** 保護ブランチでの実行に任せる。 */
      readonly kind: "skip";
    };

/**
 * 待たずに回す理由。
 *
 * @remarks
 * 3 つとも「その差分が何を意味するか」で選んでいます。器と土台の CSS は全画面が通り、画面の宣言が
 * 動くのは**基準画像を一度も持っていない画面が生まれた**ときです。
 */
const FORCE_RULES: readonly PathRule[] = [
  {
    globs: ["src/app/**/layout.tsx", "src/components/shell/**/*"],
    reason: "器（layout と、それが組む shell の部品）が動いています。全ての画面がこれを通ります",
  },
  {
    globs: ["src/app/globals.css", "src/components/design-system/foundation/**/*.css"],
    reason:
      "全ての画面が読む土台の CSS が動いています。1 つの宣言で全画面の折り返しと貼り付きが動きます",
  },
  {
    globs: ["e2e/lib/screens.ts"],
    reason: "画面の宣言が動いています。まだ基準画像を持たない画面があるかもしれません",
  },
] as const;

/**
 * 差分を判定する。
 *
 * @param changes - 変更されたファイルと、その変更行数。
 *
 * @remarks
 * 器を 1 行だけ直した差分は量では拾えませんが、効く範囲は全画面です。構造で見るのはそのためです。
 */
export function decideTrigger(changes: readonly Change[]): Trigger {
  const paths = changes.map((change) => change.path);
  const reasons = FORCE_RULES.filter((rule) => matchesPathRule(rule, paths)).map(
    (rule) => rule.reason,
  );

  return reasons.length > 0 ? { kind: "force", reasons } : { kind: "skip" };
}
