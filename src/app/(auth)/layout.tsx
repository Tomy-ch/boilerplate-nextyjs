import type { ReactNode } from "react";

import { AppShell } from "@/components/shell/app-shell/app-shell";

const SITE_NAME = "nextjs-boilerplate";

/**
 * 認証まわりの画面の外枠。
 *
 * @remarks
 * 利用者向けの shell とは別に置きます。ナビゲーションも脇の領域も出さないのは、認証を促している
 * 最中に他の導線を並べると、そこから離脱した利用者が元の操作へ戻れなくなるためです。
 *
 * それでも shell を通すのは、header の site 名から出発点へ戻れる経路を残すためです。枠ごと
 * 外すと、認証をやめたい利用者に「戻る」以外の手段が無くなります。
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell siteName={SITE_NAME} navItems={[]}>
      {children}
    </AppShell>
  );
}
