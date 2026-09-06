"use client";

import { useActionState, useCallback } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/design-system/action/button/button";
import { TrashIcon } from "@/components/icon";
import { idleActionState } from "@/model/action-state";

import { type CartActionState, removeCartItemAction } from "../../actions";
import { useCartRemovalNotice, useDisplayedOrder } from "../../removal-memory";
import { CartActionError } from "../action-error/action-error";

/** `CartRemoveButton` の props。 */
export type CartRemoveButtonProps = {
  /** 取り除く対象の商品。 */
  productId: string;
  /** 対象の名前。操作の読み上げと、取り消しの案内に使う。 */
  label: string;
  /** 取り除く時点の数量。取り消しはこの数量で入れ直す。 */
  quantity: number;
};

/** 送信中は押せなくする実行部。`useFormStatus` は form の子でしか状態を読めない。 */
function RemoveSubmit({ label, onSubmit }: { label: string; onSubmit: () => void }) {
  const { pending } = useFormStatus();

  return (
    <Button
      aria-label={`${label} を削除する`}
      disabled={pending}
      onClick={onSubmit}
      size="sm"
      type="submit"
      variant="ghost"
    >
      <TrashIcon aria-hidden="true" className="size-4" />
    </Button>
  );
}

/**
 * 明細 1 行をカートから取り除く操作。
 *
 * @remarks
 * 確認を挟まず、代わりに**取り消しを出します**。取り除いた行はその瞬間に消えるため、押し間違いに
 * 気づいた利用者が戻すには、商品名と数量を自分で覚えている必要があるからです。取り消しの表示と
 * 状態は器（`CartRemovalNoticeProvider`）が持ちます。
 *
 * 知らせるのは押した時点で、結果を待ちません。待つと、行が消えてからひと呼吸おいて案内が現れます。
 * このとき画面が並べていた順も一緒に渡します。**消えた行がどこに居たかを知っているのは画面だけ**で、
 * サーバの応答からは判りません。失敗した場合の取り下げは器の側が持ちます（明細が残っているかどうかで
 * 決まるため）。
 *
 * 買えない明細にも出します。公開が止まった商品こそ取り除きたく、契約もこの操作だけは商品の
 * 状態を問いません。
 */
export function CartRemoveButton({ productId, label, quantity }: CartRemoveButtonProps) {
  const notice = useCartRemovalNotice();
  const displayedOrder = useDisplayedOrder();
  const [state, formAction] = useActionState<CartActionState, FormData>(
    removeCartItemAction,
    idleActionState(),
  );
  const announce = useCallback(
    () => notice?.notify({ productId, name: label, quantity }, displayedOrder),
    [notice, displayedOrder, productId, label, quantity],
  );

  return (
    <div className="flex flex-col gap-1">
      <form action={formAction}>
        <input name="productId" type="hidden" value={productId} />
        <RemoveSubmit label={label} onSubmit={announce} />
      </form>
      <CartActionError state={state} title="削除できませんでした" />
    </div>
  );
}
