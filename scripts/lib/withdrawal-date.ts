/**
 * 撤回条件に書かれた日付の読み取りと、判定の基準日。
 *
 * @remarks
 * 抑止の撤回条件のうち機械が決められるのは日付だけで、その読み方を検査ごとに持つと
 * 「最も遅い日付を取る」の解釈が検査によってずれます。ここが 1 箇所で持ち、抑止の棚卸し
 * （`scripts/suppression-expiry`）と冷却の免除（`scripts/tools-cooldown`）が同じ読み方をします。
 */

/** 条件の中の日付。年月日だけを見る —— 時刻まで書く宣言は無い。 */
const DATE_PATTERN = /\d{4}-\d{2}-\d{2}/g;

/** 1 日の長さ（ミリ秒）。 */
const MS_PER_DAY = 86_400_000;

/**
 * 条件に書かれた日付のうち、最も遅いもの。
 *
 * @remarks
 * **最も遅いものを取ります。** 条件は「公開が 2026-08-29 で、冷却が明ける 2026-09-05 以降」の
 * ように複数の日付を含みます。早い側を取ると、まだ来ていない期限を過ぎたと報告します。
 *
 * 比較は文字列どうしで行います。`YYYY-MM-DD` は辞書順と時系列順が一致します。
 *
 * @param condition - 撤回条件の散文
 * @returns `YYYY-MM-DD`。日付を含まなければ `undefined`
 */
export function latestDateIn(condition: string): string | undefined {
  const dates = [...condition.matchAll(DATE_PATTERN)].map((match) => match[0]).sort();

  return dates.at(-1);
}

/**
 * 時刻を日本時間の暦日にする。
 *
 * @remarks
 * **抑止の条件は日本時間の暦日で書かれている**ので、暦日も日本時間で取ります。UTC で取ると、
 * 日付をまたぐ時間帯に走った実行だけ判定が 1 日ずれます。
 *
 * @param at - 絶対時刻
 * @returns `YYYY-MM-DD`
 */
export function calendarDay(at: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo" }).format(at);
}

/**
 * 公開から `days` 日を数えた暦日。冷却の窓が明ける日を求めるのに使う。
 *
 * @param published - 公開の時刻
 * @param days - 数える日数
 * @returns `YYYY-MM-DD`
 */
export function dayAfter(published: Date, days: number): string {
  return calendarDay(new Date(published.getTime() + days * MS_PER_DAY));
}

/**
 * 公開からの経過日数。切り捨てる —— 13 日と 23 時間は 13 日であって、まだ 14 日を満たさない。
 *
 * @param published - 公開の時刻
 * @param now - 現在の時刻
 */
export function daysSince(published: Date, now: Date): number {
  return Math.floor((now.getTime() - published.getTime()) / MS_PER_DAY);
}
