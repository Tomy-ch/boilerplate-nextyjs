import { BADGE_VARIANT } from "@/components/design-system/display/badge/badge.definition";
import { toProductId } from "@/model/product/product";
import type { AdminProductFilterOption } from "./filter-option";
import type { AdminProductListConditions } from "./query";
import type { AdminProductRow } from "./row";
import { toStatusTone } from "./status-tone";

/**
 * 契約が許す商品名の最大長。
 *
 * @remarks
 * 分類名・状態名に上限の宣言はありません（`src/adapters/gen/api/endpoints.zod.ts`）。上限の無い
 * 項目は、表が折り返しで耐えるかを見ます。
 */
const MAX_NAME_LENGTH = 255;

/** 折り返しの有無を見分けるため、区切りの無い長い語と日本語を混ぜる。 */
function longText(length: number): string {
  const unit = "超高性能ワイヤレスノイズキャンセリングイヤホン-第3世代-ProMaxUltraEdition-";

  return unit.repeat(Math.ceil(length / unit.length)).slice(0, length);
}

/** 選べる分類。「すべて」は候補ではなく、何も選ばれていない状態が表す。 */
export const CATEGORY_OPTIONS: readonly AdminProductFilterOption[] = [
  { value: "1", label: "電子機器" },
  { value: "2", label: "書籍" },
  { value: "4", label: "食品" },
];

/** 選べる状態。 */
export const STATUS_OPTIONS: readonly AdminProductFilterOption[] = [
  { value: "1", label: "在庫あり" },
  { value: "2", label: "在庫切れ" },
  { value: "6", label: "入荷待ち" },
];

/** 何も絞り込んでいない条件。 */
export const NO_CONDITIONS: AdminProductListConditions = {
  keyword: "",
  categoryCodes: [],
  statusCodes: [],
};

/**
 * 一覧に並ぶ商品。
 *
 * @remarks
 * **状態は 4 つの区分がそろうように選んであります。**色の割り当てを 1 画面で見比べられるように
 * するためで、マスタに無いコード（`99`）が縁だけの姿へ倒れることまで含みます。
 */
export const PRODUCT_ROWS = [
  {
    id: toProductId("0195f0c2-0000-7000-8000-000000000001"),
    name: "ワイヤレスイヤホン",
    price: "19.99",
    quantity: 12,
    categoryName: "電子機器",
    statusName: "在庫あり",
    statusTone: toStatusTone(1),
  },
  {
    id: toProductId("0195f0c2-0000-7000-8000-000000000002"),
    name: "スマートウォッチ",
    price: "129.00",
    quantity: 0,
    categoryName: "電子機器",
    statusName: "在庫切れ",
    statusTone: toStatusTone(2),
  },
  {
    id: toProductId("0195f0c2-0000-7000-8000-000000000003"),
    name: "USB-C ハブ",
    price: "45.50",
    quantity: 4,
    categoryName: "電子機器",
    statusName: "入荷待ち",
    statusTone: toStatusTone(6),
  },
  {
    id: toProductId("0195f0c2-0000-7000-8000-000000000004"),
    name: "編組ケーブル 2m",
    price: "0.99",
    quantity: 480,
    categoryName: "食品",
    statusName: "販売終了",
    statusTone: toStatusTone(4),
  },
  {
    id: toProductId("0195f0c2-0000-7000-8000-000000000005"),
    name: "モバイルバッテリー",
    price: "1299.00",
    quantity: 2,
    categoryName: "電子機器",
    statusName: "限定販売",
    statusTone: toStatusTone(10),
  },
  {
    id: toProductId("0195f0c2-0000-7000-8000-000000000006"),
    name: "有線イヤホン",
    price: "12.00",
    quantity: 8,
    categoryName: "電子機器",
    statusName: "新設された状態",
    statusTone: toStatusTone(99),
  },
  {
    id: toProductId("0195f0c2-0000-7000-8000-000000000007"),
    name: "AirPods Pro 第2世代",
    price: "265.33",
    quantity: 192,
    categoryName: "電子機器",
    statusName: "廃番",
    // 廃番はマスタのコードから決まらないため、`toStatusTone` を通さず直に置く。実際の値は
    // `row.ts` が持ち、対応は `row.test.ts` が押さえる。
    statusTone: BADGE_VARIANT.DEFAULT,
  },
] satisfies readonly [AdminProductRow, ...AdminProductRow[]];

/** 契約上の最大長を持つ商品名。列幅を押し広げず折り返すかを見るために置く。 */
export const LONG_NAME_PRODUCT_ROW: AdminProductRow = {
  id: toProductId("0195f0c2-0000-7000-8000-000000000008"),
  name: longText(MAX_NAME_LENGTH),
  price: "19.99",
  quantity: 12,
  categoryName: "電子機器",
  statusName: "在庫あり",
  statusTone: toStatusTone(1),
};
