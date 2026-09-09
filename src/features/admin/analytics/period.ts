import {
  calendarMonth,
  dateRangeWindow,
  monthWindow,
  type TimeWindow,
  todayWindow,
} from "@/model/time-window";

import { ADMIN_ANALYTICS_PATH } from "../paths";

/**
 * 集計対象期間の区分。
 *
 * @remarks
 * 契約はこの語彙を受け取りません（区間へ解くのは {@link toPeriodRequest}）。**この画面だけが使う
 * 語彙**なので、この feature の中に置いています。
 */
export const DASHBOARD_PERIOD: Readonly<{ TODAY: "today"; MONTH: "month"; RANGE: "range" }> = {
  /** 今日。何も選ばれていないときの既定。 */
  TODAY: "today",
  /** 今月。 */
  MONTH: "month",
  /** 指定した両端の日付までの期間。 */
  RANGE: "range",
};

/** 集計対象期間として指定できる値。 */
export type DashboardPeriod = (typeof DASHBOARD_PERIOD)[keyof typeof DASHBOARD_PERIOD];

/**
 * URL が表している期間の選択。
 *
 * @remarks
 * **取得条件ではありません。** この型が表すのは、利用者が選んだ状態そのものです。区間へ解くのは
 * {@link toPeriodRequest} です。
 *
 * 日付は暦日の文字列のまま持ち回り、`Date` へ直しません。ブラウザの時差で暦日がずれると、指定
 * したつもりの日と集計された日が食い違います。
 */
export type DashboardPeriodSelection = {
  readonly period?: DashboardPeriod;
  /** 集計の開始日。`period` が `range` のときだけ効く。 */
  readonly from?: string;
  /** 集計の終了日。この日を含む。 */
  readonly to?: string;
};

/** 期間を載せる URL のキー。契約はこの語彙を受け取らないので、画面が決める。 */
export const PERIOD_KEY: Readonly<{ PERIOD: "period"; FROM: "from"; TO: "to" }> = {
  PERIOD: "period",
  FROM: "from",
  TO: "to",
};

/**
 * キーを画面上の呼び名へ直す表。
 *
 * @remarks
 * キーを持っているのはこの層なので、呼び名も同じ場所に置きます。表示する側が写しを持つと、
 * キーが増えたときに生の名前が出る画面と出ない画面に割れます。
 */
export const PERIOD_KEY_LABEL: Readonly<Record<string, string>> = {
  [PERIOD_KEY.PERIOD]: "期間の区分",
  [PERIOD_KEY.FROM]: "開始日",
  [PERIOD_KEY.TO]: "終了日",
};

/**
 * 期間の指定が、集計を求められる形になっているか。
 *
 * @remarks
 * 契約は前後の入れ替わった区間を 400 で返し、日付の欠けた `range` はそもそも区間へ解けませんが、
 * どちらも **これから日付を選ぶ状態**と同じ URL の形をしています。往復させてから拒まれる形に
 * しないため、送る前にこの層で見ます。
 */
export type PeriodRequest =
  /** 集計を求められる。区間は解決済みで、そのまま契約へ渡せる。 */
  | { readonly status: "ready"; readonly window: TimeWindow }
  /** `range` だが日付が揃っていない。 */
  | { readonly status: "incomplete" }
  /** 終了日が開始日より前にある。 */
  | { readonly status: "reversed" };

/**
 * 選ばれた期間を、集計を求められるかどうかへ写す。
 *
 * @remarks
 * 日付の前後は文字列のまま比べます。暦日の `YYYY-MM-DD` は桁が固定なので、辞書順がそのまま暦の
 * 順になります。`Date` へ直すと、ブラウザの時差で暦日がずれた値どうしを比べることになります。
 *
 * **区分をここで区間へ解きます。** 契約が受け取るのは瞬時の半開区間だけで、「今日」「今月」を
 * 暦の上で解く役は持ちません。
 *
 * @param selection - URL が表している期間の選択
 * @param now - 相対の期間を解く基準の瞬時
 */
export function toPeriodRequest(selection: DashboardPeriodSelection, now: Date): PeriodRequest {
  const period = selection.period ?? DASHBOARD_PERIOD.TODAY;

  if (period === DASHBOARD_PERIOD.TODAY) {
    return { status: "ready", window: todayWindow(now) };
  }

  if (period === DASHBOARD_PERIOD.MONTH) {
    return { status: "ready", window: monthWindow(calendarMonth(now)) };
  }

  const { from, to } = selection;

  if (from === undefined || to === undefined) {
    return { status: "incomplete" };
  }

  return from > to
    ? { status: "reversed" }
    : { status: "ready", window: dateRangeWindow(from, to) };
}

/**
 * 期間を切り替えた先の URL を組む。
 *
 * @remarks
 * 日付を持ち越しません。日付が要る期間は overlay の中で両端を決めてから遷移するため、選択肢を
 * 押しただけの時点では行き先に載せるものがありません。載せたままにすると、効いていない条件が
 * 画面の外（アドレス欄・共有した URL）にだけ残ります。
 */
export function toPeriodHref(period: DashboardPeriod): string {
  return `${ADMIN_ANALYTICS_PATH}?${new URLSearchParams({ [PERIOD_KEY.PERIOD]: period })}`;
}
