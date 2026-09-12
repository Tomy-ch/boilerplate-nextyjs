/**
 * SonarCloud 自身の合否と、落ちた条件の書き出し。
 *
 * @remarks
 * 「解析が走ったか」とは別の問いです。**所見が 1 件も無くてもゲートは落ちえます**（重複率の
 * ような、行に紐づかない指標で落ちる）。だから合否は所見の一覧からは導けず、ここが読みます。
 */

import { fieldOf, itemsOf, textOf } from "./payload.js";

/** 条件が落ちたことを表す状態。 */
const FAILING = "ERROR";

/** 読めなかった値の代わり。 */
const UNREADABLE = "?";

/**
 * ゲートの判定。
 *
 * @remarks
 * 読めなければ `UNKNOWN` を返します。**それを合格へ寄せません** —— 誰も定めていない判定は
 * 合格ではなく、`OK` 以外をどう扱うかは呼び出し側が決めます。
 */
export function readGateStatus(payload: unknown): string {
  return textOf(fieldOf(fieldOf(payload, "projectStatus"), "status"), "UNKNOWN");
}

/**
 * 落ちた条件だけを箇条書きにする。
 *
 * @remarks
 * **通った条件は書きません。** それはゲートが仕事をしているだけで、並べると読むべき行が埋もれます。
 *
 * @returns 1 件も落ちていなければ空文字列。空かどうかを見て、貼る側が節ごと落とす
 */
export function renderFailingConditions(payload: unknown): string {
  return itemsOf(fieldOf(fieldOf(payload, "projectStatus"), "conditions"))
    .filter((condition) => textOf(fieldOf(condition, "status"), "") === FAILING)
    .map((condition) => `${conditionLine(condition)}\n`)
    .join("");
}

/** 落ちた条件 1 件を、閾値と実測値の組で読ませる。 */
function conditionLine(condition: unknown): string {
  const metric = textOf(fieldOf(condition, "metricKey"), UNREADABLE);
  const comparator = textOf(fieldOf(condition, "comparator"), UNREADABLE).toLowerCase();
  const threshold = textOf(fieldOf(condition, "errorThreshold"), UNREADABLE);
  const actual = textOf(fieldOf(condition, "actualValue"), UNREADABLE);

  return `- \`${metric}\` ${comparator} ${threshold} — actual ${actual}`;
}
