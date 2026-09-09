import "server-only";

import { cache } from "react";
import type { z } from "zod";

import { getApiConfig } from "@/config/api/api.server";
import { getHttpConfig } from "@/config/http/http.server";
import type { DashboardSummary } from "@/model/dashboard/dashboard";
import { type TimeWindow, WHOLE_TIME } from "@/model/time-window";

import { GetDashboardSummaryResponse } from "../../gen/api/endpoints.zod";
import { getAccessToken } from "../auth/session";
import { createHttpClient, type UserScopedHttpClient } from "../http/request";

type WireDashboardSummary = z.infer<typeof GetDashboardSummaryResponse>;

let client: UserScopedHttpClient | undefined;

function getClient(): UserScopedHttpClient {
  client ??= createHttpClient({
    scope: "user-scoped",
    baseUrl: getApiConfig().baseUrl,
    maxUrlBytes: getHttpConfig().maxUrlBytes,
    getBearerToken: getAccessToken,
  });

  return client;
}

/** 契約の集計を表示用の型へ写す。 */
function toDashboardSummary(wire: WireDashboardSummary): DashboardSummary {
  return {
    salesAmount: wire.salesAmount,
    salesCount: wire.salesCount,
    // 契約がマスタの表示順で返すため、受け取った順序がそのまま表示の順序になる。
    purchaseStatusCounts: wire.purchaseStatusCounts.map(({ status, count }) => ({
      statusId: status.id,
      statusName: status.name,
      count,
    })),
    totalProductCount: wire.totalProductCount,
    publishedProductCount: wire.publishedProductCount,
  };
}

/**
 * 管理側の横断集計を取得する。
 *
 * @remarks
 * キャッシュを指定していません。集計は購入が発生するたびに変わる値で、無効化の引き金になるのは
 * 商品の更新ではなく購入です。商品のタグへ相乗りさせると、商品を触らない限り古い集計が残り
 * 続けます。
 *
 * 期間を既定へ寄せず呼び出し側から受けるのは、画面ごとに見たい期間が違うためです。**受け取るのは
 * 瞬時の半開区間だけです。** 「今日」「今月」を暦の上で解くのは画面の側で、契約はその語彙を
 * 持ちません。省略すると全期間が対象になります。
 */
export const getDashboardSummary = cache(
  async (window: TimeWindow = WHOLE_TIME): Promise<DashboardSummary> => {
    const summary = await getClient().request({
      path: "/v1/dashboard/summary",
      searchParams: { orderedAfter: window.after, orderedBefore: window.before },
      schema: GetDashboardSummaryResponse,
    });

    return toDashboardSummary(summary);
  },
);
