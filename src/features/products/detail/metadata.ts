import type { Metadata } from "next";

import { getProduct } from "@/adapters/server/api/products";
import { findAppError } from "@/errors/app-error";
import { ErrorKind } from "@/errors/error-kind";
import { type ProductId, toProductId } from "@/model/product/product";
import { SanitizedRichText } from "@/model/rich-text/sanitized-rich-text";

import { toProductDetailHref } from "../facade/detail-url/detail-url";

/** 見つからないときに名乗る題。画面の見出しと同じ分類の文言は `errors` が持つが、題は画面が決める。 */
const NOT_FOUND_TITLE = "商品が見つかりません";

/**
 * 商品詳細の metadata を組み立てる。
 *
 * @remarks
 * **見つからない商品は `noindex` を名乗ります。** 殻を先に流す画面では `notFound()` に達した
 * 時点で応答は 200 で出ており、ステータスでは伝えられません。検索エンジンに「無い」と伝える手段が
 * これだけです。
 *
 * それ以外の失敗はそのまま投げます。画面の側が `error` 境界へ委ねるのと同じ分岐で、ここで別の
 * 判定を持つと、画面が失敗を出しているのに metadata だけ成功の形になる状態を作れます。
 *
 * 取得は画面と同じ `getProduct` で、同一描画の中では `cache()` が 1 回にまとめます。
 *
 * @param id - route の動的セグメントが渡す商品の ID
 */
export async function resolveProductMetadata(id: string): Promise<Metadata> {
  const productId = toProductId(id);
  const product = await findProduct(productId);

  if (product === null) {
    return { title: NOT_FOUND_TITLE, robots: { index: false, follow: false } };
  }

  const description = product.description === null ? null : toSummary(product.description);

  return {
    title: product.name,
    ...(description === null ? {} : { description }),
    // 正規 URL は開かれた経路の ID で組む。画面の同一性を決めるのは route であって応答ではない。
    alternates: { canonical: toProductDetailHref(productId) },
  };
}

/** 見つからないものだけを null へ写し、それ以外の失敗は投げる。 */
async function findProduct(id: ProductId) {
  try {
    return await getProduct(id);
  } catch (error) {
    if (findAppError(error)?.kind === ErrorKind.NOT_FOUND) {
      return null;
    }

    throw error;
  }
}

/**
 * meta description に載せる長さ。
 *
 * @remarks
 * 検索結果で切られずに出る目安の上限です。契約が返す説明は長さの上限を持たないため、ここで
 * 切ります。文の途中で切れることは許します —— 切れ目を文で探すと、句点を持たない説明で
 * 何も出なくなります。
 */
const SUMMARY_LENGTH = 160;

/** リッチテキストの説明から、markup を落として先頭だけを採る。 */
function toSummary(html: string): string | null {
  const text = SanitizedRichText.from(html).text.replace(/\s+/g, " ").trim();

  if (text === "") {
    return null;
  }

  return [...text].slice(0, SUMMARY_LENGTH).join("");
}
