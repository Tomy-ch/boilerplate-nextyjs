import { notFound } from "next/navigation";

import { getProduct } from "@/adapters/server/api/products";
import { resolveMediaUrl } from "@/adapters/server/media/media-url";
import { JsonLd } from "@/components/design-system/display/json-ld/json-ld";
import { findAppError } from "@/errors/app-error";
import { ErrorKind } from "@/errors/error-kind";
import { toProductId } from "@/model/product/product";
import { withScreenSpan } from "@/observability/render-span";

import { toProductStructuredData } from "./structured-data";
import { ProductDetail } from "./view";

/** `ProductDetailPageContent` の props。 */
export type ProductDetailPageContentProps = {
  /** 表示する商品の ID。route の動的セグメントが渡す。 */
  id: string;
};

/**
 * 商品を取得し、`not-found` だけを Next の境界へ渡す。
 *
 * @remarks
 * 分類ごとの分岐を持つと、画面が増えるたびに同じ分岐が写るため、`not-found` 以外はそのまま投げて
 * `error.tsx` に委ねます。
 *
 * try の範囲は取得だけです。**JSX の構築を try に入れても、描画中の例外はここでは捕まりません** —
 * React が描画するのは戻り値を受け取った後だからです。捕まるように見える形にしないため分けています。
 */
async function loadProduct(id: string) {
  try {
    return await getProduct(toProductId(id));
  } catch (error) {
    if (findAppError(error)?.kind === ErrorKind.NOT_FOUND) {
      notFound();
    }

    throw error;
  }
}

/**
 * 商品詳細の中身。取得と組み立てを行う。
 *
 * @remarks
 * 取得と画像 URL の解決をここで行います。理由は [feature の README](../README.md) が持ちます。
 *
 * 構造化データもここで置きます。商品を知っているのは取得を済ませたこの層で、表示（`view`）は
 * 検索エンジンへ何を名乗るかを持ちません。
 */
export const ProductDetailPageContent = withScreenSpan(
  "features/products/detail/page-content",
  async ({ id }: ProductDetailPageContentProps) => {
    const product = await loadProduct(id);
    const imageUrls = product.imagePaths
      .map((path) => resolveMediaUrl(path))
      .filter((url): url is string => url !== null);

    return (
      <>
        <JsonLd data={toProductStructuredData(product, imageUrls)} />
        <ProductDetail imageUrls={imageUrls} product={product} />
      </>
    );
  },
);
