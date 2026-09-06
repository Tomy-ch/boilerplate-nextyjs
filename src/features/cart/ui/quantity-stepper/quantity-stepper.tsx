"use client";

import type { ReactNode } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { CART_ITEM_MAX_QUANTITY } from "@/adapters/client/api/cart";
import { Button } from "@/components/design-system/action/button/button";
import { MinusIcon, PlusIcon } from "@/components/icon";
import { idleActionState } from "@/model/action-state";

import { type CartActionState, setCartItemQuantityAction } from "../../actions";
import { CartActionError } from "../action-error/action-error";

/** `CartQuantityStepper` の props。 */
export type CartQuantityStepperProps = {
  /** 対象の商品。 */
  productId: string;
  /** 現在の数量。 */
  quantity: number;
  /** 対象の名前。操作の読み上げを行ごとに区別するために使う。 */
  label: string;
  /** 数量の上限。省略時は契約の上限。在庫が足りない明細では今買える数を渡す。 */
  max?: number;
};

/**
 * 数量を 1 つ動かす操作。
 *
 * @remarks
 * 送る数量をボタン自身が持ちます。押した先の値を form の値として送れるため、増減の計算を
 * client の状態として持たずに済みます。
 *
 * 送信中はどちらの向きも押せなくします。押した操作が進んでいることの表示と、往復の途中で
 * 別の数量が飛ぶことの防止を兼ねます（[0061](../../../../../docs/adr/0061-form-mutation-ux.md)）。
 */
function StepButton({
  quantity,
  label,
  disabled,
  children,
}: {
  quantity: number;
  label: string;
  disabled: boolean;
  children: ReactNode;
}) {
  const { pending } = useFormStatus();

  return (
    <Button
      aria-label={label}
      disabled={disabled || pending}
      name="quantity"
      size="sm"
      type="submit"
      value={quantity}
      variant="ghost"
    >
      {children}
    </Button>
  );
}

/**
 * 明細 1 行の数量を増減する操作。
 *
 * @remarks
 * 契約は数量の設定（絶対値）を受け取るため、押した先の数量をそのまま送ります。
 *
 * **1 から減らす操作は持ちません。** 数量 0 は契約の範囲外で、行を無くすのは削除の操作です。
 * 1 つの操作に 2 つの意味を持たせません。
 *
 * 上限に達したら増やす操作を押せなくします。押しても何も起きない操作を残すと、反応が無いのか
 * 上限なのかが利用者から区別できません。**在庫の上限ではありません** — 在庫が足りるかどうかは
 * バックエンドが明細の事情として返します。
 */
export function CartQuantityStepper({
  productId,
  quantity,
  label,
  max = CART_ITEM_MAX_QUANTITY,
}: CartQuantityStepperProps) {
  const [state, formAction] = useActionState<CartActionState, FormData>(
    setCartItemQuantityAction,
    idleActionState(),
  );

  return (
    <div className="flex flex-col gap-1">
      <form action={formAction} className="flex items-center gap-1">
        <input name="productId" type="hidden" value={productId} />
        <StepButton
          disabled={quantity <= 1}
          label={`${label} を 1 つ減らす`}
          quantity={quantity - 1}
        >
          <MinusIcon aria-hidden="true" className="size-4" />
        </StepButton>
        <span className="min-w-6 text-center text-sm tabular-nums">{quantity}</span>
        <StepButton
          disabled={quantity >= max}
          label={`${label} を 1 つ増やす`}
          quantity={quantity + 1}
        >
          <PlusIcon aria-hidden="true" className="size-4" />
        </StepButton>
      </form>
      <CartActionError state={state} title="数量を変更できませんでした" />
    </div>
  );
}
