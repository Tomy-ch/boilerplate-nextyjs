import { DEFAULT_LOCALE, DEFAULT_TIME_ZONE } from "./locale";

/** 用意している表示の粒度。 */
const STYLE = {
  /** 日付と時刻。 */
  dateTime: { dateStyle: "medium", timeStyle: "short" },
  /** 日付だけ。 */
  date: { dateStyle: "medium" },
  /** 時刻だけ。 */
  time: { timeStyle: "short" },
} as const satisfies Readonly<Record<string, Intl.DateTimeFormatOptions>>;

type StyleName = keyof typeof STYLE;

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterOf(locale: string, style: StyleName): Intl.DateTimeFormat {
  const key = `${style}:${locale}`;
  let formatter = formatters.get(key);

  if (formatter === undefined) {
    formatter = new Intl.DateTimeFormat(locale, {
      ...STYLE[style],
      timeZone: DEFAULT_TIME_ZONE,
    });
    formatters.set(key, formatter);
  }

  return formatter;
}

/**
 * 日時を locale に沿った文字列にする。
 *
 * @remarks
 * `Intl.DateTimeFormat` の生成は locale と粒度の組ごとに 1 度だけ行い、以降は使い回します。
 * 生成には locale データの解決が伴うため、描画ごとに作ると件数に比例して積み上がります。
 *
 * タイムゾーンは {@link DEFAULT_TIME_ZONE} に固定します。ランタイムに任せると、サーバで描画した
 * 文字列とブラウザで描画した文字列が実行場所ぶんずれます。
 *
 * @param value - 表示する日時
 * @param locale - 用いる locale。省略時は {@link DEFAULT_LOCALE}
 */
export function formatDateTime(value: Date, locale: string = DEFAULT_LOCALE): string {
  return formatterOf(locale, "dateTime").format(value);
}

/**
 * 日付だけを locale に沿った文字列にする。
 *
 * @remarks
 * 固定したタイムゾーンで丸めた日付なので、**同じ日かどうかの判定にそのまま使えます**。時刻を
 * 落とした `Date` を作って比べる形にすると、丸める側と表示する側で別々にタイムゾーンを扱う
 * ことになります。
 */
export function formatDate(value: Date, locale: string = DEFAULT_LOCALE): string {
  return formatterOf(locale, "date").format(value);
}

/** 時刻だけを locale に沿った文字列にする。日付は呼び出し側が別に示す。 */
export function formatTime(value: Date, locale: string = DEFAULT_LOCALE): string {
  return formatterOf(locale, "time").format(value);
}
