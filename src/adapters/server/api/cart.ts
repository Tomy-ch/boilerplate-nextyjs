import "server-only";

import { cache } from "react";
import type { z } from "zod";

import { getApiConfig } from "@/config/api/api.server";
import { getHttpConfig } from "@/config/http/http.server";
import type { Cart, CartMergeResult } from "@/model/cart/cart";
import type { ProductId } from "@/model/product/product";
import { toProductId } from "@/model/product/product";

import {
  DeleteCartsMeItemResponse,
  DeleteCartsMeResponse,
  GetCartsMeResponse,
  PostCartsMeMergeResponse,
  PutCartsMeItemResponse,
} from "../../gen/api/endpoints.zod";
import type { CartItemPutRequest } from "../../gen/api/model";
import { getAccessToken } from "../auth/session";
import { createHttpClient, type UserScopedHttpClient } from "../http/request";
import { resolveMediaUrl } from "../media/media-url";
import { clearCartSession, readCartSession, storeCartSession } from "./cart-session";

/** ゲストのカートを指すヘッダの名前。 */
const CART_SESSION_HEADER = "X-Cart-Session";

const CART_PATH = "/v1/carts/me";

type WireCart = z.infer<typeof GetCartsMeResponse>;

let client: UserScopedHttpClient | undefined;

/**
 * カートの接続先。
 *
 * @remarks
 * 認証を任意にします。カートは未ログインでも使え、主体はゲストの識別子か認証済みの利用者かの
 * どちらかで、契約が両方の呼び出しを受け付けます。
 */
function getClient(): UserScopedHttpClient {
  client ??= createHttpClient({
    scope: "user-scoped",
    baseUrl: getApiConfig().baseUrl,
    maxUrlBytes: getHttpConfig().maxUrlBytes,
    getBearerToken: getAccessToken,
    allowAnonymous: true,
  });

  return client;
}

/**
 * ゲストの識別子をヘッダへ組む。まだ発行されていなければ何も付けない。
 *
 * @remarks
 * 認証済みの呼び出しでも付けたままにします。契約は両方が提示された場合に認証済みの主体を採ると
 * 定めており、こちらで優先順位を判断すると同じ規則が 2 箇所に生まれます。
 */
async function cartSessionHeader(): Promise<Readonly<Record<string, string>> | undefined> {
  const token = await readCartSession();

  return token === null ? undefined : { [CART_SESSION_HEADER]: token };
}

/** 契約の応答を表示用の型へ写す。画像はオブジェクトキーのまま渡さず、ここで表示 URL へ解決する。 */
function toCart(wire: WireCart): Cart {
  return {
    lines: wire.items.map((item) => ({
      productId: toProductId(item.productId),
      name: item.productName ?? null,
      imageUrl: resolveMediaUrl(item.imagePath ?? null),
      unitPrice: item.unitPrice ?? null,
      quantity: item.quantity,
      issues: item.issues,
      availableQuantity: item.availableQuantity ?? null,
    })),
    subtotalAmount: wire.subtotalAmount,
  };
}

/**
 * 発行されたばかりの識別子を cookie へ引き取る。
 *
 * @remarks
 * 識別子が載るのは、その呼び出しがゲストのカートを新しく作ったときだけです。載っていない応答で
 * 手元の cookie を消さないのは、既に持っている識別子がそのまま生きているためです。
 */
async function keepIssuedSession(wire: WireCart): Promise<void> {
  if (wire.sessionToken === undefined || wire.sessionToken === null) {
    return;
  }

  await storeCartSession(
    wire.sessionToken,
    wire.expiresAt === undefined || wire.expiresAt === null ? null : new Date(wire.expiresAt),
  );
}

/**
 * 自分のカートを、明細ごとの再評価つきで取得する。
 *
 * @remarks
 * この取得はカートを作りません。ゲストの識別子がまだ無い利用者にも、空のカートが返ります。
 *
 * 1 リクエストの中で外枠と画面の双方がカートを読むため memo 化します。
 */
