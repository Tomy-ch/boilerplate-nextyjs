import { z } from "zod";
import { type RawSearchParams, singleValue } from "@/model/search-params";
import { DASHBOARD_PERIOD, type DashboardPeriodSelection, PERIOD_KEY } from "./period";

/**
 * URL を読む側。**組む側（[`period.ts`](period.ts)）と分けてある**（`docs/rules.md`「URL と条件」の
 * 「`searchParams` を読むスキーマは URL へ組む側と別の module へ置く」）。組むのは期間の選択肢や日付の overlay といった client の部品です。
 */

/**
 * URL の期間を読むスキーマ。
 *
 * @remarks
 * **読めない値はキーごと返します。** 何が読めなかったかを画面が名指しできないと、URL を直す手が
 * かりが「どこかが違う」しか残りません。
 *
 * 区分は画面が持つ語彙で、契約はもう受け取りません。日付は暦の上に実在する日だけを通します
 * （`2026-06-31` は書式では通ってしまい、繰り上がって別の日になります）。
 */
const selectionSchema = z.object({
  [PERIOD_KEY.PERIOD]: singleValue(
    z.enum([DASHBOARD_PERIOD.TODAY, DASHBOARD_PERIOD.MONTH, DASHBOARD_PERIOD.RANGE]),
  ).optional(),
  [PERIOD_KEY.FROM]: singleValue(z.iso.date()).optional(),
  [PERIOD_KEY.TO]: singleValue(z.iso.date()).optional(),
});

/** URL の期間を読んだ結果。 */
export type PeriodSelectionParseResult =
  | { readonly ok: true; readonly selection: DashboardPeriodSelection }
  /** 読めなかったキー。表示に使えるよう、検証ライブラリの型ではなく素の名前で返す。 */
  | { readonly ok: false; readonly invalidKeys: readonly string[] };

/**
 * URL の期間を、選択の形へ読む。
 *
 * @remarks
 * **`range` のときに日付が揃っているかは見ません。** 日付をこれから選ぶ状態も同じ URL の形を
 * しているためで、揃っているかどうかは `toPeriodRequest`（`period.ts`）が見ます。
 */
export function parsePeriodSelection(params: RawSearchParams): PeriodSelectionParseResult {
  const parsed = selectionSchema.safeParse(params);

  if (!parsed.success) {
    return {
      ok: false,
      invalidKeys: [...new Set(parsed.error.issues.map((issue) => String(issue.path[0])))],
    };
  }

  return { ok: true, selection: parsed.data };
}
