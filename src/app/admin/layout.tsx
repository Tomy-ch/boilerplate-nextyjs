import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { verifySession } from "@/adapters/server/auth/session";
import { Button } from "@/components/design-system/action/button/button";
import { AdminShell } from "@/components/shell/admin-shell/admin-shell";
import type { AdminShellNavGroup } from "@/components/shell/admin-shell/admin-shell.definition";
import {
  ADMIN_ANALYTICS_PATH,
  ADMIN_DASHBOARD_PATH,
  ADMIN_PRODUCT_LIST_PATH,
  ADMIN_SHIPMENT_QUEUE_PATH,
  ADMIN_USER_LIST_PATH,
} from "@/features/admin/paths";
import { UnsavedChangesGuard } from "@/features/admin/ui/unsaved-changes-guard/unsaved-changes-guard";
import { isAdmin } from "@/model/authz";

const SITE_NAME = "nextjs-boilerplate";
const CONSOLE_NAME = "管理";

/** サイトのトップ。役割が足りないときの行き先も兼ねる。 */
const SITE_PATH = "/";

/** 利用者向け画面のうち、管理側から見比べたくなる画面。 */
const USER_SITE_PATH = "/products";

const NAV_GROUPS: readonly AdminShellNavGroup[] = [
  {
    label: "集計",
    items: [
      { href: ADMIN_DASHBOARD_PATH, label: "ダッシュボード" },
      { href: ADMIN_ANALYTICS_PATH, label: "期間別の集計" },
    ],
  },
  { label: "商品", items: [{ href: ADMIN_PRODUCT_LIST_PATH, label: "商品一覧管理" }] },
  { label: "注文", items: [{ href: ADMIN_SHIPMENT_QUEUE_PATH, label: "発送" }] },
  { label: "利用者", items: [{ href: ADMIN_USER_LIST_PATH, label: "利用者一覧" }] },
];

/**
 * 待たずに配れる殻を持たない区画として宣言する。
 *
 * @remarks
 * この器は描画の前に役割を確かめ、持たない主体を送り返します。判定を穴の内側へ落とすと、
 * **確かめる前に管理の殻（コンソール名・管理の導線）が誰にでも配られます**。管理の面がある事実
 * だけでも、確かめる前に外へ出しません。
 *
 * **これは「まだ手を付けていない」印ではありません。** 殻を配れないことがこの区画の要件であり、
 * 認可の位置が変わらない限り外れません。
 */
export const instant = false;

/**
 * 管理画面の外枠。
 *
 * @remarks
 * **ここが確定認可です**。判定に使う役割の宣言は `model/authz` にあり、前捌き（`proxy.ts`）
 * と同じものを引きます。
 *
 * 送り返す先は前捌き（`proxy.ts`）と同じにします。行き先とその理由、403 の面を出さない理由は
 * `docs/spec/route/admin/layout.function.md`「入れない主体をどこへ送るか」。
 *
 * **現在地までの階層は並行の route から受け取ります**（`@breadcrumb`）。器へ渡すのはこの層です
 * が、何段目に何を出すかは画面ごとに違うため、画面と同じ形の route に持たせます。page から
 * layout へ props は渡せないので、slot がその橋渡しになります。
 *
 * **書きかけのまま離れる操作を、器ごと見張ります。** 離れる操作の起点（パンくず・脇の一覧）は
 * 画面より上にあり、画面の内側から包めません。書きかけかどうかを決めるのは入力を持つ画面で、
 * ここはその申告を読むだけです。
 *
 * 導線の顔ぶれをこの層が持つのは、admin にどの画面があるかが route の構成そのものだからです。
 * 器（`AdminShell`）は並べ方だけを知り、何を並べるかは知りません。
 *
 * 利用者向けの `(shop)` とは別の器を敷きます。root layout が持つのは `html` / `body` と Provider の
 * mount だけで、器の選択はこの段が行います。
 */
export default async function AdminLayout({
  children,
  breadcrumb,
}: {
  children: ReactNode;
  breadcrumb: ReactNode;
}) {
  if (!isAdmin(await verifySession())) {
    redirect(SITE_PATH);
  }

  return (
    <UnsavedChangesGuard>
      <AdminShell
        breadcrumb={breadcrumb}
        consoleName={CONSOLE_NAME}
        headerActions={
          <Button asChild size="sm" variant="outline">
            <Link href={USER_SITE_PATH}>ユーザー画面へ</Link>
          </Button>
        }
        homeHref={ADMIN_DASHBOARD_PATH}
        navGroups={NAV_GROUPS}
        siteHref={SITE_PATH}
        siteName={SITE_NAME}
      >
        {children}
      </AdminShell>
    </UnsavedChangesGuard>
  );
}
