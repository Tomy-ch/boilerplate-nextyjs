"use client";

import dynamic from "next/dynamic";

import type { ProductConfirmDetailsProps } from "./confirm-details";

/** `ProductConfirmSection` の props。中身へそのまま渡す。 */
export type ProductConfirmSectionProps = ProductConfirmDetailsProps;

/**
 * 中身は、最初に読む一式から外す。
 *
 * @remarks
 * 静的に import すると、**書いた HTML を検査する仕組み一式（`model/rich-text` の parser と
 * sanitizer）が商品フォームの最初の読み込みに乗ります**。同梱サンプルの実測で gzip 66.7 KB
 * （自動では検証されない目安）。
 *
 * `wizard-form.tsx` は入力値を form へ残すため全段を `hidden` で DOM に保持しており、この段も
 * 他の段を入力している間から読み込みが始まります。
 *
 * **`ssr: false` で読めます。** この段は入力欄を持たない読み取り専用の要約で、`hidden` で隠れた
 * まま立ち上がるため、届くまでの枠も見えません。
 */
const ProductConfirmDetails = dynamic(
  () => import("./confirm-details").then((module) => module.ProductConfirmDetails),
  { ssr: false },
);

/**
 * 確認の段。
 *
 * @remarks
 * 中身は [`confirm-details.tsx`](confirm-details.tsx) が持ちます。ここが持つのは**いつ読むか**
 * だけで、分けてあるのは、器（`../../new/view.tsx`）が段の構成を持つ場所であり、そこへ読み込みの
 * 都合を混ぜないためです。
 */
export function ProductConfirmSection(props: ProductConfirmSectionProps) {
  return <ProductConfirmDetails {...props} />;
}
