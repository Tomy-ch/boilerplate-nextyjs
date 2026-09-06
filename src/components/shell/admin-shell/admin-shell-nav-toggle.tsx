"use client";

import { Button } from "@/components/design-system/action/button/button";
import { SidebarIcon } from "@/components/icon";

import { useAdminShellNav } from "./admin-shell-nav-state";

/**
 * 脇の一覧を出す・畳む操作。
 *
 * @remarks
 * 脇に一覧を常設できる幅でだけ出します。それ未満の幅では一覧そのものが overlay へ畳まれており、
 * 畳む余地がありません。同じ位置にある操作の結果が幅によって変わらないよう、開く操作
 * （`AdminShellMenu`）とは別の部品にしてあります。
 *
 * @see Storybook `Layout/AdminShell`
 */
export function AdminShellNavToggle() {
  const { open, toggle } = useAdminShellNav();

  return (
    <Button
      aria-expanded={open}
      aria-label="メニューの開閉"
      className="hidden lg:inline-flex"
      onClick={toggle}
      size="sm"
      variant="ghost"
    >
      <SidebarIcon aria-hidden="true" />
    </Button>
  );
}
