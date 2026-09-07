import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import { cache } from "react";
import type { z } from "zod";

import type { ProductCategory, ProductStatus } from "@/model/product/product";

import {
  GetProductCategoriesResponse,
  GetProductStatusesResponse,
} from "../../gen/api/endpoints.zod";
import { getPublicClient } from "./public-client";

type WireCategories = z.infer<typeof GetProductCategoriesResponse>;
type WireStatuses = z.infer<typeof GetProductStatusesResponse>;

/**
 * 商品マスタのキャッシュタグ。
 *
 * @remarks
 * 商品そのものとは別のタグにしてあります。商品を 1 件更新するたびに分類の一覧まで取り直すのは、
 * 変わっていないものを捨てているだけです。
 */
export const PRODUCT_MASTERS_TAG = "product-masters";

/**
 * マスタの応答を表示用の分類へ写す。
 *
 * @remarks
 * 並び替えの値を持ちません。契約が表示順の昇順で返すと定めているため、受け取った順序がそのまま
 * 表示の順序になります。
 *
 * `code` は残します。分類で絞り込む条件として URL に載るのはこの番号だからです。
 */
function toProductCategories(wire: WireCategories): readonly ProductCategory[] {
  return wire.map(({ id, name, code }) => ({ id, name, code }));
}

/**
 * 商品カテゴリのマスタを取得する。
 *
 * @remarks
 * 分類は画面を開くたびに変わる種類のデータではないので、キャッシュへ入れます。寿命は
 * `next.config.ts` の `masters` profile、捨てる印は {@link PRODUCT_MASTERS_TAG} が持ちます
 * （[0071](../../../../docs/adr/0071-bff-api-integration.md)）。
 *
 * **確実に残るのは、組み立て時に殻へ焼かれた分だけです**（入れ物の性質は
 * [adapters](../../README.md) の「リクエストをまたいで残すのは `use cache` の側」）。
 *
 * **このリポジトリから {@link PRODUCT_MASTERS_TAG} を撃つ経路はありません。** マスタの更新は
 * バックエンド側で起きるためで、古さの上限を決めているのは profile の時間だけです。タグは
 * webhook などの無効化口を持つ、テンプレートから作った側のために置いてあります。
 *
 * 外側の `cache()` は同一リクエスト内の重複を畳みます。`use cache` はリクエストをまたぐ層で、
 * 別物です。
 */
export const getProductCategories = cache(async (): Promise<readonly ProductCategory[]> => {
  "use cache";
  cacheLife("masters");
  cacheTag(PRODUCT_MASTERS_TAG);

  const categories = await getPublicClient().request({
    path: "/v1/products/categories",
    schema: GetProductCategoriesResponse,
  });

  return toProductCategories(categories);
});

/**
 * マスタの応答を表示用の状態へ写す。
 *
 * @remarks
 * `code` を残す理由は {@link toProductCategories} と同じです。
 */
function toProductStatuses(wire: WireStatuses): readonly ProductStatus[] {
  return wire.map(({ id, name, code }) => ({ id, name, code }));
}

/**
 * 商品ステータスのマスタを取得する。
 *
 * @remarks
 * キャッシュの扱いは {@link getProductCategories} と同じです。
 */
export const getProductStatuses = cache(async (): Promise<readonly ProductStatus[]> => {
  "use cache";
  cacheLife("masters");
  cacheTag(PRODUCT_MASTERS_TAG);

  const statuses = await getPublicClient().request({
    path: "/v1/products/statuses",
    schema: GetProductStatusesResponse,
  });

  return toProductStatuses(statuses);
});
