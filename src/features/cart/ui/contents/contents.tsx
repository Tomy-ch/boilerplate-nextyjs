import Link from "next/link";

import { Button } from "@/components/design-system/action/button/button";
import { BUTTON_SIZE } from "@/components/design-system/action/button/button.definition";
import { ScrollArea } from "@/components/design-system/container/scroll-area/scroll-area";
import type { Cart } from "@/model/cart/cart";
import { withPartSpan } from "@/observability/render-span";
import { CART_PATH } from "../../paths";
import { CartCheckoutLink } from "../checkout-link/checkout-link";
import { CartClearButton } from "../clear-button/clear-button";
import { CartLineList } from "../line-list/line-list";
import { CartLineRow } from "../line-row/line-row";
import { CartRemovalNoticeList } from "../removal-notice/removal-notice";
import { CartSubtotal } from "../subtotal/subtotal";

/** `CartContents` の props。 */
export type CartContentsProps = {
  /** 表示するカート。 */
  cart: Cart;
};

/**
 * カートの中身。小計・導線・明細を縦に並べる。
 *
 * @remarks
 * 器を持ちません。脇の領域として常設する場合と、狭い幅で本文へ被せる場合の両方から使うため、
 * 位置と大きさは呼び出し元が決めます。
 *
 * 小計はバックエンドが返した値です。買える明細だけを合算した参考値であり、この画面では
 * 足し直しません。
 *
 * 小計と先へ進む導線は送りの外に置き、明細だけを局所スクロールさせます。高さを超えた明細を
 * 外側のスクロールに委ねると、器が固定されている場合に届かない行が出ます。**この器では小計が
 * 常に見えているため、全画面の側にある引き出しは要りません。**
 *
 * 導線は 2 本あり、主が購入手続き、副がカートページです（それぞれの理由は
 * [cart の README](../../README.md)）。
 */
export const CartContents = withPartSpan(
  "features/cart/ui/contents/contents",
  ({ cart }: CartContentsProps) => {
    const presentProductIds = cart.lines.map((line) => line.productId);

    if (cart.lines.length === 0) {
      return (
        <div className="flex flex-col gap-3">
          <CartRemovalNoticeList presentProductIds={presentProductIds} />
          <p className="text-muted-foreground text-sm">カートに商品が入っていません。</p>
        </div>
      );
    }

    return (
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <CartSubtotal amount={cart.subtotalAmount} size="compact" />

        <div className="grid gap-2">
          <CartCheckoutLink cart={cart} size={BUTTON_SIZE.SMALL} />
          <Button asChild className="w-full" size="sm" variant="outline">
            <Link href={CART_PATH}>カートを見る</Link>
          </Button>
        </div>

        <ScrollArea aria-label="カートの明細" className="min-h-0 flex-1">
          <CartLineList
            slots={cart.lines.map((line) => ({
              productId: line.productId,
              row: <CartLineRow key={line.productId} line={line} />,
            }))}
          />
        </ScrollArea>

        <CartClearButton />
      </div>
    );
  },
);
