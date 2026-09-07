import { DEFAULT_TIME_ZONE } from "./locale";

/**
 * 集計や絞り込みが対象にする期間。
 *
 * @remarks
 * **瞬時の半開区間 `[after, before)` です。** 下限は含み、上限は含みません。境界はそれぞれ独立に
 * 省略でき、両方省略すれば全期間になります。
 *
 * 値は**オフセット付きの RFC3339** です。オフセットの無い文字列を送ると、解釈が呼び出し側と
 * 接続先の実装差に落ちます。このモジュールの外で組み立てないのは、その形を作れなくするためです。
 *
 * **この形のまま取得条件へ展開しないでください。** {@link TimeWindow.after} は期間の下限であって、
 * ページ送りのカーソル（契約の `after`）とは別のものです。名前だけが同じなので、展開すると型では
 * 止まらずカーソルが差し替わります。境界は 1 つずつ名前を付けて渡します。
 */
export type TimeWindow = {
  /** 下限。含む。省略すると下限を設けない。 */
  readonly after?: string;
  /** 上限。含まない。省略すると上限を設けない。 */
  readonly before?: string;
};

/** 全期間。境界を持たない。 */
export const WHOLE_TIME: TimeWindow = {};

/** 暦の 1 日を表す年月日。 */
type CalendarDate = {
  readonly year: number;
  readonly month: number;
  readonly day: number;
};

/**
 * 瞬時を、店のタイムゾーンで見たときの暦日（`YYYY-MM-DD`）にする。
 *
 * @remarks
 * 集計が「どの日の話か」を添える画面が使います。区間を組む側と同じ暦の上で解くために公開して
 * います。別々に解くと、境目の時刻に添え書きと集計の対象日が食い違います。
 *
 * @param now - 判定に使う瞬時。呼び出し側が渡す
 */
export function calendarDate(now: Date): string {
  return formatDate(toCalendarDate(now));
}

