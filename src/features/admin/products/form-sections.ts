import type { FieldErrors } from "@/model/action-state";

import type { ProductFormField } from "./form-state";
import type { ProductValidatedField } from "./product-rules";

/**
 * 商品のフォームが持つ段。
 *
 * @remarks
 * 並び順がそのまま画面の並びになります。段を器（wizard / tabs）が並べるとき、順序はここが正です。
 *
 * 確認は作る画面にしかないため含めません。段の中身を共有する編集の側には無い段を、共有の並びへ
 * 入れると、編集の器が出せない段を数えることになります。
 */
export const PRODUCT_FORM_SECTIONS = ["basics", "description", "images", "publish"] as const;

/** 段の識別子。 */
export type ProductFormSection = (typeof PRODUCT_FORM_SECTIONS)[number];

/**
 * 段の呼び名。
 *
 * @remarks
 * 段を追う画面も観点で切り替える画面も同じ呼び名を出します。画面ごとに書くと、呼び名を変えた
 * ときに直し漏れた画面だけが違う名前で同じ段を指します。
 */
export const PRODUCT_SECTION_TITLES = {
  basics: "基本情報",
  description: "説明",
  images: "画像",
  publish: "公開",
} as const satisfies Readonly<Record<ProductFormSection, string>>;

/**
 * 入力欄が並ぶ順。
 *
 * @remarks
 * 誤りの要約もこの順で出します。誤った順・見つけた順に出すと、直しに行く順序が画面の並びと
 * 食い違います。
 */
export const PRODUCT_FIELD_ORDER = [
  "name",
  "price",
  "quantity",
  "stockWarningThreshold",
  "categoryId",
  "description",
  "images",
  "statusId",
  "publishedAt",
] as const satisfies readonly ProductFormField[];

/**
 * どの項目がどの段にあるか。
 *
 * @remarks
 * **対応はここだけが持ちます。**段から項目を引く用（段を進めてよいかの判定）と、項目から段を
 * 引く用（誤りのある段へ移る判定）の両方が要りますが、両方を宣言すると片方だけ古くなります。
 * 片方を宣言し、もう片方は導きます。
 */
const SECTION_OF_FIELD = {
  name: "basics",
  price: "basics",
  quantity: "basics",
  stockWarningThreshold: "basics",
  categoryId: "basics",
  description: "description",
  images: "images",
  statusId: "publish",
  publishedAt: "publish",
} as const satisfies Readonly<Record<ProductFormField, ProductFormSection>>;

/** その段に属する、形の上での判定を持つ項目。 */
export function validatedFieldsOf(
  section: ProductFormSection,
  validated: readonly ProductValidatedField[],
): readonly ProductValidatedField[] {
  return validated.filter((field) => SECTION_OF_FIELD[field] === section);
}

/**
 * 誤りを含む最初の段を返す。無ければ undefined。
 *
 * @remarks
 * 段を切り替えられる器は、送信が弾かれたときにここへ移ります。誤りのある欄が隠れたままだと、
 * 画面のどこも赤くないのに送信だけが通らない状態になります。
 */
export function findFirstInvalidSection(
  fieldErrors: FieldErrors<ProductFormField> | undefined,
): ProductFormSection | undefined {
  if (fieldErrors === undefined) return undefined;

  for (const field of PRODUCT_FIELD_ORDER) {
    if (fieldErrors[field] !== undefined) return SECTION_OF_FIELD[field];
  }

  return undefined;
}

/**
 * 項目から入力欄の `id` の後ろ半分へ。
 *
 * @remarks
 * 送信時の名前とは別に持ちます。名前は契約の綴りに従い、`id` は kebab-case という別々の規則に
 * 従うためです。
 *
 * **入力欄を組む側も、誤りの要約が宛先を組む側も、ここから導きます。**片方に書き写すと、
 * 綴りを直した側だけが繋がらなくなり、要約の link が存在しない宛先を指します。型では捕まりません。
 */
const CONTROL_SUFFIXES = {
  name: "name",
  price: "price",
  quantity: "quantity",
  stockWarningThreshold: "stock-warning-threshold",
  categoryId: "category",
  description: "description",
  images: "images",
  statusId: "status",
  publishedAt: "published-at",
} as const satisfies Readonly<Record<ProductFormField, string>>;

/** 入力欄の `id` を組む。前置きは同じフォームを 2 度置いても衝突しないよう呼び出し元が採番する。 */
export function controlIdOf(idPrefix: string, field: ProductFormField): string {
  return `${idPrefix}-${CONTROL_SUFFIXES[field]}`;
}
