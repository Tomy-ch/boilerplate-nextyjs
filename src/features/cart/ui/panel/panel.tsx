"use client";

import dynamic from "next/dynamic";
import { useCallback } from "react";

import { Button } from "@/components/design-system/action/button/button";
import { XIcon } from "@/components/icon";
import type { Cart } from "@/model/cart/cart";
import { useCartStore } from "@/stores/cart-store";
import { usePendingRemovals } from "../../removal-memory";

/**
 * 中身は、この領域が出ているときにしか描かれない。
 *
 * @remarks
 * 静的に import すると、明細の操作一式（数量・削除・全消しの確認）がどの画面の最初の読み込みにも
 * 乗ります。領域が閉じている画面や空のカートでは 1 度も描かれないため、開いたときに読みます
 * （[0101](../../../../../docs/adr/0101-performance-budget.md)）。
 */
const CartContents = dynamic(() =>
  import("../contents/contents").then((module) => module.CartContents),
);

/** `CartPanel` の props。 */
export type CartPanelProps = {
  /** 表示するカート。 */
  cart: Cart;
};

/**
 * カートの中身を本文の脇に常設する領域。
 *
 * @remarks
 * カートが空の間は枠ごと描画しません。中身の無い枠が常に場所を取ると、本文の幅がカートの有無で
 * 変わらないぶん、空白だけが残ります。
 *
 * **`lg` 未満では出しません**（タブレットを含む。`docs/rules.md` #71）。本文の下へ積むと内側の
 * スクロールが外側のスクロールを奪い、本文へ戻れなくなるため、`lg` 未満は本文へ被せる
 * `CartHeaderAction` が受け持ちます。
 *
 * 出し分けを CSS で行うのは、本文の幅がカートの有無で変わるためです（hydration を待つと幅が動きます）。
 *
 * **取り消しを抱えているあいだは、空でも枠を残します。** 最後の 1 件を取り除いた直後に枠ごと消すと、
 * 戻す手段が同時に消えます。
 *
 * **開いているかどうかは幅によらず store の要求に従います。** 脇に常設できる幅でも、この領域は本文の
 * 幅をその分だけ持っていきます。閉じられないと、一度カートへ入れた利用者は一覧を狭いまま読み続ける
 * ことになります。閉じた後は header の入口から開き直せます。
 */
export function CartPanel({ cart }: CartPanelProps) {
  const isOpen = useCartStore((state) => state.isOpen);
  const setOpen = useCartStore((state) => state.setOpen);
  const close = useCallback(() => setOpen(false), [setOpen]);
  const pendingRemovals = usePendingRemovals(cart.lines.map((line) => line.productId));

  if ((cart.lines.length === 0 && pendingRemovals.size === 0) || !isOpen) {
    return null;
  }

  return (
    <aside aria-label="カート" className="hidden lg:block lg:w-72 lg:shrink-0 lg:border-l">
      <div className="sticky top-14 flex max-h-[calc(100dvh-3.5rem)] flex-col gap-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="font-emphasis text-sm">カート</p>
          <Button
            aria-label="カートを閉じる"
            onClick={close}
            size="sm"
            type="button"
            variant="ghost"
          >
            <XIcon aria-hidden="true" className="size-4" />
          </Button>
        </div>
        <CartContents cart={cart} />
      </div>
    </aside>
  );
}
