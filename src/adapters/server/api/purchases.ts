import "server-only";

import { cache } from "react";
import { type ZodType, z } from "zod";

import { getApiConfig } from "@/config/api/api.server";
import { getHttpConfig } from "@/config/http/http.server";
import { toProductId } from "@/model/product/product";
import type {
  Purchase,
  PurchaseDispatchGroup,
  PurchaseHistoryEntry,
  PurchaseHistoryPage,
  PurchaseOrderLine,
} from "@/model/purchase/purchase";
import { PURCHASE_STATUS } from "@/model/purchase/purchase-status";

import {
  GetPurchasesDetailResponse,
  GetPurchasesQueryParams,
  GetPurchasesResponse,
  GetPurchasesShippableResponse,
  PatchPurchasesCancelResponse,
  PatchPurchasesDeliverResponse,
  PatchPurchasesPayResponse,
  PatchPurchasesShipResponse,
  PostPurchasesResponse,
} from "../../gen/api/endpoints.zod";
import { getPurchasesDetailPathPurchaseCodeMax } from "../../gen/api/limits";
import type { PurchasesPostRequest } from "../../gen/api/model";
import { getAccessToken } from "../auth/session";
import { createHttpClient, type UserScopedHttpClient } from "../http/request";

const IDEMPOTENCY_KEY_HEADER = "Idempotency-Key";

const PURCHASES_PATH = "/v1/purchases";

type WirePurchases = z.infer<typeof GetPurchasesResponse>;
type WirePurchaseDetail = z.infer<typeof GetPurchasesDetailResponse>;

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

function toPurchaseHistoryPage(wire: WirePurchases): PurchaseHistoryPage {
  return {
    items: wire.items.map(({ code, totalAmount, status, orderedAt }) => ({
      code,
      totalAmount,
      statusCode: status.code,
      statusName: status.name,
      orderedAt: new Date(orderedAt),
    })),
    nextCursor: wire.nextCursor,
  };
}

/**
 * 契約が購入コードとして受け付ける形。
 *
 * @remarks
 * **長さの上下限だけです。** 契約が置いているのがそれだけで、桁や区切りを決めているのは発番する
 * バックエンドです。ここで形を足すと、発番の仕方が変わったときに画面の側が先に読めなくなります。
 *
 * 画面が URL から読む値を照らすために公開します。契約由来の範囲を features 側で書き直さない
 * ためで、上限は生成物から引いています。
 */
export const PurchaseCode = z.string().min(1).max(getPurchasesDetailPathPurchaseCodeMax);

/** 購入履歴の取得条件。契約のクエリと 1 対 1 に対応する。 */
export type PurchaseHistoryQuery = z.infer<typeof GetPurchasesQueryParams>;

/** `parsePurchaseHistoryQuery` の結果。読めなかったキーは呼び出し側が画面へ出す。 */
export type PurchaseHistoryQueryParseResult =
  | { readonly ok: true; readonly query: PurchaseHistoryQuery }
  | { readonly ok: false; readonly invalidKeys: readonly string[] };

/** 数として宣言されている条件。クエリ文字列からは文字列で届くため、照合の前に直す。 */
const NUMERIC_KEYS: ReadonlySet<string> = new Set(["first"]);

/** 真偽値として宣言されている条件。同じく、クエリ文字列からは文字列で届く。 */
const BOOLEAN_KEYS: ReadonlySet<string> = new Set(["includeOtherUsers"]);

/**
 * 契約が受け付ける綴りだけを真偽値へ直す。
 *
 * @remarks
 * **読めない綴りは文字列のまま返します。** 真偽値へ寄せると、`includeOtherUsers=yes` のような
 * 打ち間違いが黙って「自分の購入だけ」に倒れ、母集団が変わったことを利用者が知る手段が
 * なくなります。文字列のまま契約へ落とせば、読めなかったキーとして返ります。
 */
function toBoolean(value: string): boolean | string {
  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return value;
}

/**
 * 素のクエリを、契約が受け付ける取得条件へ照合する。
 *
 * @remarks
 * **区分ごとの必須が欠けているかどうかまでは見ません。** そこは契約が 400 で返す領域で、
 * 同じ判定を 2 か所に置くと、増えた区分に片方だけが追いつきます。画面の側は送る前に
 * 組み立てを確かめており（`features/purchases/history/period-draft.ts`）、ここが受け持つのは
 * 「URL に載っている値が契約の型と範囲に収まるか」だけです。
 *
 * **キーは利用者が決めます。** 空の object へ添字で書くと `__proto__` が代入の対象になるため、
 * 並びを組んでから `Object.fromEntries` で畳みます。同じ綴りでも自前のプロパティになります。
 */
