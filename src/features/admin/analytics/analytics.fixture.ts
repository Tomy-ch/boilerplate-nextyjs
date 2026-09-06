import { toProductId } from "@/model/product/product";
import type { AdminRankingRow } from "./ranking-rows";

/**
 * 売れ筋として並ぶ商品。
 *
 * @remarks
 * 実測した契約の応答と同じ顔ぶれです。価格は decimal 文字列のまま持ちます —— 数値へ直すと
 * サブセントの桁が落ち、契約が返した値と別の数を並べることになります。
 */
export const RANKING_ROWS: readonly AdminRankingRow[] = [
  {
    id: toProductId("0195f0c2-3000-7000-8000-000000000001"),
    rank: 1,
    name: "バゲット 1本",
    price: "1.99",
    soldQuantity: 5,
  },
  {
    id: toProductId("0195f0c2-3000-7000-8000-000000000002"),
    rank: 2,
    name: "チームトポロジー",
    price: "17.6",
    soldQuantity: 4,
  },
  {
    id: toProductId("0195f0c2-3000-7000-8000-000000000003"),
    rank: 3,
    name: "リーバイス 501 オリジナルフィット",
    price: "102.67",
    soldQuantity: 3,
  },
  {
    id: toProductId("0195f0c2-3000-7000-8000-000000000004"),
    rank: 4,
    name: "MONSTER 完全版 1",
    price: "8",
    soldQuantity: 3,
  },
  {
    id: toProductId("0195f0c2-3000-7000-8000-000000000005"),
    rank: 5,
    name: "スナップエンドウ 150g",
    price: "2.19",
    soldQuantity: 3,
  },
];
