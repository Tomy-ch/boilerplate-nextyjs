// 週次が見る期間を決める判定。時刻の取得は入口が持ち、ここは受け取った値だけから答えを出す。
//
// 期間を**絶対日付で受け取る**のは、走らなかった週を後から取り直せるようにするためである。
// 「いつ基準の 1 週間か」が実行時刻に依存すると、取り直した集計が元の週と違う範囲を指す。

const DAY_SEC = 86_400;

/**
 * 日の境目をどこに置くか。
 *
 * @remarks
 * UTC で切ると、日本時間で `8/20` を指定したつもりの期間が JST 8/20 09:00 〜 8/21 08:59 を
 * 指し、**その日の午前が丸ごと落ちます**。指定した日と集計された範囲が 9 時間ずれるのは、
 * 数字が出てしまうぶん静かな失敗です。
 *
 * 固定値にしてあるのは、実行環境の `TZ` に従わせると**同じ引数が機械によって別の期間を指す**
 * ためです。期間は絶対日付で指定する設計なので、その解釈も固定でなければ意味がありません。
 */
export const DAY_BOUNDARY_OFFSET_SEC = 9 * 3600;

/** 集計する期間。両端を含む epoch 秒。 */
export type Period = {
  readonly from: number;
  readonly to: number;
};

function parseDay(day: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    throw new Error(`日付は YYYY-MM-DD で指定する: ${day}`);
  }

  const ms = Date.parse(`${day}T00:00:00Z`);

  if (Number.isNaN(ms)) {
    throw new TypeError(`日付として解釈できない: ${day}`);
  }

  return Math.floor(ms / 1000) - DAY_BOUNDARY_OFFSET_SEC;
}

function startOfDay(epochSec: number): number {
  const shifted = epochSec + DAY_BOUNDARY_OFFSET_SEC;

  return shifted - (shifted % DAY_SEC) - DAY_BOUNDARY_OFFSET_SEC;
}

/**
 * 期間を決める。
 *
 * @param from - `YYYY-MM-DD`。省略時は `to` を含めて 7 日ぶん遡った日
 * @param to - `YYYY-MM-DD`。省略時は `now` の日
 * @param now - 基準時刻（epoch 秒）。呼び出し側が渡すので、同じ入力は常に同じ期間になる
 */
export function resolvePeriod(
  from: string | undefined,
  to: string | undefined,
  now: number,
): Period {
  const endDay = to === undefined ? startOfDay(now) : parseDay(to);
  // 7 日は**終端を含めて 7 日**である。`endDay - 7` にすると 8 日ぶんになり、両端を含む
  // `withinPeriod` と合わさって、毎週の実行が 1 日ぶん重なる —— 同じ窓が 2 週続けて数えられ、
  // 再計測が「増えた」と読める。週ごとの実行が隙間なく敷き詰まる形はこちらだけである。
  const startDay = from === undefined ? endDay - 6 * DAY_SEC : parseDay(from);
  const end = endDay + DAY_SEC - 1;

  // 逆転しうるのは `from` が明示された場合だけ。省略時は `to` の 7 日前を置くので、構造上
  // そちらが後ろに来ることはない。
  if (from !== undefined && startDay > end) {
    throw new Error(`期間が逆転している: from=${from} to=${to ?? "(既定)"}`);
  }

  return { from: startDay, to: end };
}

/**
 * GitHub が返す ISO の時刻を秒へ直す。
 *
 * @remarks
 * 読めなかったものを 0 や現在時刻へ倒しません。**倒すと、読めなかった窓が期間の内側や
 * 外側として静かに数えられます** —— `undefined` を返せば、呼ぶ側は集計から外すか
 * 数え直すかを選べます（[0157](../../docs/adr/0157-inspection-declaration-discipline.md)）。
 *
 * @param iso - GitHub が返す時刻。閉じていない issue では `null`
 * @returns epoch 秒。時刻が無いか読めなければ `undefined`
 */
export function toEpochSec(iso: string | null): number | undefined {
  if (iso === null) {
    return undefined;
  }

  const seconds = Math.floor(Date.parse(iso) / 1000);

  return Number.isFinite(seconds) ? seconds : undefined;
}

/**
 * ある時刻が期間に入るか。両端を含む。
 *
 * @remarks
 * 端の扱いを 1 箇所に集めています。同じ判定を呼び出し側が書き直すと、**等号の有無が食い違って
 * 週境界の窓が静かに落ちたり二重に数えられたり**します。
 */
export function withinPeriod(at: number, period: Period): boolean {
  return at >= period.from && at <= period.to;
}

/**
 * epoch を `YYYY-MM-DD` にする。
 *
 * @remarks
 * **境界と綴りは同じ側が持ちます。**日の境界を JST に取りながら綴りを UTC で出すと、
 * JST の朝に閉じた窓が前日の日付で並び、期間の端が 1 日ずれた形で表示されます ——
 * 期間そのものは正しいので、表示だけを見ても原因に辿り着けません。
 */
export function toDay(epoch: number): string {
  return new Date((epoch + DAY_BOUNDARY_OFFSET_SEC) * 1000).toISOString().slice(0, 10);
}
