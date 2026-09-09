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
 * どれも内容が変わるのはコードを書き換えたときだけです。ところが器が cookie を読む穴を 1 つでも
 * 持つと、殻は先に配られても、その穴を埋めるために要求のたびにサーバーが動きます。
 * **3 枚を build 時の姿だけで配るには、器がカートも session も読まないところまで下がるしか
 * ありません**。
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
