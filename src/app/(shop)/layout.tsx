import { type ReactNode, Suspense } from "react";

import { AppShell } from "@/components/shell/app-shell/app-shell";
import { CartRemovalNoticeProvider } from "@/features/cart/removal-memory";
import { CartHeaderSlot, CartPanelSlot } from "@/features/cart/ui/shell-slots/shell-slots";
import { SiteFooter } from "@/features/site-info/ui/site-footer/site-footer";

import { GLOBAL_NAV_ITEMS } from "../global-nav";
import { AdminNavEntry } from "./admin-nav-entry";

const SITE_NAME = "nextjs-boilerplate";

/**
 * 利用者向け画面の外枠。
 *
 * @remarks
 * shell を root layout ではなくこの route group に置くのは、admin 側が別の shell を持つためです。
 * root に置くと admin もこの header を経由することになり、切り替えの分岐を shell の中に抱えます。
 * root layout が持つのは `html` / `body` と Provider の mount だけです。
 *
 * カートを画面ごとではなくここへ置くのは、どの画面から追加しても同じ場所に出る必要があるためです。
 * 画面側に置くと、追加できる画面の数だけ mount が増えます。
 *
 * **この器自身は何も取得しません。** cookie を読むもの（カートと session）はすべて `Suspense` の
 * 内側へ落としてあります。器が取得を持つと、その器を通る画面がすべて動的描画になり、
 * 静的な殻を持てません。穴の中身が届くまで、header・nav・footer と本文の殻が先に配られます。
 *
 * 取り消しの記憶は**カートの器より外**へ置きます。最後の 1 件を取り除くと脇の領域もカートの画面も
 * 空の姿へ変わるため、器の内側に持つとその切り替わりで記憶ごと失われます。**ただしこの器を離れると
 * 失われます** —— route group の境界は client 状態の境界でもあり、買い物から出た時点で
 * 失ってよいものとして扱っています。
 */
export default function ShopLayout({ children }: { children: ReactNode }) {
  return (
    <CartRemovalNoticeProvider>
      <AppShell
        siteName={SITE_NAME}
        navItems={GLOBAL_NAV_ITEMS}
        navSlot={
          <Suspense fallback={null}>
            <AdminNavEntry />
          </Suspense>
        }
        menuNavSlot={
          <Suspense fallback={null}>
            <AdminNavEntry replace />
          </Suspense>
        }
        headerActions={
          <Suspense fallback={null}>
            <CartHeaderSlot />
          </Suspense>
        }
        sidebar={
          <Suspense fallback={null}>
            <CartPanelSlot />
          </Suspense>
        }
        footer={<SiteFooter />}
      >
        {children}
      </AppShell>
    </CartRemovalNoticeProvider>
  );
}
