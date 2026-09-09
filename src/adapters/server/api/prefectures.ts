import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import { cache } from "react";
import type { z } from "zod";

import type { Prefecture } from "@/model/user/user";

import { GetPrefecturesResponse } from "../../gen/api/endpoints.zod";
import { getPublicClient } from "./public-client";

type WirePrefectures = z.infer<typeof GetPrefecturesResponse>;

/**
 * 都道府県マスタのキャッシュタグ。
 *
 * @remarks
 * 商品のマスタとは別のタグにしてあります。片方を無効化したときに、変わっていないもう片方まで
 * 取り直す理由がありません。
 */
export const PREFECTURE_MASTERS_TAG = "prefecture-masters";

/**
 * マスタの応答を表示用の型へ写す。
 *
 * @remarks
 * `code` は落とします。並び順を決めるための番号であり、契約が `code` 昇順で返すと定めている
 * ため、受け取った順序がそのまま表示の順序になります。
 */
function toPrefectures(wire: WirePrefectures): readonly Prefecture[] {
  return wire.map(({ id, name }) => ({ id, name }));
}

/**
 * 都道府県のマスタを取得する。
 *
 * @remarks
 * 認証を要しない公開の口です。クライアントに Bearer の取得口を渡していないのはそのためで、
 * 未ログインの画面からも同じ取得口を使えます。
 *
 * 都道府県は画面を開くたびに変わる種類のデータではないので、キャッシュへ入れます。
 * 寿命と入れ物の性質は商品マスタと同じで、`getProductCategories` の項が持ちます。
 * 捨てる印だけが別で、{@link PREFECTURE_MASTERS_TAG} を使います。
 */
export const getPrefectures = cache(async (): Promise<readonly Prefecture[]> => {
  "use cache";
  cacheLife("masters");
  cacheTag(PREFECTURE_MASTERS_TAG);

  const prefectures = await getPublicClient().request({
    path: "/v1/prefectures",
    schema: GetPrefecturesResponse,
  });

  return toPrefectures(prefectures);
});
