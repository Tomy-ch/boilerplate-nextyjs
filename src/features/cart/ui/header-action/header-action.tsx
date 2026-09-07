"use client";

import dynamic from "next/dynamic";

import { useMediaQuery } from "@/capabilities/use-media-query";
import { mediaBelow } from "@/model/breakpoint";
import type { Cart } from "@/model/cart/cart";

import { CartHeaderToggle } from "../header-toggle/header-toggle";

/**
 * 本文へ被せる姿は、脇に常設できない幅でしか描かれない。
 *
 * @remarks
 * 静的に import すると、被せる器（overlay の機構と中身一式）がどの画面の最初の読み込みにも乗ります。
 * 出るのは `lg` 未満だけなので、そこへ来たときに読みます
 * （[0101](../../../../../docs/adr/0101-performance-budget.md)）。
 */
const CartHeaderDrawer = dynamic(() =>
  import("../header-drawer/header-drawer").then((module) => module.CartHeaderDrawer),
);

/**
 * 脇に常設できない幅。タブレットを含む
 * （`docs/rules.md`「レイアウトと帯」の「脇に常設する領域は `lg` 以上でだけ出す」）。
 */
const NARROW = mediaBelow("lg");

/** `CartHeaderAction` の props。 */
export type CartHeaderActionProps = {
  /** 表示するカート。 */
  cart: Cart;
};

/**
 * header に置くカートの入口。帯に応じてどちらの姿を出すかだけを決める。
 *
 * @remarks
 * **姿が 2 つあります。** 脇に常設できる幅では脇の領域を開け閉めする切り替えになり、それ未満では
 * 本文へ被せる drawer になります。中身も操作も別物なので、部品も分けてあります。ここが持つのは
 * どちらを出すかだけです。
 *
 * 要求の意味は幅で変わりません。広い幅では脇の領域が出るか消えるか、狭い幅では drawer が開くか
 * 閉じるかになるだけで、どちらも「中身を見たい」という同じ 1 つの要求です。
 *
 * 出し分けを CSS ではなく media query の購読で行うのは、drawer が focus trap を持つためです。
 * CSS で隠しても DOM は残るため、広い幅でも focus が閉じ込められます。
 *
 * **その代わり、初回描画は常に常設側の姿です。** 押せるようになるのは hydration が終わってからで、
 * この入れ替えは許容しています。押せる状態に見せるには出し分けを CSS へ移す必要があり、そうすると
 * 点数が 2 か所に出て、幅ごとの姿を存在の有無で検証できなくなります。
 */
export function CartHeaderAction({ cart }: CartHeaderActionProps) {
  const isNarrow = useMediaQuery(NARROW);

  return isNarrow ? (
    <CartHeaderDrawer cart={cart} />
  ) : (
    <CartHeaderToggle count={cart.lines.length} />
  );
}
