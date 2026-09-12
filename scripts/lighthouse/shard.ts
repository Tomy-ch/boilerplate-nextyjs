import { expectedShardTotal } from "../lib/shard-completeness";

/**
 * 計測を台数で割る。
 *
 * @remarks
 * **1 台の中で並べません。** 測っているのは CPU 律速の値（TBT / LCP）で、同じ機械で計測を
 * 並べると互いの CPU を奪い合い、予算と照らす意味が消えます。しかも壊れ方が実行ごとに違うため、
 * 「たまに超える」ゲートになります。割るのは機械であって、機械の中ではありません。
 *
 * **綴りの組み立て・選り分け・読み戻しはこのモジュールだけが持ちます。** 揃っているかどうかの
 * 判定は [`scripts/lib/shard-completeness.ts`](../lib/shard-completeness.ts) へ委ねます。どちらかを
 * 呼び出し側が書き起こすと、名前の付け方を変えたときに片方だけが古びます —— しかも黙って
 * 古びます。選り分けが外れた結果は合流の対象から落ちるだけで、台数の突合は「揃っている」と
 * 答えるためです。
 */

export type Shard = {
  /** 何台目か。1 始まり。 */
  readonly index: number;
  /** 何台に割ったか。 */
  readonly total: number;
};

const SHARD_PATTERN = /^([1-9]\d*)\/([1-9]\d*)$/;

/**
 * 分割の指定を読む。書式は Playwright / Vitest の `--shard` と同じ「台目 / 台数」。
 *
 * @remarks
 * 案内の綴りに山括弧を使いません。SAST が「変数を挿した HTML に見える文字列」として拾い、
 * 0 件を保つゲートが落ちます。実例を挙げるほうが、書式の記法より読む側に速く届きます。
 */
export function parseShard(spec: string): Shard {
  const matched = SHARD_PATTERN.exec(spec.trim());

  if (matched === null) {
    throw new Error(`分割の指定が読めません: ${spec}（「1/4」のように渡してください）`);
  }

  const index = Number(matched[1]);
  const total = Number(matched[2]);

  if (index > total) {
    throw new Error(`分割の指定が範囲の外です: ${spec}（${total} 台に ${index} 台目はありません）`);
  }

  return { index, total };
}

/**
 * この台が担当するぶんを取り出す。
 *
 * @remarks
 * 前から順に切らず、1 つ飛ばしで配ります。画面ごとに計測の重さが違うため、続きで切ると重い画面が
 * 同じ台へ固まり、その台だけが長引きます。飛ばして配ると重さが台へ散ります。
 */
export function selectShard<T>(items: readonly T[], shard: Shard): T[] {
  return items.filter((_, position) => position % shard.total === shard.index - 1);
}

/** この台の結果を書き出す名前。台数を綴りに持たせ、束ねる側が読み戻せるようにする。 */
export function shardFileName(shard: Shard): string {
  return `measurements-${shard.index}-${shard.total}.json`;
}

const FILE_PATTERN = /^measurements-([1-9]\d*)-([1-9]\d*)\.json$/;

/**
 * その名前が、台の書いた結果かどうか。
 *
 * @remarks
 * 綴りの所有についてはこのファイル冒頭の `@remarks` を参照。
 */
export function isShardFile(fileName: string): boolean {
  return FILE_PATTERN.test(fileName);
}

/**
 * 届いた結果が全台ぶん揃っているかを、綴りだけから確かめる。
 *
 * @remarks
 * 渡すのは綴りの読み方だけで、揃っているかの判定は
 * [`scripts/lib/shard-completeness.ts`](../lib/shard-completeness.ts) が持ちます（このファイル
 * 冒頭の `@remarks`）。テストの分割も同じ判定を呼びます。
 *
 * 足りないまま束ねると、測らなかった画面が「予算の緩和が宣言されているのに居ない画面」として
 * 現れます。原因を取り違えるので、束ねる前に落とします。
 *
 * @param fileNames - 置き場にあるファイルの名前（パスではない）
 * @returns 割った台数
 */
export function expectedTotal(fileNames: readonly string[]): number {
  return expectedShardTotal(fileNames, (name) => {
    const matched = FILE_PATTERN.exec(name);

    return matched === null ? undefined : Number(matched[2]);
  });
}
