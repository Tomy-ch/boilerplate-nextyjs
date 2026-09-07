import type { ReactNode } from "react";

import { AppShell } from "@/components/shell/app-shell/app-shell";
import { SiteFooter } from "@/features/site-info/ui/site-footer/site-footer";

import { GLOBAL_NAV_ITEMS } from "../global-nav";

const SITE_NAME = "nextjs-boilerplate";

/**
 * サイトの案内の外枠。
 *
 * @remarks
 * **何も取得しないことがこの器の役目です。** 配下は `/about` `/privacy` `/terms` の 3 枚で、
 * どれも内容が変わるのはコードを書き換えたときだけです。ところが器が 1 つでも request 時の API に
 * 触れると、その route group の画面はすべて動的側へ倒れます。静的な殻と動的な穴を分ける仕組み
 * （PPR）は採っていないため、**3 枚を build 時に固めるには、器がカートも session も
 * 読まないところまで下がるしかありません**。
 *
 * `(shop)` から分けたのはそのためで、見せたい姿が違うからではありません。したがって global nav は
 * 同じものを出します（`../global-nav.ts`）。
 *
 * **その代わり、カートの入口と管理への導線はここに出ません。** どちらも読んだ状態を映すもので、
 * 出すには request 時に読む必要があります。カートは header の入口が消えるだけで `/cart` へは
 * 到達でき、管理は出さない側が安全側です。
 */
export default function SiteInfoLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell siteName={SITE_NAME} navItems={GLOBAL_NAV_ITEMS} footer={<SiteFooter />}>
      {children}
    </AppShell>
  );
}
