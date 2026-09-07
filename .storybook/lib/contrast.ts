/** sRGB の 1 チャンネル（0〜255）を、輝度の計算に使う線形の値へ戻す。 */
function toLinear(value: number): number {
  const channel = value / 255;

  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

/**
 * `rgb()` 表記の色を相対輝度へ変える。
 *
 * @remarks
 * 読み取るのは数値の並びだけです。解決されていない `color-mix()` や名前で書かれた色は数値を
 * 持たないため、読めなかったこととして扱います。透明度は輝度に効かないので、4 つ目以降は捨てます。
 *
 * **3 つ揃っているかを別に数えません。** 足りない位置は `undefined` を数に直した `NaN` として現れ、
 * 数として読めない値と同じ判定に落ちます。数えると、同じことを 2 通りに書いたぶんだけ、片方を
 * 消しても誰も気づかない分岐が残ります。
 *
 * @returns 読み取れなければ null
 */
function relativeLuminance(color: string): number | null {
  const found = color.match(/[\d.]+/g);

  if (found === null) {
    return null;
  }

  const [red, green, blue] = [Number(found[0]), Number(found[1]), Number(found[2])];

  if (Number.isNaN(red) || Number.isNaN(green) || Number.isNaN(blue)) {
    return null;
  }

  return 0.2126 * toLinear(red) + 0.7152 * toLinear(green) + 0.0722 * toLinear(blue);
}

/**
 * 2 色のコントラスト比。
 *
 * @remarks
 * WCAG の定義（明るい側と暗い側の相対輝度に 0.05 を足した比）に従います。**どちらを先に渡しても
 * 同じ値**になり、白と黒なら 21 です。
 *
 * **合否を決める値ではありません。** この repo で a11y の合否を負うのは axe の自動検査で、
 * ここが出すのは配色を見る人が地との差を読み取るための数値です。
 *
 * @returns どちらかの色を読み取れなければ null
 */
export function contrastRatio(a: string, b: string): number | null {
  const [x, y] = [relativeLuminance(a), relativeLuminance(b)];

  if (x === null || y === null) {
    return null;
  }

  const [high, low] = x > y ? [x, y] : [y, x];

  return (high + 0.05) / (low + 0.05);
}
