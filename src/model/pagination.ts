/**
 * cursor 方式で取得した 1 ページ。
 *
 * @remarks
 * 総件数もページ数も持ちません。cursor は「次の位置」を指すだけの不透明な値であり、全体が何件
 * あるかも、任意の位置へ跳ぶ手段も表現しないためです。
 * 「全 N 件中 M 件」を出す一覧は、件数を返す別の取得経路を必要とします。
 *
 * 次ページの有無を真偽値で併せ持たないのは、`nextCursor` が `null` であることと同義になるためです。
 * 2 つ持つと、片方だけを見た実装と両方を見た実装が混在し、食い違ったときにどちらが正か決まりません。
 */
export type CursorPage<T> = {
  /** このページに含まれる要素。 */
  readonly items: readonly T[];
  /** 次ページの取得に渡すカーソル。次が無ければ null。 */
  readonly nextCursor: string | null;
};

/**
 * 読み込み済みのページに次のページを継ぎ足す。
 *
 * @remarks
 * 増分取得の一覧が積み上げた状態を作ります。継ぎ足した結果の `nextCursor` は常に後から来た側の
 * ものです。先頭側を残すと、同じページを取り直し続けて終端に到達しません。
 *
 * 要素の重複は取り除きません。cursor 方式は挿入・削除に対して境界が安定しているため、
 * 重複が出るのは取得元が cursor の約束を守っていない場合であり、それを表示層で吸収すると
 * 契約違反が見えなくなります。
 *
 * @param loaded - すでに読み込んであるページ
 * @param next - 継ぎ足すページ
 */
export function appendCursorPage<T>(loaded: CursorPage<T>, next: CursorPage<T>): CursorPage<T> {
  return {
    items: [...loaded.items, ...next.items],
    nextCursor: next.nextCursor,
  };
}

/**
 * offset 方式で取得した 1 ページ。
 *
 * @remarks
 * {@link CursorPage} と別に持ちます。offset は「先頭から何件目か」という位置そのものなので、
 * 全体の件数も任意のページへ跳ぶ手段も表現できます。cursor 方式にはそれが無く、同じ型で
 * 両方を表すと、片方では常に空になる項目が残ります。
 *
 * ページ番号を持たず位置で持つのは、契約が返すのが位置だからです。番号は位置と 1 ページの
 * 件数から導けますが（{@link toPageNumber}）、逆に番号を持って位置を捨てると、件数を変えた
 * ときに元の位置へ戻れません。
 */
export type OffsetPage<T> = {
  /** このページに含まれる要素。 */
  readonly items: readonly T[];
  /** 絞り込みを適用した後の全件数。 */
  readonly total: number;
  /** 1 ページあたりの件数。 */
  readonly perPage: number;
  /** このページの先頭が全体の何件目か。0 から数える。 */
  readonly offset: number;
};

/**
 * 位置を 1 から数えるページ番号へ直す。
 *
 * @remarks
 * 1 ページの件数が 0 以下なら 1 を返します。0 除算を画面へ運ばないためで、割る数が 0 になるのは
 * 契約が最小 1 を要求する値を欠いたときだけです。
 */
export function toPageNumber(offset: number, perPage: number): number {
  if (perPage <= 0) {
    return 1;
  }

  return Math.floor(offset / perPage) + 1;
}

/**
 * 全件数を、最後のページ番号へ直す。
 *
 * @remarks
 * 1 件も無くても 1 を返します。ページが 0 枚の一覧は表せず、「1 ページ目が空」として扱うのが
 * 位置の数え方と矛盾しないためです。
 *
 * 1 ページの件数が 0 以下のときも 1 を返します（{@link toPageNumber} と同じ理由）。
 */
export function toPageCount(total: number, perPage: number): number {
  if (perPage <= 0) {
    return 1;
  }

  return Math.max(1, Math.ceil(total / perPage));
}
