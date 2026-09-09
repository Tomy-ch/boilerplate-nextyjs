import { DEFAULT_LOCALE } from "@/model/locale";

const formatters = new Map<string, Intl.NumberFormat>();

function formatterOf(locale: string): Intl.NumberFormat {
  let formatter = formatters.get(locale);

  if (formatter === undefined) {
    formatter = new Intl.NumberFormat(locale);
    formatters.set(locale, formatter);
  }

  return formatter;
}

/**
 * 件数を locale に沿った表記にする。
 *
 * @remarks
 * この feature だけが使う整形なので feature 内に置いています。2 つ目の feature が同じ整形を要する
 * 段で `model` へ上げます。
 *
 * @param count - 件数
 * @param locale - 用いる locale。省略時は {@link DEFAULT_LOCALE}
 */
export function formatCount(count: number, locale: string = DEFAULT_LOCALE): string {
  return formatterOf(locale).format(count);
}
