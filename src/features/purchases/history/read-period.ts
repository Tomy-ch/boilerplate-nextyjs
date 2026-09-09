import { z } from "zod";

import { type RawSearchParams, singleValue } from "@/model/search-params";
import { CALENDAR_MONTH_PATTERN } from "@/model/time-window";

import { ALL_PERIOD, MAX_RECENT_DAYS, PERIOD_KEY, type PeriodSelection } from "./period";

/**
 * URL を読む側。**組む側（[`period.ts`](period.ts)）と分けてある**（`docs/rules.md`「URL と条件」の
 * 「`searchParams` を読むスキーマは URL へ組む側と別 module へ置く」）。組むのは期間の入力欄や
 * 続きの読み込みといった client の部品です。
 */

/** 暦月 1 つを表す `YYYY-MM`。書式は区間を組む側（`model`）が宣言したものを使う。 */
const monthSchema = singleValue(z.string().regex(CALENDAR_MONTH_PATTERN));

/**
 * 暦の上に実在する日付。
 *
 * @remarks
 * 書式の照合だけでは通ってしまう日（`2026-06-31` など）を弾きます。実在しない日は繰り上がって
 * 別の日になるため、`z.iso.date()` はそれも不正として扱います。
 */
const dateSchema = singleValue(z.iso.date());

/** 今日から遡る日数。上限は選択肢が決めるので、それを持つ側から引く。 */
const daysSchema = singleValue(z.coerce.number().int().min(1).max(MAX_RECENT_DAYS));

/**
 * 効いている期間の条件を読むスキーマ。
 *
 * @remarks
 * **読めない条件は全期間へ倒します。** URL は利用者が直接編集できるので、区分だけがあって必須の値が
 * 無い URL も、日付として読めない値も届きます。そのまま契約へ渡すと一覧そのものが 400 になり、
 * 画面には何も出せません。倒した結果は入力欄にそのまま現れるので、指定が効いていないことは
 * 画面から読み取れます。
 *
 * 日付の前後関係もここで見ます。終了日が開始日より前の要求は契約が 400 で返すため、渡す前に
 * 落とします。
 */
const periodSchema = z
  .union([
    z
      .object({
        [PERIOD_KEY.PERIOD]: singleValue(z.literal("month")),
        [PERIOD_KEY.MONTH]: monthSchema,
      })
      .transform((value): PeriodSelection => ({ kind: "month", month: value[PERIOD_KEY.MONTH] })),
    z
      .object({
        [PERIOD_KEY.PERIOD]: singleValue(z.literal("range")),
        [PERIOD_KEY.FROM]: dateSchema,
        [PERIOD_KEY.TO]: dateSchema,
      })
      .refine((value) => value[PERIOD_KEY.FROM] <= value[PERIOD_KEY.TO])
      .transform(
        (value): PeriodSelection => ({
          kind: "range",
          from: value[PERIOD_KEY.FROM],
          to: value[PERIOD_KEY.TO],
        }),
      ),
    z
      .object({
        [PERIOD_KEY.PERIOD]: singleValue(z.literal("recent")),
        [PERIOD_KEY.DAYS]: daysSchema,
      })
      .transform((value): PeriodSelection => ({ kind: "recent", days: value[PERIOD_KEY.DAYS] })),
  ])
  .catch(ALL_PERIOD);

/**
 * 素の `searchParams` から、効いている期間の条件を読む。
 *
 * @remarks
 * 判定は {@link periodSchema} が持ちます（`docs/rules.md`「URL と条件」の「`searchParams` は zod で
 * 検証する」）。区分ごとに必須の値が違うため、区分ごとの姿を並べて照らします。手で条件を並べると、
 * 区分と値の組み合わせのうちどれを見ていないのかが読み取れません。
 */
export function toPeriodSelection(params: RawSearchParams): PeriodSelection {
  return periodSchema.parse(params);
}
