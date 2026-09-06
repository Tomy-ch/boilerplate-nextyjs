"use client";

import { useActionState, useCallback } from "react";
import { useFormStatus } from "react-dom";

import { FormFeedback } from "@/components/app-starter/form-feedback/form-feedback";
import { Button } from "@/components/design-system/action/button/button";
import { ShoppingCartIcon } from "@/components/icon";
import { type ActionState, idleActionState } from "@/model/action-state";
import { useCartStore } from "@/stores/cart-store";

import { addToCartAction } from "./add-to-cart";

/** `AddToCartButton` の props。 */
export type AddToCartButtonProps = {
  /** カートへ入れる商品。 */
  productId: string;
  /** 在庫数。0 なら押せない。 */
  stockQuantity: number;
  /**
   * どこに置かれるか。
   *
   * `detail` は画面の主操作として幅を占めて大きく出す。`list` は 1 件ぶんの枠に他の情報と
   * 並ぶため内容の幅に収める。小さくしすぎないのは、一覧でも指で押す対象であることが
   * 変わらないためで、`size` は既定より下げない。
   */
  placement?: "detail" | "list";
};

const LABEL = "カートに追加";
const PENDING_LABEL = "カートに追加しています";

/**
 * 送信部。
 *
 * @remarks
 * 押した時点でカートを開きます。結果を待って開くと、往復のあいだ何も起きていないように見えます。
 * 失敗した場合はこのボタンの下に理由が出ます。
 *
 * `useFormStatus` は form の子でしか状態を読めないため、別の部品に切り出しています。
 *
 * 送信中の見せ方は `Button`（`pending`）が持ちます。一覧では幅の揺れが隣の値まで動かすため、
 * 視覚の文言は差し替えません。
 */
function AddSubmit({ disabled, placement }: { disabled: boolean; placement: "detail" | "list" }) {
  const { pending } = useFormStatus();
  const setOpen = useCartStore((state) => state.setOpen);
  const open = useCallback(() => setOpen(true), [setOpen]);

  return (
    <Button
      className={placement === "list" ? undefined : "w-full lg:w-auto"}
      disabled={disabled}
      onClick={open}
      pending={pending}
      pendingLabel={PENDING_LABEL}
      size={placement === "list" ? "default" : "lg"}
      type="submit"
    >
      <ShoppingCartIcon aria-hidden="true" className="size-4" />
      {LABEL}
    </Button>
  );
}

/**
 * 商品をカートへ入れる操作。
 *
 * @remarks
 * カートの中身はバックエンドが持ちます。この部品は入れるよう頼むだけで、入った結果は同じ往復で
 * 描き直される脇の領域と header の点数に現れます。
 *
 * **在庫が無い商品は押せません。** 在庫を超える数量そのものは拒まれず、買えるかどうかの判定は
 * バックエンドが持ちますが、1 つも無いと判っている商品にまで操作を残すと、押しても結果が
 * 変わらない操作が画面に残ります。
 *
 * 画面の下には置かれません。詳細と一覧の両方から使うため、どこへ置くかは呼び出し元が決めます。
 */
export function AddToCartButton({
  productId,
  stockQuantity,
  placement = "detail",
}: AddToCartButtonProps) {
  const [state, formAction] = useActionState<ActionState<void>, FormData>(
    addToCartAction,
    idleActionState(),
  );

  return (
    <form action={formAction} className={placement === "list" ? undefined : "w-full lg:w-auto"}>
      <input name="productId" type="hidden" value={productId} />
      <AddSubmit disabled={stockQuantity <= 0} placement={placement} />
      {state.status === "error" && state.formError !== null ? (
        <FormFeedback
          description={state.formError}
          title="カートに追加できませんでした"
          variant="destructive"
        />
      ) : null}
    </form>
  );
}