/** 年月日を `YYYY-MM-DD` へ。桁は暦の表記に合わせて 0 で埋める。 */
function formatDate({ year, month, day }: CalendarDate): string {
  const pad = (value: number, width: number): string => String(value).padStart(width, "0");

  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`;
}

/**
 * 瞬時を、店のタイムゾーンで見たときの暦月（`YYYY-MM`）にする。
 *
 * @remarks
 * 「今月」を解く画面が使います。暦日から切り出さないのは、切り出す桁を呼び出し側ごとに書くと、
 * 1 か所だけ桁を間違えても他が正しく動いてしまうためです。
 *
 * @param now - 判定に使う瞬時。呼び出し側が渡す
 */
export function calendarMonth(now: Date): string {
  return calendarDate(now).slice(0, MONTH_LENGTH);
}

/** 暦月の表記幅。`YYYY-MM`。 */
const MONTH_LENGTH = 7;

/**
 * 瞬時を、店のタイムゾーンで見たときの年月日へ写す。
 *
 * @remarks
 * ランタイムのタイムゾーンを使いません。サーバは配信先の既定（多くは UTC）で動き、ブラウザは
 * 閲覧者の現在地で動くため、「今日」がどの日かが実行場所ごとに変わります
 * （{@link DEFAULT_TIME_ZONE}）。
 */
function toCalendarDate(instant: Date): CalendarDate {
  // `en-CA` は `YYYY-MM-DD` で出る。部位を 1 つずつ拾うより、組み上がった形を読むほうが短い。
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: DEFAULT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);

  return parseDate(date);
}

/** オフセットの表記幅。`±HH:MM`。 */
const OFFSET_LENGTH = 6;

/**
 * その日の店のタイムゾーンでのオフセットを、`+09:00` の形で返す。
 *
 * @remarks
 * 固定の文字列を書かないのは、夏時間を持つ地域へ {@link DEFAULT_TIME_ZONE} を変えたときに、
 * オフセットだけが古いまま残らないようにするためです。
 */
function offsetAt(instant: Date): string {
  const name = new Intl.DateTimeFormat("en-US", {
    timeZone: DEFAULT_TIME_ZONE,
    timeZoneName: "longOffset",
  })
    .formatToParts(instant)
    .filter((part) => part.type === "timeZoneName")
    .map((part) => part.value)
    .join("");

  // 協定世界時だけは `GMT` とだけ名乗り、オフセットを持たない。契約はオフセットを要求するので、
  // `+00:00` を継ぎ足してから `±HH:MM` の幅で採る。差のある地域では継ぎ足しが余りになって落ちる。
  return `${name.replace("GMT", "")}+00:00`.slice(0, OFFSET_LENGTH);
}

/**
 * 年月日を、その日の始まりを指すオフセット付き RFC3339 へ写す。
 *
 * @remarks
 * オフセットは**その日時点**のものを引きます。年を跨いで夏時間の切り替わる地域では、区間の
 * 両端で違うオフセットになり得るためです。
 */
function startOfDay(calendar: CalendarDate): string {
  const date = formatDate(calendar);

  const noon = new Date(`${date}T12:00:00Z`);

  return `${date}T00:00:00${offsetAt(noon)}`;
}

/**
 * 年月日を暦の上で動かす。
 *
 * @remarks
 * **`Date.UTC` の上で動かします。** `date-fns` の日付演算はランタイムのタイムゾーンで境界を
 * 解決するため、実行場所によって答えが変わります。このリポジトリは表示も集計も
 * {@link DEFAULT_TIME_ZONE} に固定しており、ランタイムへの依存をここで持ち込むと、その固定が
 * 意味を失います。閏年と月末の繰り上げは `Date.UTC` が持っています。
 */
function shift({ year, month, day }: CalendarDate, months: number, days: number): CalendarDate {
  const moved = new Date(Date.UTC(year, month - 1 + months, day + days));

  return { year: moved.getUTCFullYear(), month: moved.getUTCMonth() + 1, day: moved.getUTCDate() };
}

/**
 * 暦月 1 つを対象にする窓。
 *
 * @remarks
 * 上限は**翌月 1 日の始まり**です。末日の 23:59:59 を上限に置くと、その日の最後の 1 秒に入った
 * 対象が落ちます。
 *
 * @param month - `YYYY-MM`
 */
export function monthWindow(month: string): TimeWindow {
  const first = parseDate(month);

  return { after: startOfDay(first), before: startOfDay(shift(first, 1, 0)) };
}

/**
 * 開始日と終了日で挟む窓。**どちらの日も含みます。**
 *
 * @remarks
 * 上限は終了日の**翌日の始まり**です。利用者が選ぶのは日であって瞬時ではないので、選んだ日の
 * 24 時間すべてが対象になります。
 *
 * @param from - `YYYY-MM-DD`。含む
 * @param to - `YYYY-MM-DD`。含む
 */
export function dateRangeWindow(from: string, to: string): TimeWindow {
  return {
    after: startOfDay(parseDate(from)),
    before: startOfDay(shift(parseDate(to), 0, 1)),
  };
}

/**
 * 今日から遡る日数を対象にする窓。
 *
 * @remarks
 * **今日を含めて数えます。** 「直近 7 日」は今日と、その前の 6 日です。上限は明日の始まりで、
 * 今日の残りに入る分も含みます。
 *
 * @param days - 遡る日数。1 以上
 * @param now - いまの瞬時。呼び出し側が渡す
 */
export function recentDaysWindow(days: number, now: Date): TimeWindow {
  const today = toCalendarDate(now);

  return {
    after: startOfDay(shift(today, 0, -(days - 1))),
    before: startOfDay(shift(today, 0, 1)),
  };
}

/**
 * 今日 1 日を対象にする窓。
 *
 * @param now - いまの瞬時。呼び出し側が渡す
 */
export function todayWindow(now: Date): TimeWindow {
  return recentDaysWindow(1, now);
}

/**
 * 暦月 1 つを表す形。`YYYY-MM`。
 *
 * @remarks
 * 契約はもう月を受け取りません。区分を組み立てるのは画面の側なので、形を決めるのもこちらです。
 * 入力欄が送る前に確かめるために公開します。
 */
export const CALENDAR_MONTH_PATTERN = /^\d{4}-(?:0[1-9]|1[0-2])$/;

/** `YYYY-MM-DD` / `YYYY-MM` を受ける形。日が無ければ月初として読む。 */
const CALENDAR_DATE_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])(?:-(0[1-9]|[12]\d|3[01]))?$/;

/**
 * `YYYY-MM-DD` または `YYYY-MM` を年月日へ写す。
 *
 * @remarks
 * **読めない文字列は投げます。** 既定値へ倒すと、URL を手で書き換えた利用者に対して、年 0 の
 * 区間という誰も意図していない条件が組み上がります。
 *
 * @throws 形が合わないとき
 */
function parseDate(date: string): CalendarDate {
  const matched = CALENDAR_DATE_PATTERN.exec(date);

  if (matched === null) {
    throw new Error(`暦の日付として読めません: ${date}`);
  }

  const [, year, month, day] = matched;

  return { year: Number(year), month: Number(month), day: Number(day ?? "01") };
}