export const getMyCart = cache(async (): Promise<Cart> => {
  return toCart(
    await getClient().request({
      path: CART_PATH,
      headers: await cartSessionHeader(),
      schema: GetCartsMeResponse,
    }),
  );
});

/**
 * カートの明細の数量を設定する。
 *
 * @remarks
 * 加算ではなく設定です。同じ要求が 2 度届いても結果が変わらないため、`Idempotency-Key` を
 * 要しません（冪等性は明細の自然キーから来ます）。
 *
 * ゲストの識別子はこの操作でだけ発行されます。取得や削除はカートを作らないため、発行された値を
 * 受け取れる口がここしかありません。
 *
 * 在庫を超えた数量も拒まれません。買えるかどうかは明細の `issues` として返ります。
 *
 * @returns 設定後のカート（取得と同じく再評価つき）
 */
export async function setMyCartItem(productId: ProductId, quantity: number): Promise<Cart> {
  const wire = await getClient().request({
    path: `${CART_PATH}/items/${encodeURIComponent(productId)}`,
    method: "PUT",
    headers: await cartSessionHeader(),
    body: { quantity } satisfies CartItemPutRequest,
    schema: PutCartsMeItemResponse,
  });

  await keepIssuedSession(wire);

  return toCart(wire);
}

/**
 * カートから明細を取り除く。
 *
 * @remarks
 * 対象が無くても成功します。公開が止まった商品も取り除けます（そうでないと、買えない明細を
 * 利用者が片付けられません）。
 */
export async function removeMyCartItem(productId: ProductId): Promise<void> {
  await getClient().request({
    path: `${CART_PATH}/items/${encodeURIComponent(productId)}`,
    method: "DELETE",
    headers: await cartSessionHeader(),
    schema: DeleteCartsMeItemResponse,
  });
}

/**
 * ゲストのカートを、いま認証されている利用者へ引き継ぐ。
 *
 * @remarks
 * この操作だけが認証を要します。所有者を確定させる操作であり、匿名では成り立たないためです。
 *
 * **引き継ぎは失敗しません。** 引き継ぐカートが無い場合（既に引き継ぎ済み・期限切れ・未知の識別子）も、
 * 何も失われなかった結果として返ります。数量の合算や明細数が上限を超えた分だけが結果に載ります。
 *
 * **成功したら手元の識別子を破棄します。** 引き継いだ時点でゲストのカートは消え、
 * その識別子はどこも指さなくなります。残すと二重適用の経路になります。失敗したときは残します。
 * 指していたカートがまだ生きており、次の機会に引き継げるためです。
 *
 * 再送のための鍵は付けません。付ける利点は初回の報告を再送でも受け取れることだけで、この呼び出しは
 * 認証の往復につき 1 度しか起こしません。
 *
 * @returns 引き継ぐ識別子を持っていなければ null
 */
export async function mergeGuestCart(): Promise<CartMergeResult | null> {
  const token = await readCartSession();

  if (token === null) {
    return null;
  }

  const wire = await getClient().request({
    path: `${CART_PATH}/merge`,
    method: "POST",
    headers: { [CART_SESSION_HEADER]: token },
    schema: PostCartsMeMergeResponse,
  });

  await clearCartSession();

  return {
    clampedProductIds: wire.clamped.map(toProductId),
    droppedProductIds: wire.dropped.map(toProductId),
  };
}

/**
 * カートを空にする。
 *
 * @remarks
 * カートそのものは残ります。空のカートは正当な状態であり、行ごと消すと識別子が発行し直されて
 * 利用者の同一性が切れます。
 */
export async function clearMyCart(): Promise<void> {
  await getClient().request({
    path: CART_PATH,
    method: "DELETE",
    headers: await cartSessionHeader(),
    schema: DeleteCartsMeResponse,
  });
}
