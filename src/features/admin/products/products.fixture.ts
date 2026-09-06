import type { Product } from "@/model/product/product";
import { toProductId } from "@/model/product/product";
import type { ProductSelectOption } from "./ui/select-field/select-field";

/** 分類の識別子。商品の分類と候補の並びで同じものを指す。 */
export const CATEGORY_ID = "01936f6d-0000-7000-8000-000000000001";

/** 状態の識別子。候補の並びと商品の状態を結ぶためだけに使う。 */
const STATUS_ID = "01936f6d-0000-7000-8000-000000000101";

/** 選べる分類。 */
export const CATEGORY_OPTIONS: readonly ProductSelectOption[] = [
  { value: CATEGORY_ID, label: "電子機器" },
  { value: "01936f6d-0000-7000-8000-000000000002", label: "書籍" },
  { value: "01936f6d-0000-7000-8000-000000000004", label: "食品" },
];

/** 選べる状態。 */
export const STATUS_OPTIONS: readonly ProductSelectOption[] = [
  { value: STATUS_ID, label: "在庫あり" },
  { value: "01936f6d-0000-7000-8000-000000000102", label: "在庫切れ" },
  { value: "01936f6d-0000-7000-8000-000000000106", label: "入荷待ち" },
];

/** 4 MiB。config が配る既定と同じ値を、story でも同じ意味で使う。 */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

/** 編集の対象として読み込んだ商品。説明は表示側と同じ経路を通る HTML で持つ。 */
export const SAMPLE_PRODUCT: Product = {
  id: toProductId("0195f0c2-0000-7000-8000-000000000001"),
  name: "ワイヤレスイヤホン",
  description: "<h2>特長</h2><ul><li>ノイズキャンセリング</li><li>最長 30 時間の再生</li></ul>",
  price: "19.99",
  quantity: 12,
  stockWarningThreshold: 3,
  status: { id: STATUS_ID, name: "在庫あり" },
  category: { id: CATEGORY_ID, name: "電子機器" },
  publishedAt: new Date("2026-08-07T09:00:00.000Z"),
  discontinuedAt: null,
  imagePaths: [],
  version: 4,
};
