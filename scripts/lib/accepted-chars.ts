/**
 * 読み手がシェルへ貼る値に許す文字集合。
 *
 * @remarks
 * **集合はここ 1 箇所だけに置きます。** 判定を呼ぶ側が書き起こすと、片方だけが広がったことに
 * 誰も気付けません。
 */

/** 許す文字。英数と、経路・版・区切りに要る記号だけ。 */
const ACCEPTED_PATTERN = /^[A-Za-z0-9/._,-]*$/;

/**
 * その値がシェルへ貼れないものを含むか。
 *
 * @remarks
 * 落とす側で判定します。「安全なら通す」ではなく「1 つでも外れたら行ごと落とす」向きなので、
 * 呼ぶ側は真を受け取ったらその節を出しません。
 *
 * @param values - 貼る値。1 つでも外れれば真を返す
 */
export function containsUnsafe(...values: readonly string[]): boolean {
  return values.some((value) => !ACCEPTED_PATTERN.test(value));
}
