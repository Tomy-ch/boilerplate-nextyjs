/**
 * 台数で割った実行の結果が、全台ぶん届いているか。
 *
 * @remarks
 * **束ねる側が台数を宣言しません。** 各台が書いた名前が既に台数を持っているので、束ねる側が
 * 数字を書き写すと、それが古びる 2 つ目の宣言になります。
 *
 * 足りないまま束ねると、走らなかったぶんが「結果が悪い」として現れます。原因を取り違えるので、
 * 束ねる前に落とします。
 */

/**
 * 名前から台数を読む。
 *
 * @remarks
 * **綴りを知っているのは、名前を付けた当人だけです。** 計測は
 * [`scripts/lighthouse/shard.ts`](../lighthouse/shard.ts) が、テストは
 * `.makefiles/testing/test.mk` が名前を組み立てるので、読み戻しもそれぞれが持ちます。ここが
 * 持つのは「揃っているか」の判定だけで、綴りを覚えると名前の付け方を変えたときに黙って古びます。
 *
 * @param fileName - 置き場にあるファイルの名前（パスではない）
 * @returns 台数。その台が書いた結果でなければ `undefined`
 */
export type ShardTotalReader = (fileName: string) => number | undefined;

/**
 * 届いた結果が全台ぶん揃っているかを、綴りだけから確かめる。
 *
 * @remarks
 * 揃っていなければ throw します。**返り値で伝えません** —— 束ねる処理は「揃っている」を前提に
 * 組まれており、判定を読み飛ばした呼び出しが黙って先へ進む形にはできません。
 *
 * 文面は 4 つの失敗を区別します。1 台も届かない・台数の宣言が食い違う・数が足りない・数が多い
 * （古い結果が残っている）で、次にやることが違うためです。呼ぶ側が場面ごとの補足を足せるよう、
 * ここは何が起きたかだけを言います。
 *
 * @param fileNames - 置き場にあるファイルの名前（パスではない）
 * @param readTotal - 名前から台数を読む手立て
 * @returns 割った台数
 */
export function expectedShardTotal(
  fileNames: readonly string[],
  readTotal: ShardTotalReader,
): number {
  const totals = new Set<number>();
  let found = 0;

  for (const name of fileNames) {
    const total = readTotal(name);

    if (total === undefined) {
      continue;
    }

    totals.add(total);
    found += 1;
  }

  const [total, ...others] = [...totals];

  if (total === undefined) {
    throw new Error("分割の結果が 1 台ぶんも届いていません");
  }

  if (others.length > 0) {
    throw new Error(
      `届いた結果が別々の台数で割られています: ${[...totals].sort((a, b) => a - b).join(", ")}`,
    );
  }

  // 数が合わない向きで文面を分ける。多く届いているのに「しか届いていません」と言うと、
  // 読み手は足りない台を探すことになる。多いほうは古い結果が残っている形である。
  if (found < total) {
    throw new Error(`分割 ${total} 台のうち ${found} 台ぶんしか結果が届いていません`);
  }

  if (found > total) {
    throw new Error(`分割 ${total} 台に対し ${found} 台ぶんの結果が届いています`);
  }

  return total;
}
