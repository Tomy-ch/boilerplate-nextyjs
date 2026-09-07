"use server";

import { revalidatePath } from "next/cache";
import { RedirectType, redirect } from "next/navigation";
import { z } from "zod";

import { getMyCart, removeMyCartItem, setMyCartItem } from "@/adapters/server/api/cart";
import { createPurchase } from "@/adapters/server/api/purchases";
import { findAppError } from "@/errors/app-error";
import { ErrorKind } from "@/errors/error-kind";
import { getLogger, reportQuietly } from "@/logging/logging.server";
import { actionStateFromError, failedActionState } from "@/model/action-state";
import { IDEMPOTENCY_KEY_FIELD } from "@/model/idempotency-key";
import type { PurchaseOrderLine } from "@/model/purchase/purchase";
import { ACCEPT_PRICE_CHANGE_FIELD } from "./form-fields";
import type { PlaceOrderFormState } from "./form-state";
import { hasPriceChangedLines, orderLinesOf, priceChangedLines } from "./order";
import { purchaseCompletePath } from "./paths";

const INVALID_REQUEST_MESSAGE = "画面を開き直してから、もう一度お試しください。";
const NOTHING_TO_ORDER_MESSAGE =
  "購入できる商品がありません。カートの内容を確かめてから、もう一度お試しください。";
const CONFLICT_MESSAGE =
  "確定するあいだに在庫か価格が変わりました。内容を確かめてから、もう一度お試しください。";
const PRICE_CHANGED_MESSAGE = "金額が変わりました。内容を確かめてから、もう一度お試しください。";

/**
 * カートから購入した明細を取り除く。取り除けなくても投げない。
 *
 * @remarks
 * **購入はこの時点で成立しています。** 後始末が通らなかったことを理由に完了を見せないと、
 * 利用者には購入できなかったように映ります。
 *
 * 買った明細だけを取り除きます。カートを丸ごと空にすると、買えなくて今回の購入から外れた明細まで
 * 消え、利用者が選び直す手掛かりを失います。
 */
async function removeOrderedLines(lines: readonly PurchaseOrderLine[]): Promise<void> {
  try {
    await Promise.all(lines.map(({ productId }) => removeMyCartItem(productId)));
  } catch (cause) {
    reportQuietly(() =>
      getLogger().warn("購入した明細をカートから取り除けませんでした", { cause: String(cause) }),
    );
  }
}

/**
 * 値が変わった明細を、今の価格で承知したものとして置き直す。
 *
 * @remarks
 * 設定（絶対値）を送ると、提示済みの価格が今の価格へ置き直されます。次の取得では値の変わった
 * 事情が消え、小計にも含まれます。**利用者が確認の上で選んだときだけ**呼びます。
 */
async function acceptPriceChanges(lines: readonly PurchaseOrderLine[]): Promise<void> {
  await Promise.all(lines.map(({ productId, quantity }) => setMyCartItem(productId, quantity)));
}

/**
 * 購入を確定する。
 *
 * @remarks
 * **送る明細はこの時点のカートから組み直します。** 画面が見せていた内容を送り返すと、開いたまま
 * 放置されたあいだに在庫や価格が変わっていても、古い前提のまま確定できてしまいます。
 *
 * **値が変わっていたら、承知したという合図が無い限り送りません。** 画面は押す前に確かめますが、
 * 確かめた後に変わることもあります。合図があれば、その明細を今の価格で置き直してから購入します。
 *
 * **冪等キーは画面が組んだ時点の値をそのまま使います。** 二重に押しても再読み込みで送り直しても、
 * 同じ鍵で届いた要求は初回の結果の再生として扱われ、購入は 1 件のままです。
 *
 * 成立したら完了画面へ送ります。同じ画面で完了を見せると、再読み込みで完了が消え、戻る操作が
 * 確定前の画面へ帰ります。
 *
 * **送るのは積み増しではなく置き換えです。** 確定した後の確認画面はもう見せる内容を持たず、
 * 被せた overlay の中から確定したときは、その overlay が積んだ 1 件が戻り先として残ります。
 */
export async function placeOrderAction(
  _previous: PlaceOrderFormState,
  formData: FormData,
): Promise<PlaceOrderFormState> {
  const idempotencyKey = z.uuid().safeParse(formData.get(IDEMPOTENCY_KEY_FIELD));

  if (!idempotencyKey.success) {
    return failedActionState({ formError: INVALID_REQUEST_MESSAGE });
  }

  const accepted = formData.get(ACCEPT_PRICE_CHANGE_FIELD) !== null;
  let cart = await getMyCart();

  if (hasPriceChangedLines(cart)) {
    if (!accepted) {
      return failedActionState({ formError: PRICE_CHANGED_MESSAGE });
    }

    try {
      await acceptPriceChanges(priceChangedLines(cart));
      cart = await getMyCart();
    } catch (error) {
      return actionStateFromError(error);
    }
  }

  const lines = orderLinesOf(cart);

  if (lines.length === 0) {
    return failedActionState({ formError: NOTHING_TO_ORDER_MESSAGE });
  }

  let purchaseCode: string;

  try {
    purchaseCode = await createPurchase(lines, idempotencyKey.data);
  } catch (error) {
    if (findAppError(error)?.kind === ErrorKind.CONFLICT) {
      return failedActionState({ formError: CONFLICT_MESSAGE });
    }

    return actionStateFromError(error);
  }

  await removeOrderedLines(lines);

  // カートは外枠（header の点数と脇の領域）にも出る。経路を 1 つ指定しても外枠は古いままなので、
  // layout の段で無効にする。買った直後の画面に、買った物が残って見えることになる。
  revalidatePath("/", "layout");

  redirect(purchaseCompletePath(purchaseCode), RedirectType.replace);
}
