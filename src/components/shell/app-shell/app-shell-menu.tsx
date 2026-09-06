"use client";

import { usePathname } from "next/navigation";
import { type ReactNode, useState } from "react";

import { Button } from "@/components/design-system/action/button/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/design-system/overlay/sheet/sheet";
import { MenuIcon } from "@/components/icon";

import type { AppShellNavItem } from "./app-shell.definition";
import { AppShellNavLink } from "./app-shell-nav-link";

/** `AppShellMenu` の props。 */
export type AppShellMenuProps = {
  /** 並べる導線。header の横並びと同じものを渡す。 */
  items: readonly AppShellNavItem[];
  /** 導線の末尾へ差す要素。主体を待つ導線がここへ来る（`AppShell` の `menuNavSlot`）。 */
  navSlot?: ReactNode;
};

/**
 * side menu が届くまでの枠。
 *
 * @remarks
 * **押せないだけで、大きさは同じです。** menu は現在地を読むため、動的な区間を持つ route では
 * 殻の中で解決できません（[0041](../../../../docs/adr/0041-cache-components-decision.md)）。枠を
 * 置かずに待つと、届いた瞬間に header の中身が右へずれます（`docs/rules.md` #17b）。
 */
export function AppShellMenuFallback() {
  return (
    <Button aria-label="メニューを開く" className="md:hidden" disabled size="sm" variant="ghost">
      <MenuIcon aria-hidden="true" />
    </Button>
  );
}

/**
 * 狭い画面での導線をまとめる side menu。
 *
 * @remarks
 * 開閉の状態だけがブラウザ側の関心で、それ以外は server で描けます。そのため client island は
 * この部品に閉じています。
 *
 * **選んだら閉じますが、閉じるのは移った後です。** 押した時点で閉じると、overlay が積んだ履歴 1 件を
 * 戻す動きが遷移そのものと競合し、閉じるだけで移らない回が出ます。移る側は置き換えで移るため、
 * 積んだ 1 件は移り先に上書きされます（[0053](../../../../docs/adr/0053-ui-component-interaction-seam.md)）。
 *
 * @see Storybook `Layout/AppShell`
 */
export function AppShellMenu({ items, navSlot }: AppShellMenuProps) {
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
        <Button variant="ghost" size="sm" className="md:hidden" aria-label="メニューを開く">
          <MenuIcon aria-hidden="true" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72">
        <SheetHeader>
          <SheetTitle>メニュー</SheetTitle>
        </SheetHeader>
        <nav aria-label="メニュー" className="flex flex-col gap-1 px-4 pb-4">
          {items.map((item) => (
            <AppShellNavLink key={item.href} item={item} replace />
          ))}
          {navSlot}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
