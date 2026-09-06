"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/design-system/action/button/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/design-system/overlay/sheet/sheet";
import { MenuIcon } from "@/components/icon";
import type { AdminShellNavGroup } from "./admin-shell.definition";
import { AdminShellNav } from "./admin-shell-nav";

/** `AdminShellMenu` の props。 */
export type AdminShellMenuProps = {
  /** 並べる導線のまとまり。脇に常設する一覧と同じものを渡す。 */
  groups: readonly AdminShellNavGroup[];
};

/**
 * 脇に一覧を常設できない幅で、同じ導線を overlay へ畳む入口。
 *
 * @remarks
 * 出す中身は脇の一覧と同じです。幅によって導線の顔ぶれが変わると、狭い画面でだけ辿り着けない
 * 場所ができます。
 *
 * **選んだら閉じますが、閉じるのは移った後です。** 押した時点で閉じると、overlay が積んだ履歴
 * 1 件を戻す動きが遷移そのものと競合します（[0053](../../../../docs/adr/0053-ui-component-interaction-seam.md)）。
 *
 * @see Storybook `Layout/AdminShell`
 */
export function AdminShellMenu({ groups }: AdminShellMenuProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const [shownAt, setShownAt] = useState(pathname);

  // 移った先で閉じる。effect ではなく描画中に畳むのは、閉じた姿を最初の描画で出すためで、
  // 待つと移った先の内容がメニューに覆われたまま 1 フレーム出る。
  if (shownAt !== pathname) {
    setShownAt(pathname);
    setOpen(false);
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="lg:hidden" aria-label="メニューを開く">
          <MenuIcon aria-hidden="true" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72">
        <SheetHeader>
          <SheetTitle>メニュー</SheetTitle>
        </SheetHeader>
        <AdminShellNav className="px-4 pb-4" groups={groups} label="管理メニュー" />
      </SheetContent>
    </Sheet>
  );
}
