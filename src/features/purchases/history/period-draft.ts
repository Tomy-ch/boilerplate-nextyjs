import { CALENDAR_MONTH_PATTERN } from "@/model/time-window";

import { MAX_RECENT_DAYS, type PeriodSelection } from "./period";

/** 区分を選び直した直後に入っている日数。 */
export const DEFAULT_RECENT_DAYS = 30;

/**
 * 組み立て中の期間の条件。
 *
 * @remarks
 * **効いている条件（{@link PeriodSelection}）とは別の形です。** 利用者は開始日だけを入れた状態を
 * 経由しますが、その途中の姿は契約が受け取れる条件ではありません。同じ型で表すと、区分ごとの
 * 必須が欠けた条件を作れることになり、判別可能 union で塞いだ意味が無くなります。
 *
 * 区分を跨いで値を保持します。暦月へ切り替えてから期間へ戻したときに、入れ直しにならないためです。
 */
export type PeriodDraft = {
  readonly kind: PeriodSelection["kind"];
  readonly month: string;
  readonly from: string;
  readonly to: string;
  readonly days: number;
};

/** 効いている条件を、入力欄の初期値へ直す。 */
export function toPeriodDraft(period: PeriodSelection): PeriodDraft {
  return {
    kind: period.kind,
    month: period.kind === "month" ? period.month : "",
    from: period.kind === "range" ? period.from : "",
    to: period.kind === "range" ? period.to : "",
    days: period.kind === "recent" ? period.days : DEFAULT_RECENT_DAYS,
  };
}

/**
 * 組み立て中の条件を、絞り込める条件へ直す。
 *
 * @remarks
 * **足りていなければ `null` を返します。** 必須が欠けたまま送ると契約は 400 を返し、一覧そのものが
 * 出せなくなります。押せるかどうかをこの値で決めることで、送れない条件を送る経路が残りません。
 *
 * 終了日が開始日より前かどうかもここで見ます（理由は {@link toPeriodSelection}）。押した後に
 * 一覧が消えるより、押せない理由をその場に出すほうが直せます。
 */
export function toAppliedPeriod(draft: PeriodDraft): PeriodSelection | null {
  if (draft.kind === "all") {
    return { kind: "all" };
  }

  if (draft.kind === "month") {
    return CALENDAR_MONTH_PATTERN.test(draft.month) ? { kind: "month", month: draft.month } : null;
  }

  if (draft.kind === "range") {
    if (draft.from === "" || draft.to === "" || draft.to < draft.from) {
      return null;
    }

    return { kind: "range", from: draft.from, to: draft.to };
  }

  if (!Number.isInteger(draft.days) || draft.days < 1 || draft.days > MAX_RECENT_DAYS) {
    return null;
  }

  return { kind: "recent", days: draft.days };
}

/**
 * まだ条件として成り立っていない理由を、利用者の言葉で表す。
 *
 * @remarks
 * 成り立っていれば `null` を返します。確定を押せなくするだけでは、何を入れれば押せるのかが
 * 画面から読み取れません。判定と同じ場所に置くのは、片方だけを直した画面（押せないのに理由が
 * 出ない、または理由が実際の判定とずれている）を作らないためです。
 */
export function describeMissing(draft: PeriodDraft): string | null {
  if (toAppliedPeriod(draft) !== null) {
    return null;
  }

  if (draft.kind === "month") {
    return "対象の月を選ぶと絞り込めます。";
  }

  if (draft.kind === "range") {
    return "開始日と、それ以降の終了日を選ぶと絞り込めます。";
  }

  return "遡る日数を選ぶと絞り込めます。";
}
