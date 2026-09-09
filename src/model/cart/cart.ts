import type { ProductId } from "../product/product";

/**
 * カート明細の再評価結果。
 *
 * @remarks
 * カートを取得するたびに、バックエンドが明細と商品の現在値を突き合わせて立てます。判定そのものは
 * 業務ロジックであり、表示側は結果を受け取るだけです。
 *
 * 1 つの明細に複数立つことがあります。
 */
export type CartLineIssue =
  /** 商品を引けない。取り除く以外にできることが無い。 */
  | "notFound"
  /** 公開が止まっている。 */
  | "unpublished"
  /**
   * 廃番になった。
   *
   * `unpublished` とは同時に立たない。廃番は非公開でもあるが、より具体的なこちらだけが立つ。
   */
  | "discontinued"
  /** 在庫が無い。 */
  | "outOfStock"
  /** 在庫が数量に足りない。今買える数は `availableQuantity` が持つ。 */
  | "insufficientStock"
  /** カートへ入れた時点より値上がりした。 */
  | "priceIncreased"
  /** カートへ入れた時点より値下がりした。 */
  | "priceDecreased";

/** カートに入っている 1 行。 */
export type CartLine = {
  readonly productId: ProductId;
  /** 商品名。商品を引けなければ（`notFound`）null。 */
  readonly name: string | null;
  /**
   * 代表画像の表示 URL。持たなければ null。
   *
   * @remarks
   * **null の理由は 2 通りあり、区別しません。** 商品を引けなかった明細も、画像を 1 枚も持たない
   * 商品も、利用者から見れば「出す絵が無い」という同じ状態です。
   */
  readonly imageUrl: string | null;
  /**
   * 取得時点の単価。USD の decimal 文字列のまま持つ。商品を引けなければ null。
   *
   * 購入時の金額を拘束しない。請求額を確定するのは購入の側である。
   */
  readonly unitPrice: string | null;
  readonly quantity: number;
  /** 再評価の結果。空なら現時点で購入できる。 */
  readonly issues: readonly CartLineIssue[];
  /** 在庫が足りない場合に、今買える上限。それ以外は null。 */
  readonly availableQuantity: number | null;
};

/**
 * ゲストのカートを引き継いだ結果。
 *
 * @remarks
 * 報告するのは**引き継ぎで失われた分だけ**です。引き継ぎ後の中身はカートの取得でいつでも引ける一方、
 * 失われた分はこの結果でしか判りません。
 *
 * 引き継ぎそのものは失敗しません。引き継ぐものが無かった場合も、両方が空の結果になります。
 */
export type CartMergeResult = {
  /** 数量が上限を超え、上限へ丸められた商品。 */
  readonly clampedProductIds: readonly ProductId[];
  /** 明細数の上限を超え、取り込まれなかった商品。 */
  readonly droppedProductIds: readonly ProductId[];
};

/**
 * 画面が扱うカート。
 *
 * @remarks
 * 明細も小計もバックエンドが持ちます。手元に写して持ち回ると、在庫切れと値上がりに気づけないまま
 * 購入確認へ渡ることになります。
 */
export type Cart = {
  readonly lines: readonly CartLine[];
  /**
   * 小計。USD セント単位の整数。
   *
   * `issues` が空の明細だけを合算した**参考値**であり、請求額ではない。買えない明細を含めた
   * 合計は存在しない（買えないものに値段を付ける意味が無い）。
   */
  readonly subtotalAmount: number;
};