export function parsePurchaseHistoryQuery(
  raw: Readonly<Record<string, string | readonly string[]>>,
): PurchaseHistoryQueryParseResult {
  const typed: [string, unknown][] = [];

  for (const [key, value] of Object.entries(raw)) {
    if (typeof value !== "string") {
      continue;
    }

    if (BOOLEAN_KEYS.has(key)) {
      typed.push([key, toBoolean(value)]);
      continue;
    }

    typed.push([key, NUMERIC_KEYS.has(key) ? Number(value) : value]);
  }

  const parsed = GetPurchasesQueryParams.safeParse(Object.fromEntries(typed));

  if (!parsed.success) {
    return {
      ok: false,
      invalidKeys: [...new Set(parsed.error.issues.map((issue) => String(issue.path[0])))],
    };
  }

  return { ok: true, query: parsed.data };
}

/** 取得条件を、クエリ文字列へ載せる形へ写す。 */
function toSearchParams(query: PurchaseHistoryQuery): Record<string, string | undefined> {
  return {
    after: query.after,
    first: String(query.first),
    orderedAfter: query.orderedAfter,
    orderedBefore: query.orderedBefore,
    includeOtherUsers: String(query.includeOtherUsers),
  };
}

/**
 * 自分の購入履歴を 1 ページ取得する。
 *
 * @remarks
 * 注文日時の降順で返ります。並べ替えの条件は契約が受け付けません。
 *
 * 次ページの鍵は応答の `nextCursor` に載ります。**ページ送りの間は同じ区間を渡します。**
 * 途中で条件が変わると keyset の連続性が保証されず、飛ばされる購入が出ます。区間は瞬時の
 * 半開区間 `[orderedAfter, orderedBefore)` で、暦の区分から解くのは呼び出し側です。
 */
export const getMyPurchases = cache(
  async (query: PurchaseHistoryQuery): Promise<PurchaseHistoryPage> => {
    const wire = await getClient().request({
      path: PURCHASES_PATH,
      searchParams: toSearchParams(query),
      schema: GetPurchasesResponse,
    });

    return toPurchaseHistoryPage(wire);
  },
);

function toPurchase(wire: WirePurchaseDetail): Purchase {
  return {
    code: wire.code,
    statusCode: wire.status.code,
    statusName: wire.status.name,
    subtotalAmount: wire.subtotalAmount,
    taxAmount: wire.taxAmount,
    shippingFee: wire.shippingFee,
    totalAmount: wire.totalAmount,
    lines: wire.details.map(({ productId, productName, quantity, unitPrice }) => ({
      productId: toProductId(productId),
      productName,
      quantity,
      unitPrice,
    })),
    orderedAt: new Date(wire.orderedAt),
  };
}

/**
 * 自分の購入を 1 件取得する。
 *
 * @remarks
 * 他人の購入も存在しない購入も、区別なく `not found` になります。契約が存在を秘匿するためで、
 * 呼び出し側が所有者を確かめる必要はありません。
 *
 * @param purchaseCode - 購入コード。利用者へ注文番号として見せている値
 */
export const getMyPurchase = cache(async (purchaseCode: string): Promise<Purchase> => {
  const wire = await getClient().request({
    path: `${PURCHASES_PATH}/${encodeURIComponent(purchaseCode)}`,
    schema: GetPurchasesDetailResponse,
  });

  return toPurchase(wire);
});

/**
 * 購入を作る。
 *
 * @remarks
 * **金額は送りません。** 単価も合計もバックエンドがその時点の価格から決めます。
 * 画面が見せていた金額を送り返せる口はなく、送れたとしても古い値になり得ます。
 *
 * **冪等キーは必ず付けます。** 契約では任意ですが、購入は自然キーを持たないため、付けない再送は
 * そのまま 2 件目の購入になります。同じ主体が同じキーで送り直した要求は、初回の結果の再生として
 * 扱われます。
 *
 * 在庫が要求に足りない場合は `conflict` として返ります。カートの再評価を通っていても、確定の
 * 瞬間に足りなくなる余地は残ります。
 *
 * @param lines - 購入する商品と数量。1 件以上必要で、同じ商品を 2 行に分けられない
 * @param idempotencyKey - 再送を初回の結果へ畳むための鍵
 * @returns 成立した購入の購入コード
 */
export async function createPurchase(
  lines: readonly PurchaseOrderLine[],
  idempotencyKey: string,
): Promise<string> {
  const wire = await getClient().request({
    path: PURCHASES_PATH,
    method: "POST",
    headers: { [IDEMPOTENCY_KEY_HEADER]: idempotencyKey },
    body: {
      details: lines.map(({ productId, quantity }) => ({ productId, quantity })),
    } satisfies PurchasesPostRequest,
    idempotent: true,
    schema: PostPurchasesResponse,
  });

  return wire.code;
}

/**
 * 購入 1 件へ、状態を進める要求を送る。
 *
 * @remarks
 * **応答を内層へ渡しません。** 遷移の応答は明細に商品名を持たず（`PurchaseDetailResponse`）、
 * 画面が出している購入の形に足りません。状態が変わったあとの購入は画面が取り直すので、ここが
 * 受け持つのは「契約どおりの応答が返ったか」を確かめることまでです。
 *
 * **再送しません。** 同じ要求が 2 度届くと 2 度目は `conflict` になるため、遷移は冪等ではあり
 * ません。通信の途中で切れた要求を勝手に送り直すと、成立していた遷移が失敗として見えます。
 */
