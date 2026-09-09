import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/components/cn";
import { SURFACE } from "@/components/design-system/foundation/surface/surface.definition";
import { SurfacePortalBridge } from "@/components/design-system/foundation/surface/surface-portal-bridge";
import { ContentContainer } from "../content-container/content-container";
import {
  ADMIN_SHELL_HEADER_HEIGHT,
  ADMIN_SHELL_MAIN_ID,
  type AdminShellNavGroup,
} from "./admin-shell.definition";
import { AdminShellMenu } from "./admin-shell-menu";
import { AdminShellNav } from "./admin-shell-nav";
import { AdminShellNavStateProvider } from "./admin-shell-nav-state";
import { AdminShellNavToggle } from "./admin-shell-nav-toggle";

/** `AdminShell` の props。 */
export type AdminShellProps = {
  /** header の左端に置くサイト名。 */
  siteName: string;
  /** サイト名を押したときの行き先。 */
  siteHref: string;
  /** 脇の一覧の先頭に置く、管理側の名称。 */
  consoleName: string;
  /** 管理側の名称を押したときの行き先。 */
  homeHref: string;
  /** 脇に並べる導線。狭い画面では overlay へ畳まれる。 */
  navGroups: readonly AdminShellNavGroup[];
  /** `main` の中身。 */
  children: ReactNode;
  /** header の右端に並べる要素。 */
  headerActions?: ReactNode;
  /** 脇の一覧の下端に置く要素。 */
  navFooter?: ReactNode;
  /** `main` の先頭に置く、現在地までの階層。 */
  breadcrumb?: ReactNode;
  /** `main` に追加する class 名。 */
  className?: string;
};

/**
 * 管理画面の外枠。脇の導線一覧 / header / skip link / `main` を持つ。
 *
 * @remarks
 * 利用者向けの `AppShell` とは**別の器**です。1 枚にまとめると、見せる相手で導線を差し替える
 * 分岐を器の中に抱えます。導線の数と深さも違い、管理側は横並びに収まりません。
 *
 * 導線を横ではなく脇へ置くのは、増える方向が縦だからです。管理の操作は対象ごとに増え、横並びの
 * header は増えるたびに畳む幅が上がります。
 *
 * **脇の一覧は畳めます。** 開閉は {@link AdminShellNavStateProvider} が持ち、器自身は Server
 * Component のままです。
 *
 * **脇に一覧を常設するのは `lg` 以上だけです。** それ未満は {@link AdminShellMenu} の overlay へ
 * 畳みます。タブレットの縦持ちは `md` 以上 `lg` 未満に集中しており、その帯で脇に幅を割くと本文に
 * 残る幅がモバイルとほとんど変わりません。
 *
 * **`main` は幅を絞りません。** 読み幅と左右余白は `ContentContainer` の責務です。
 *
 * **管理の系統（`data-surface`）をここが名乗ります。** 器そのものが「管理側である」ことを表す
 * 唯一の要素なので、系統の切替もここが持ちます。配下の部品は token を引き直すだけで、改修は
 * 要りません（`tokens/README.md`「切替の軸は 2 本」）。
 *
 * **overlay の中身へは {@link SurfacePortalBridge} が届けます。** Radix の Portal は
 * `document.body` 直下へ出るため、この要素に属性を置くだけでは overlay が属性の外へ落ちます。
 *
 * **器は紙に出しません。** header・脇の一覧・skip link はいずれも画面を渡り歩くためのもので、
 * 紙の上では押せず場所を取るだけです（`components/design-system/foundation/print`）。
 *
 * **`headerActions` と `navFooter` の中身は知りません。** 置き場所だけを用意し、何を出すかは
 * 渡す側が決めます。利用者向け画面へ戻る導線もその 1 つで、器は行き先を持ちません。
 *
 * **現在地までの階層は器が位置を持ちます。** 画面ごとに置くと、同じものが画面ごとに違う高さへ
 * 現れます。中身は渡す側が組み、器が知るのは `main` の先頭という位置だけです。本文と同じ
 * `ContentContainer` へ入れるのは、階層と本文の左端が揃っていなければ現在地が本文の外側の
 * 飾りに見えるためで、`main` 自身は幅を持ったままではありません。
 *
 * @see Storybook `Layout/AdminShell`
 */
export function AdminShell({
  siteName,
  siteHref,
  consoleName,
  homeHref,
  navGroups,
  children,
  headerActions,
  navFooter,
  breadcrumb,
  className,
}: AdminShellProps) {
  return (
    <AdminShellNavStateProvider
      className="group/shell flex min-h-screen"
      data-surface={SURFACE.ADMIN}
    >
      <SurfacePortalBridge surface={SURFACE.ADMIN} />
      <a
        href={`#${ADMIN_SHELL_MAIN_ID}`}
        className="print-hidden sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
      >
        本文へスキップ
      </a>
      <aside className="print-hidden sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r bg-background group-data-[nav-open=true]/shell:lg:flex">
        <div
          className="flex shrink-0 items-center border-b px-4"
          style={{ height: ADMIN_SHELL_HEADER_HEIGHT }}
        >
          <Link href={homeHref} className="font-emphasis">
            {consoleName}
          </Link>
        </div>
        <AdminShellNav
          className="min-h-0 flex-1 overflow-y-auto p-3"
          groups={navGroups}
          label="管理メニュー"
        />
        {navFooter === undefined ? null : (
          <div className="shrink-0 border-t p-3 text-sm text-muted-foreground">{navFooter}</div>
        )}
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className="print-hidden sticky top-0 z-40 border-b bg-background/95 backdrop-blur"
          style={{ height: ADMIN_SHELL_HEADER_HEIGHT }}
        >
          <div className="flex h-full w-full items-center gap-2 px-4 md:px-6">
            <AdminShellMenu groups={navGroups} />
            <AdminShellNavToggle />
            <Link href={siteHref} className="font-emphasis">
              {siteName}
            </Link>
            <div className="ml-auto flex items-center gap-1">{headerActions}</div>
          </div>
        </header>
        <main id={ADMIN_SHELL_MAIN_ID} className={cn("min-w-0 flex-1", className)}>
          {breadcrumb === undefined ? null : (
            // 中身が空なら器ごと畳む。階層を持たない画面にも slot は要素を渡すため、渡された
            // かどうかでは判定できない。畳まないと、階層の無い画面が上端に空白を抱える。
            <ContentContainer className="print-hidden pt-6 empty:hidden">
              {breadcrumb}
            </ContentContainer>
          )}
          {children}
        </main>
      </div>
    </AdminShellNavStateProvider>
  );
}
