import { verifySession } from "@/adapters/server/auth/session";
import { AppShellNavLink } from "@/components/shell/app-shell/app-shell-nav-link";
import { ADMIN_PRODUCT_LIST_PATH } from "@/features/admin/paths";
import { isAdmin } from "@/model/authz";

const ADMIN_NAV_ITEM = { href: ADMIN_PRODUCT_LIST_PATH, label: "管理" };

/** `AdminNavEntry` の props。 */
export type AdminNavEntryProps = {
  /** 履歴を積まずに移るか。side menu の中だけが立てる（`AppShellNavLink`）。 */
  replace?: boolean;
};

/**
 * 主体の役割で出し分ける、管理への導線。
 *
 * @remarks
 * **押せる場所を作らないことが出し分けです。** 出したうえで押した先で断ると、管理の面がある
 * 事実だけが誰にでも伝わります。
 *
 * **session の読み出しをこの中に閉じます。** 器の側で読むと cookie に触れた時点で殻が動的になり、
 * この器を通る画面がすべてバックエンドの往復を待ってから 1 バイト目を返します。穴として差せば、
 * 殻は主体を知らないまま固まり、導線だけが後から届きます。
 *
 * 置き場が `features/admin` ではなく器の隣なのは、`adapters/server/auth` を引けるのが `app` と
 * `adapters` だけだからです（`architecture.ts` の `adapters-auth`）。
 */
export async function AdminNavEntry({ replace }: AdminNavEntryProps) {
  return isAdmin(await verifySession()) ? (
    <AppShellNavLink item={ADMIN_NAV_ITEM} replace={replace} />
  ) : null;
}