async function transition<T>(
  purchaseCode: string,
  action: string,
  schema: ZodType<T>,
): Promise<void> {
  await getClient().request({
    path: `${PURCHASES_PATH}/${encodeURIComponent(purchaseCode)}/${action}`,
    method: "PATCH",
    schema,
  });
}

/**
 * 自分の購入をキャンセルする。
 *
 * @remarks
 * キャンセルできる状態からのみ通ります。いまの状態では通らない要求は `conflict` として返り、
 * 明細ぶんの在庫は成立と同じ取引の中で戻されます。存在の秘匿は {@link getMyPurchase} と同じです。
 *
 * @param purchaseCode - 購入コード。利用者へ注文番号として見せている値
 */
export async function cancelMyPurchase(purchaseCode: string): Promise<void> {
  await transition(purchaseCode, "cancel", PatchPurchasesCancelResponse);
}

/**
 * 自分の購入を支払い済みにする。
 *
 * @remarks
 * **決済そのものは行いません。** 契約が擬似決済として定めており、金額も決済結果も検証されません
 * （`docs/spec/screens.md` の除外事項）。未払い相当の状態からのみ通り、支払い済みへの再送は
 * `conflict` として返ります。
 *
 * @param purchaseCode - 購入コード。利用者へ注文番号として見せている値
 */
export async function payMyPurchase(purchaseCode: string): Promise<void> {
  await transition(purchaseCode, "pay", PatchPurchasesPayResponse);
}

/**
 * まとめて発送してよい購入の組を取る。
 *
 * @remarks
 * 発送可能とは、支払いを終えてまだ発送していない状態です。**ページ送りがありません。** 読み出す
 * 件数は契約の既定に委ねます。まとめ判定はその範囲の中で行われるため、件数を渡すと組の切れ目まで
 * こちらが決めることになります。
 *
 * 発送待ちが無いときは、失敗ではなく空の並びが返ります。
 *
 * 組分けと並び順を契約が決めること、範囲の外の購入が別の便になることは
 * [機能要件](../../../../docs/spec/route/admin/shipments/page.function.md)「取得」。
 */
export async function getShippablePurchases(): Promise<readonly PurchaseDispatchGroup[]> {
  const wire = await getClient().request({
    path: `${PURCHASES_PATH}/shippable`,
    schema: GetPurchasesShippableResponse,
  });

  return wire.groups.map(({ userId, purchases }) => ({
    userId,
    purchases: purchases.map(({ code, totalAmount, orderedAt }) => ({
      code,
      totalAmount,
      orderedAt: new Date(orderedAt),
    })),
  }));
}

/**
 * 発送済みで、まだ配達済みになっていない購入を取る。
 *
 * @remarks
 * **他の利用者の購入を母集団に含めます。** 配達の確認は管理の操作で、対象は店に届いている注文
 * すべてです。役割を持たない主体がこれを呼ぶと契約が 403 で返します。
 *
 * まとめる軸がありません。配達の確認は契約が購入 1 件ずつで受けるうえ、届いたかどうかは注文ごと
 * に分かれます。発送のような便の組は作りません。
 *
 * @param first - 1 度に読む件数。ページ送りを持たないため、ここが見せられる上限になる
 */
export const getShippedPurchases = cache(
  async (first: number): Promise<readonly PurchaseHistoryEntry[]> => {
    const wire = await getClient().request({
      path: PURCHASES_PATH,
      searchParams: {
        first: String(first),
        includeOtherUsers: "true",
        statusCodes: String(PURCHASE_STATUS.SHIPPED),
      },
      schema: GetPurchasesResponse,
    });

    return toPurchaseHistoryPage(wire).items;
  },
);

/**
 * 購入 1 件を配達済みにする。
 *
 * @remarks
 * 発送済みからのみ通ります。いまの状態では通らない要求は `conflict` として返り、二重の確認も
 * 同じ分類になります。**届いたことを確かめるのは店の側です** —— 契約は配送業者の追跡を持たない
 * ため、この操作が根拠にしているのは画面の向こうにいる人の確認だけです。
 *
 * 購入者本人であっても、管理の役割が無ければ拒まれます。
 *
 * @param purchaseCode - 購入コード。一覧が持っている値
 */
export async function deliverPurchase(purchaseCode: string): Promise<void> {
  await transition(purchaseCode, "deliver", PatchPurchasesDeliverResponse);
}

/**
 * 購入 1 件を発送済みにする。
 *
 * @remarks
 * 支払い済みからのみ通ります。いまの状態では通らない要求は `conflict` として返り、二重の発送も
 * 同じ分類になります。配送追跡（追跡番号・配送業者）は契約が扱いません。
 *
 * 購入者本人であっても、管理の役割が無ければ拒まれます。
 *
 * @param purchaseCode - 購入コード。まとめ発送の組が持っている値
 */
export async function shipPurchase(purchaseCode: string): Promise<void> {
  await transition(purchaseCode, "ship", PatchPurchasesShipResponse);
}
