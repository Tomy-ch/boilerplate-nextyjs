import { calendarDate, calendarMonth } from "@/model/time-window";
import { DASHBOARD_PERIOD, type DashboardPeriodSelection } from "./period";

/** その月の最終日。月をまたぐ加算は `Date` に数えさせる。 */
function endOfMonth(year: number, month: number): string {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();

  return `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
}

/** 集計が対象にしている暦日の範囲。両端を含む。 */
export type PeriodWindow = {
  readonly from: string;
  /** 終了日。開始日と同じなら 1 日だけを指す。 */
  readonly to: string;
};

/**
 * 選ばれた期間が、どの暦日を対象にしているかを解く。
 *
 * @remarks
 * **集計ではありません。** 出す数はバックエンドが合成したものだけで、ここが決めるのは「その数が
 * どの日付の話か」という添え書きです。
 *
 * 暦は取得の条件を組む側と同じものを引きます（`model/time-window.ts`）。別々に解くと、境目の
 * 時刻に「この期間を集計しています」という添え書きと実際の対象が食い違います。
 *
 * `range` は利用者が指定した暦日をそのまま返します。指定が揃っていないときと、前後が入れ替わって
 * いるときは、対象が決まっていないので返しません。
 *
 * @param query - URL が表す条件
 * @param now - 判定に使う時刻。呼び出し側が渡すのは、描画のたびに実時計を読むと基準画像が
 *   撮った時刻に依存するため
 */
export function toPeriodWindow(
  query: DashboardPeriodSelection,
  now: Date,
): PeriodWindow | undefined {
  const period = query.period ?? DASHBOARD_PERIOD.TODAY;

  if (period === DASHBOARD_PERIOD.RANGE) {
    const { from, to } = query;

    // 前後が入れ替わった組も対象が決まっていない。集計を求めない条件（`period.ts`）と
    // 揃えないと、何も集計していない画面に「この期間を集計しています」という添え書きが出る。
    return from === undefined || to === undefined || from > to ? undefined : { from, to };
  }

  if (period === DASHBOARD_PERIOD.TODAY) {
    const today = calendarDate(now);

    return { from: today, to: today };
  }

  const month = calendarMonth(now);
  const [year, monthOfYear] = month.split("-");

  return { from: `${month}-01`, to: endOfMonth(Number(year), Number(monthOfYear)) };
}
