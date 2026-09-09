import Link from "next/link";
import { type ReactNode, Suspense } from "react";

import { cn } from "@/components/cn";
import { PullToRefresh } from "../pull-to-refresh/pull-to-refresh";
import {
  APP_SHELL_HEADER_HEIGHT,
  APP_SHELL_MAIN_ID,
  type AppShellNavItem,
} from "./app-shell.definition";
import { AppShellMenu, AppShellMenuFallback } from "./app-shell-menu";
import { AppShellNavLink } from "./app-shell-nav-link";

/** `AppShell` の props。 */
export type AppShellProps = {
  /** header 左端に置く名称。遷移先はトップ。 */
  siteName: string;
  /** header に並べる導線。狭い画面では side menu に畳まれ、{@link menuNavSlot} と併せて空なら menu を出さない。 */
  navItems: readonly AppShellNavItem[];
  /**
   * header の導線の末尾へ差す要素。
   *
   * @remarks
   * **主体を知らなければ決まらない導線の置き場です。** 取得を待つものを {@link navItems} へ混ぜると、
   * 器そのものが待つことになり、この器を通る画面がすべて動的描画になります。待つ側を穴として
   * 渡します。
   *
   * **side menu の側は {@link menuNavSlot} が別に受け取ります。** 同じ要素を両方へ流せないのは、
   * menu の中の導線だけが履歴を積まずに移るためです（`AppShellNavLink`）。
   */
  navSlot?: ReactNode;
  /** side menu の導線の末尾へ差す要素。header 側は {@link navSlot}。 */
  menuNavSlot?: ReactNode;
  /** `main` の中身。 */
  children: ReactNode;
  /** header の導線の後ろに並べる要素。 */
  headerActions?: ReactNode;
  /** `main` の脇に並べる領域。幅と区切り線は渡す側が決める。 */
  sidebar?: ReactNode;
  /** footer に置く文言。 */
  footer?: ReactNode;
  /** `main` に追加する class 名。 */
  className?: string;
};

/**
 * 画面の外枠。header / nav / skip link / `main` / footer を持つ。
 *
 * @remarks
 * **`main` は幅を絞りません。** 読み幅と左右余白は `ContentContainer` の責務です。両方が幅を
 * 持つと、画面ごとにどちらが効いているのかを読まないと分からなくなります。全幅の背景や図を
 * 置く画面も、shell を剥がさずに済みます。
 *
 * skip link を先頭に置くのは、キーボードと支援技術の利用者が header の導線を毎回辿らずに
 * 本文へ入れるようにするためです。
 *
 * admin 側は別の shell を持ちます。見せる相手も導線も違うため、1 枚にまとめると分岐を shell の
 * 中に抱えることになります。
 *
 * **器は紙に出しません。** header・footer・skip link はいずれも画面を渡り歩くためのもので、紙の
 * 上では押せず場所を取るだけです（`components/design-system/foundation/print`）。どの画面を
 * 印刷しても器の判断は同じなのでここで決め、中身の何を落とすかは画面ごとに違うので画面が決めます。
 *
 * **`main` は縮める。** 脇に領域を並べる帯では `main` が flex の項目になり、既定では中身の
 * 最小幅より狭くなれません。段組みや長い語を持つ画面がその最小幅を押し上げると、`main` が
 * 親をはみ出して画面全体に横スクロールが出ます。中身の側で防ぐことはできないため、器が縮む
 * ことを宣言します。
 *
 * **`sidebar` と `headerActions` の中身は知りません。** 置き場所だけを用意し、何を出すか・いつ出すか・
 * どれだけの幅を取るかは渡す側が決めます。shell が中身を知ると、画面ごとの出し分けが分岐として
 * ここに集まります。
 *
 * @see Storybook `Layout/AppShell`
 */
export function AppShell({
  siteName,
  navItems,
  navSlot,
  menuNavSlot,
  children,
  headerActions,
  sidebar,
  footer,
  className,
}: AppShellProps) {
  // 待ち枠と本体は同じ条件で落とす。片方だけ残すと、届いてから消える枠が header の中身を左へずらす。
  const hasMenu = navItems.length > 0 || menuNavSlot !== undefined;

  return (
    <>
      <PullToRefresh />
      <a
        href={`#${APP_SHELL_MAIN_ID}`}
        className="print-hidden sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active focus-visible:shadow-glow-primary"
      >
        本文へスキップ
      </a>
      <header
        className="print-hidden sticky top-0 z-40 border-b bg-background/95 backdrop-blur"
        style={{ height: APP_SHELL_HEADER_HEIGHT }}
      >
        <div className="mx-auto flex h-full w-full max-w-5xl items-center gap-2 px-4 md:px-6">
          {hasMenu ? (
            <Suspense fallback={<AppShellMenuFallback />}>
              <AppShellMenu items={navItems} navSlot={menuNavSlot} />
            </Suspense>
          ) : null}
          {/* 銘はラテンのみの書体を当てる。和文を含む文字列に当てると 1 語の中で書体が変わる */}
          <Link href="/" className="font-brand tracking-wider">
            {siteName}
          </Link>
          <div className="ml-auto flex items-center gap-1">
            <nav aria-label="主要な導線" className="hidden items-center gap-1 md:flex">
              {navItems.map((item) => (
                <AppShellNavLink key={item.href} item={item} />
              ))}
              {navSlot}
            </nav>
            {headerActions}
          </div>
        </div>
      </header>
      <div className="flex flex-1 flex-col md:flex-row">
        <main id={APP_SHELL_MAIN_ID} className={cn("min-w-0 flex-1", className)}>
          {children}
        </main>
        {sidebar}
      </div>
      <footer className="border-t py-6 print-hidden">
        <div className="mx-auto w-full max-w-5xl px-4 text-sm text-muted-foreground md:px-6">
          {footer}
        </div>
      </footer>
    </>
  );
}
