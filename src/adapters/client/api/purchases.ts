import * as z from "zod/mini";

import type { PurchaseHistoryPage } from "@/model/purchase/purchase";

import { request } from "../http/request";

/**
 * BFF が返す履歴 1 ページの形。
 *
 * @remarks
 * 契約から生成したスキーマではありません。この経路が受け取るのはバックエンドの応答ではなく、
 * `/api/purchases` が組み立てた表示用の形だからです。生成物を当てても、形が違うので通りません。
 *
 * それでも検証するのは、応答を検証せずに UI へ流さない原則が client 側の経路にも等しく効くため
 * です（[0073](../../../../docs/adr/0073-pagination-fetch-boundary.md)）。
 *
 * 注文日時は JSON を経由する間に文字列へ落ちるため、ここで `Date` へ戻します。戻さずに渡すと、
 * 初回ページ（Server Component 経由で `Date`）と続き（文字列）で型が食い違います。
 */
const PurchaseHistoryPagePayload = z.object({
  items: z.array(
    z.object({
      code: z.string(),
      totalAmount: z.int(),
      statusCode: z.int(),
      statusName: z.string(),
      orderedAt: z.coerce.date(),
    }),
  ),
  nextCursor: z.nullable(z.string()),
});

/**
 * 購入履歴の続きを取得する。
 *
 * @remarks
 * 同一オリジンの `/api/purchases` を {@link request} で叩くだけです。失敗の扱いと分類は
 * {@link request} の契約に従います。
 *
 * @param query - URL へ載せる取得条件。カーソルと期間を含める
 * @param signal - 条件が変わった、または画面を離れたときに取得を打ち切る
 */
export async function fetchPurchaseHistoryPage(
  query: URLSearchParams,
  signal?: AbortSignal,
): Promise<PurchaseHistoryPage> {
  return request(`/api/purchases?${query.toString()}`, PurchaseHistoryPagePayload, signal);
}
