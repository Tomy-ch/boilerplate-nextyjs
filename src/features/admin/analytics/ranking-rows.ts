import type { ProductId, ProductRankingEntry } from "@/model/product/product";

/** ランキングの表に並べる 1 行。 */
export type AdminRankingRow = {
  readonly id: ProductId;
  /** 契約が返した並びの中での位置。 */
  readonly rank: number;
  readonly name: string;
  /** 基準通貨の decimal 文字列。数値へ直すとサブセントの桁が落ちる。 */
  readonly price: string;
  readonly soldQuantity: number;
};

/**
 * ランキングを表の行へ写す。
 *
 * @remarks
 * 順位は並びの位置をそのまま数にしたものです。販売数量から順位を決め直してはいません。同順位の
 * 扱いを決めているのは契約の側で、画面が数え直すとその規則が 2 か所に分かれます。
 */
export function toRankingRows(entries: readonly ProductRankingEntry[]): readonly AdminRankingRow[] {
  return entries.map((entry, index) => ({
    id: entry.productId,
    rank: index + 1,
    name: entry.name,
    price: entry.price,
    soldQuantity: entry.soldQuantity,
  }));
}
