"use server";

import { revalidatePath } from "next/cache";

import { deliverPurchase, shipPurchase } from "@/adapters/server/api/purchases";
import { verifySession } from "@/adapters/server/auth/session";
import { createAppError, findAppError } from "@/errors/app-error";
import { ErrorKind } from "@/errors/error-kind";
import { ADMIN_SHIPMENT_QUEUE_PATH } from "@/features/admin/paths";
import { SHIPMENT_FORM_NAMES } from "@/features/admin/shipments/form-names";
import {
  DELIVERY_CONFLICT_MESSAGE,
  type DeliveryState,
  SHIPMENT_CONFLICT_MESSAGE,
  SHIPMENT_TARGET_LOST_MESSAGE,
  type ShipmentState,
} from "@/features/admin/shipments/form-state";
import {
  actionStateFromError,
  failedActionState,
  succeededActionState,
} from "@/model/action-state";
import { isAdmin } from "@/model/authz";

/** 役割を持たない主体の要求をここで止める。 */
async function assertAdmin(): Promise<void> {
  if (!isAdmin(await verifySession())) {
    throw createAppError(ErrorKind.PERMISSION_DENIED, {
      cause: new Error("管理の操作に必要な役割がありません"),
    });
  }
}

/** 送信から発送する購入を取り出す。1 件も載っていなければ空の並び。 */
function readPurchaseCodes(formData: FormData): readonly string[] {
  return formData
    .getAll(SHIPMENT_FORM_NAMES.purchaseCode)
    .flatMap((value) => (typeof value === "string" && value !== "" ? [value] : []));
}

/** 順に送った結果。打ち切ったときも、そこまでに通った件数を持つ。 */
type ShipmentProgress = {
  readonly shipped: number;
  readonly refused: number;
  /** 打ち切った理由。最後まで送れば null。 */
  readonly abort: ShipmentState | null;
};

/**
 * 受け取った購入を順に発送済みにする。
 *
 * @remarks
 * **1 件ずつ順に送ります。** 契約の発送が購入 1 件ずつで、まとめて指示する口が無いためです。
 * 並行に送らないのは、途中で拒まれたときにどこまで通ったのかを数えられなくするためです。
 *
 * **いまの状況で通らなかったものは数えて先へ進みます。** 組の中の 1 件が先に発送済みになって
 * いても、残りは発送できます。ここで止めると、通るはずの注文が押し直しのたびに 1 件ずつしか
 * 進みません。
 *
 * **それ以外の失敗では止めます。** 役割が無い・接続先が落ちているといった失敗は次の 1 件でも
 * 同じように起きるため、送り続けても数が増えるだけです。
 *
 * 打ち切っても、そこまでに通った件数は返します。使い道は {@link shipPurchasesAction}。
 */
async function shipEach(purchaseCodes: readonly string[]): Promise<ShipmentProgress> {
  let shipped = 0;
  let refused = 0;

  for (const purchaseCode of purchaseCodes) {
    try {
      await shipPurchase(purchaseCode);
      shipped += 1;
    } catch (error) {
      if (findAppError(error)?.kind !== ErrorKind.CONFLICT) {
        return { shipped, refused, abort: actionStateFromError(error) };
      }

      refused += 1;
    }
  }

  return { shipped, refused, abort: null };
}

/**
 * 発送を指示する。
 *
 * @remarks
 * 1 件ずつの発送も、組をまとめた発送も、同じ送信で受けます（{@link SHIPMENT_FORM_NAMES}）。
 *
 * **1 件も通らなかったときだけ失敗にします。** 途中まで通った送信を失敗として返すと、通った分の
 * 発送がなかったことになります。
 *
 * **1 件でも通ったら一覧を取り直させます。** 発送した注文は発送待ちではなくなるので、残したまま
 * にすると押せば必ず競合になる操作が並び続けます。取り直した一覧に残っているものが、そのまま
 * 「まだ発送していない注文」になります。**途中で打ち切ったときも同じです** —— 打ち切りの理由を
 * 伝えることと、そこまでに成立した発送を一覧へ反映することは別の話で、後者を落とすと発送済みの
 * 注文が未発送として並び続けます。

 *
 * 主体の断言が要る action なので、この層に置きます（[同層の README](../../README.md)）。
 */
export async function shipPurchasesAction(
  _previous: ShipmentState,
  formData: FormData,
): Promise<ShipmentState> {
  try {
    await assertAdmin();
  } catch (error) {
    return actionStateFromError(error);
  }

  const purchaseCodes = readPurchaseCodes(formData);

  if (purchaseCodes.length === 0) {
    return failedActionState({ formError: SHIPMENT_TARGET_LOST_MESSAGE });
  }

  const { shipped, refused, abort } = await shipEach(purchaseCodes);

  if (shipped > 0) {
    revalidatePath(ADMIN_SHIPMENT_QUEUE_PATH);
  }

  if (abort !== null) {
    return abort;
  }

  if (shipped === 0) {
    return failedActionState({ formError: SHIPMENT_CONFLICT_MESSAGE, kind: ErrorKind.CONFLICT });
  }

  return succeededActionState({ shipped, refused });
}

/**
 * 配達を確認する。
 *
 * @remarks
 * **1 件だけ受けます。** 契約の配達確認は購入 1 件ずつで、この画面もまとめる軸を持ちません
 * （{@link DeliveryState}）。送信に複数並んでいても先頭しか見ないのではなく、そもそも並べる
 * 送信を作りません。
 *
 * 通ったら一覧を取り直させます。配達済みになった注文は発送済みではなくなるので、残したままに
 * すると押せば必ず競合になる操作が並び続けます。
 *
 * 置き場の判断は {@link shipPurchasesAction} と同じです。
 */
export async function deliverPurchaseAction(
  _previous: DeliveryState,
  formData: FormData,
): Promise<DeliveryState> {
  try {
    await assertAdmin();
  } catch (error) {
    return actionStateFromError(error);
  }

  const [purchaseCode] = readPurchaseCodes(formData);

  if (purchaseCode === undefined) {
    return failedActionState({ formError: SHIPMENT_TARGET_LOST_MESSAGE });
  }

  try {
    await deliverPurchase(purchaseCode);
  } catch (error) {
    if (findAppError(error)?.kind === ErrorKind.CONFLICT) {
      return failedActionState({ formError: DELIVERY_CONFLICT_MESSAGE, kind: ErrorKind.CONFLICT });
    }

    return actionStateFromError(error);
  }

  revalidatePath(ADMIN_SHIPMENT_QUEUE_PATH);

  return succeededActionState({ purchaseCode });
}
