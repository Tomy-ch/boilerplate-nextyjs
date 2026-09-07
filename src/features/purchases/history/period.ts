import {
  dateRangeWindow,
  monthWindow,
  recentDaysWindow,
  type TimeWindow,
  WHOLE_TIME,
} from "@/model/time-window";

import { PURCHASE_HISTORY_PATH } from "../facade/paths/paths";

/** 期間の条件を載せる URL のキー。契約はこの語彙を受け取らないので、画面が決める。読む側（`read-period.ts`）と共有する。 */
export const PERIOD_KEY: Readonly<{
  PERIOD: "period";
  FROM: "from";
  TO: "to";
  MONTH: "month";
  DAYS: "days";
}> = {
  PERIOD: "period",
  FROM: "from",
  TO: "to",
  MONTH: "month",
  DAYS: "days",
};

/** 直近 N 日で選べる日数。 */
export const RECENT_DAYS_OPTIONS: readonly number[] = [7, 30, 90, 365];

/**
 * 遡れる日数の上限。
 *
 * @remarks
 * **契約はもう日数を受け取りません。** 相対の期間を暦の上で解くのは画面の側なので、どこまで
 * 遡らせるかもこちらが決めます。選択肢から引くのは、選べない日数を URL でだけ通せる状態を
 * 作らないためです。
 */
export const MAX_RECENT_DAYS: number = Math.max(...RECENT_DAYS_OPTIONS);

/**
 * いま効いている期間の条件。
 *
 * @remarks
 * 区分ごとに必要な値が違うため、判別可能 union で表します。区分と値を別々の項目で持つと、
 * 「暦月なのに日数が入っている」姿や「期間なのに終了日が無い」姿まで型として通ります。
 *
 * 区間へ解く側（{@link toPurchaseWindow}）も URL へ組む側（{@link toPeriodSearchParams}）もこの形を
 * 受け取ります。欠けた組み合わせを表せないことが、どちらの側でも解けない条件を作らせないことに
 * なります。
 */
export type PeriodSelection =
  /** 全期間。既定であり、URL には載せない。 */
  | { readonly kind: "all" }
  /** 暦月 1 つ。`YYYY-MM`。 */
  | { readonly kind: "month"; readonly month: string }
  /** 開始日と終了日。両端を含む。 */
  | { readonly kind: "range"; readonly from: string; readonly to: string }
  /** 今日から遡る日数。 */
  | { readonly kind: "recent"; readonly days: number };

/** 全期間。区分を選び直したときの初期値としても使う。 */
export const ALL_PERIOD: PeriodSelection = { kind: "all" };

/**
 * 期間の条件をクエリ文字列へ組む。
 *
 * @remarks
 * 全期間は何も載せません。既定を明示した URL と省略した URL が別物になると、同じ画面が 2 通りの
 * リンクを持ちます。
 *
 * 区分が使わない値も載せません。契約は無視すると宣言していますが、URL に残ると戻る操作や共有した
 * リンクで前の区分の値が復活します。
 */
export function toPeriodSearchParams(period: PeriodSelection): URLSearchParams {
  const params = new URLSearchParams();

  if (period.kind === "all") {
    return params;
  }

  params.set(PERIOD_KEY.PERIOD, period.kind);

  if (period.kind === "month") {
    params.set(PERIOD_KEY.MONTH, period.month);
  }

  if (period.kind === "range") {
    params.set(PERIOD_KEY.FROM, period.from);
    params.set(PERIOD_KEY.TO, period.to);
  }

  if (period.kind === "recent") {
    params.set(PERIOD_KEY.DAYS, String(period.days));
  }

  return params;
}

/** 期間の条件から購入履歴の URL を組む。 */
export function toPurchaseHistoryHref(period: PeriodSelection): string {
  const params = toPeriodSearchParams(period);

  return params.size === 0
    ? PURCHASE_HISTORY_PATH
    : `${PURCHASE_HISTORY_PATH}?${params.toString()}`;
}

/**
 * 効いている期間を、利用者の言葉で表す。
 *
 * @remarks
 * 全期間では `null` を返します。既定は条件ではないため、解除できる条件として画面に並べません。
 */
export function describePeriod(period: PeriodSelection): string | null {
  if (period.kind === "all") {
    return null;
  }

  if (period.kind === "month") {
    const [year, month] = period.month.split("-");

    return `${year} 年 ${Number(month)} 月`;
  }

  if (period.kind === "range") {
    return `${period.from} 〜 ${period.to}`;
  }

  return `直近 ${period.days} 日`;
}

/**
 * 効いている期間を、契約が受け取る半開区間へ写す。
 *
 * @remarks
 * **区分を解くのは画面の側です。** 契約が受け取るのは瞬時の半開区間だけで、「今月」や「直近 30 日」を
 * 暦の上で解く役は持ちません。解く暦とタイムゾーンは `model` が持ちます。
 *
 * **いまの時刻を引数で受けます。** 相対の期間は呼び出した瞬間で答えが変わるため、ページ送りの
 * 間は同じ区間を渡し続けなければ keyset の連続性が保証されません。区間を 1 度だけ決めて持ち回る
 * 形にするために、実時計をここで読みません。
 *
 * @param period - いま効いている期間
 * @param now - 相対の期間を解く基準の瞬時
 */
export function toPurchaseWindow(period: PeriodSelection, now: Date): TimeWindow {
  if (period.kind === "month") {
    return monthWindow(period.month);
  }

  if (period.kind === "range") {
    return dateRangeWindow(period.from, period.to);
  }

  if (period.kind === "recent") {
    return recentDaysWindow(period.days, now);
  }

  return WHOLE_TIME;
}
