"use server";

import { revalidatePath } from "next/cache";

import { cancelMyPurchase, payMyPurchase } from "@/adapters/server/api/purchases";
import { findAppError } from "@/errors/app-error";
import { ErrorKind } from "@/errors/error-kind";
import {
  actionStateFromError,
  failedActionState,
  succeededActionState,
} from "@/model/action-state";

import { purchaseDetailPath } from "./facade/paths/paths";
import { PURCHASE_TRANSITION_FORM_NAMES } from "./form-names";
import {
  CANCEL_CONFLICT_MESSAGE,
  PAY_CONFLICT_MESSAGE,
  type PurchaseTransitionState,
  TRANSITION_TARGET_LOST_MESSAGE,
} from "./form-state";

/** 送信から対象の購入を取り出す。載っていなければ null。 */
function readPurchaseCode(formData: FormData): string | null {
  const code = formData.get(PURCHASE_TRANSITION_FORM_NAMES.purchaseCode);

  return typeof code === "string" && code !== "" ? code : null;
}

/**
 * 購入 1 件の状態を進め、結果を画面の状態へ写す。
 *
 * @remarks
 * **成立したら詳細を取り直させます。** 画面に留まる操作なので、進んだあとの状況（状況の表示と、
 * そこからできる操作）は同じ画面が出し直します。取り直させないと、押した本人だけが古い状態を
 * 見続けます。
 *
 * `409` にだけ専用の文言を当てます。カタログの既定文言は分類だけを伝えるもので、拒まれた理由を
 * 遷移ごとに言い分けられるのはこの画面だけです。
 */
async function runTransition(
  formData: FormData,
  transition: (purchaseCode: string) => Promise<void>,
  conflictMessage: string,
): Promise<PurchaseTransitionState> {
  const purchaseCode = readPurchaseCode(formData);

  if (purchaseCode === null) {
    return failedActionState({ formError: TRANSITION_TARGET_LOST_MESSAGE });
  }

  try {
    await transition(purchaseCode);
  } catch (error) {
    if (findAppError(error)?.kind === ErrorKind.CONFLICT) {
      return failedActionState({ formError: conflictMessage, kind: ErrorKind.CONFLICT });
    }

    return actionStateFromError(error);
  }

  revalidatePath(purchaseDetailPath(purchaseCode));

  return succeededActionState(undefined);
}

/**
 * 購入をキャンセルする。
 *
 * @remarks
 * 主体を断言しません。契約が本人の購入だけを対象とし、他人の購入は存在ごと秘匿するため、この
 * 操作で他人の購入へ届く経路がありません。
 */
export async function cancelPurchaseAction(
  _previous: PurchaseTransitionState,
  formData: FormData,
): Promise<PurchaseTransitionState> {
  return runTransition(formData, cancelMyPurchase, CANCEL_CONFLICT_MESSAGE);
}

/** 購入を支払う。主体を断言しない理由は {@link cancelPurchaseAction} と同じ。 */
export async function payPurchaseAction(
  _previous: PurchaseTransitionState,
  formData: FormData,
): Promise<PurchaseTransitionState> {
  return runTransition(formData, payMyPurchase, PAY_CONFLICT_MESSAGE);
}
