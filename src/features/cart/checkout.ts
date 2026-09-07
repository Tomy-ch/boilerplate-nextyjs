import type { Cart } from "@/model/cart/cart";

import { isPurchasable } from "@/model/cart/issue-notice";

/**
 * 購入手続きへ進めるか。
 *
 * @remarks
 * 買える明細が 1 つでもあれば進めます。**判定をここに 1 つだけ置くのは、進める / 進めないの見せ方が
 * 器ごとに違うためです**。脇の領域では小さなボタン、全画面では理由を添えた大きなボタンになりますが、
 * 進めるかどうかの規則は 1 つです。
 *
 * 買えるかどうかの判定そのものはバックエンドが持ちます。ここが決めるのは、その結果を画面の可否へ
 * 写す一段だけです。
 */
export function canCheckout(cart: Cart): boolean {
  return cart.lines.some(isPurchasable);
}
