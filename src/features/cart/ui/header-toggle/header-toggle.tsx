"use client";

import { useCallback } from "react";

import { Button } from "@/components/design-system/action/button/button";
import { useCartStore } from "@/stores/cart-store";

import { CartCount } from "../count/count";

/** `CartHeaderToggle` の props。 */
export type CartHeaderToggleProps = {
  /** header に出す点数のもとになるカート。 */
  count: number;
};

/**
 * 脇に常設できる幅での、カートの入口。
 *
 * @remarks
 * 中身を持ちません。押すと脇の領域が出るか消えるかで、開閉の要求そのものは `stores` が持ちます。
 *
 * `aria-expanded` を持たせるのは、この操作が別の領域の開閉を担っているためです。
 */
export function CartHeaderToggle({ count }: CartHeaderToggleProps) {
  const isOpen = useCartStore((state) => state.isOpen);
  const setOpen = useCartStore((state) => state.setOpen);
  const toggle = useCallback(() => setOpen(!isOpen), [isOpen, setOpen]);

  return (
    <Button
      aria-expanded={isOpen}
      aria-label={isOpen ? "カートを閉じる" : "カートを開く"}
      onClick={toggle}
      size="sm"
      type="button"
      variant="ghost"
    >
      <CartCount count={count} />
    </Button>
  );
}
