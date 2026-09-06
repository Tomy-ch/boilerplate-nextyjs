"use client";

import { cva } from "class-variance-authority";
import { NavigationMenu as NavigationMenuPrimitive } from "radix-ui";
import type { ComponentProps } from "react";

import { cn } from "@/components/cn";
import { ChevronDownIcon } from "@/components/icon";

/**
 * サイト構造の中の主要な遷移先を並べる、client island の navigation root。
 *
 * @remarks
 * 開閉・hover 遅延・focus 移動を browser 側で行うため hydration が必要で、Server Component から
 * 直接 render できない。
 *
 * 下位階層を開かない単純な navigation にはこの部品を使わない。`nav` と `Link` を並べるだけで
 * 足り、client runtime も不要である。この部品を選ぶのは、trigger で下位項目を開く必要が確定した
 * 場合に限る。
 *
 * 現在地の明示は `Breadcrumb`、ページ内の一覧送りは `Pagination` が担う。
 *
 * @param props - Radix `NavigationMenu.Root` の props。
 * @param props.viewport - 開いた内容を共通の viewport へまとめるか。`false` にすると各項目の
 *   直下へ表示する。
 *
 * @see Storybook `Navigation/NavigationMenu`
 */
function NavigationMenu({
  className,
  children,
  viewport = true,
  ...props
}: ComponentProps<typeof NavigationMenuPrimitive.Root> & {
  viewport?: boolean;
}) {
  return (
    <NavigationMenuPrimitive.Root
      data-slot="navigation-menu"
      data-viewport={viewport}
      className={cn(
        "group/navigation-menu relative flex max-w-max flex-1 items-center justify-center",
        className,
      )}
      {...props}
    >
      {children}
      {viewport ? <NavigationMenuViewport /> : null}
    </NavigationMenuPrimitive.Root>
  );
}

/**
 * 遷移先を並べるリスト。
 *
 * @param props - Radix `NavigationMenu.List` の props。
 *
 * @see Storybook `Navigation/NavigationMenu`
 */
function NavigationMenuList({
  className,
  ...props
}: ComponentProps<typeof NavigationMenuPrimitive.List>) {
  return (
    <NavigationMenuPrimitive.List
      data-slot="navigation-menu-list"
      className={cn("group flex flex-1 list-none items-center justify-center gap-1", className)}
      {...props}
    />
  );
}

/**
 * 遷移先 1 件ぶんの項目。
 *
 * @remarks
 * 下位階層を持たない項目は `NavigationMenuLink` だけを子に置く。持つ項目は
 * `NavigationMenuTrigger` と `NavigationMenuContent` を組み合わせる。
 *
 * @param props - Radix `NavigationMenu.Item` の props。
 *
 * @see Storybook `Navigation/NavigationMenu`
 */
function NavigationMenuItem({
  className,
  ...props
}: ComponentProps<typeof NavigationMenuPrimitive.Item>) {
  return (
    <NavigationMenuPrimitive.Item
      data-slot="navigation-menu-item"
      className={cn("relative", className)}
      {...props}
    />
  );
}

/** trigger と同じ見た目を、他の要素へ適用するための class を返す。  *
 * @see Storybook `Navigation/NavigationMenu`
 */
const navigationMenuTriggerStyle = cva(
  "group inline-flex h-9 w-max items-center justify-center rounded-md bg-background px-4 py-2 text-sm font-emphasis transition-[color,box-shadow] hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active focus-visible:shadow-glow-primary disabled:pointer-events-none disabled:opacity-50 data-[state=open]:bg-accent/50 data-[state=open]:text-accent-foreground data-[state=open]:hover:bg-accent data-[state=open]:focus:bg-accent",
);

/**
 * 下位階層を開く trigger。
 *
 * @remarks
 * 右端の矢印は装飾で、開閉状態は `aria-expanded` として提供される。trigger 自身は遷移しないため、
 * その階層のトップページへ行かせたい場合は `NavigationMenuContent` の中に link を置く。
 *
 * @param props - Radix `NavigationMenu.Trigger` の props。
 *
 * @see Storybook `Navigation/NavigationMenu`
 */
function NavigationMenuTrigger({
  className,
  children,
  ...props
}: ComponentProps<typeof NavigationMenuPrimitive.Trigger>) {
  return (
    <NavigationMenuPrimitive.Trigger
      data-slot="navigation-menu-trigger"
      className={cn(navigationMenuTriggerStyle(), "group", className)}
      {...props}
    >
      {children}{" "}
      <ChevronDownIcon
        className="relative top-[1px] ml-1 size-3 transition duration-300 group-data-[state=open]:rotate-180"
        aria-hidden="true"
      />
    </NavigationMenuPrimitive.Trigger>
  );
}

/**
 * trigger を開いたときに表示する下位階層。
 *
 * @remarks
 * 中身は遷移先に限る。form や読み物を入れたい場合は `Popover` や `Dialog` を使う。
 *
 * 生成物は `viewport` を使わない場合だけ子の link から focus outline を落とすが、採らない。
 * `viewport` の有無で focus の見え方が変わってしまい、focus 表示を統一する方針に反する。
 *
 * @param props - Radix `NavigationMenu.Content` の props。
 *
 * @see Storybook `Navigation/NavigationMenu`
 */
function NavigationMenuContent({
  className,
  ...props
}: ComponentProps<typeof NavigationMenuPrimitive.Content>) {
  return (
    <NavigationMenuPrimitive.Content
      data-slot="navigation-menu-content"
      className={cn(
        "top-0 left-0 w-full p-2 pr-2.5 data-[motion=from-end]:slide-in-from-right-52 data-[motion=from-start]:slide-in-from-left-52 data-[motion=to-end]:slide-out-to-right-52 data-[motion=to-start]:slide-out-to-left-52 data-[motion^=from-]:animate-in data-[motion^=from-]:fade-in data-[motion^=to-]:animate-out data-[motion^=to-]:fade-out md:absolute md:w-auto",
        "group-data-[viewport=false]/navigation-menu:top-full group-data-[viewport=false]/navigation-menu:mt-1.5 group-data-[viewport=false]/navigation-menu:overflow-hidden group-data-[viewport=false]/navigation-menu:rounded-md group-data-[viewport=false]/navigation-menu:border group-data-[viewport=false]/navigation-menu:bg-popover group-data-[viewport=false]/navigation-menu:text-popover-foreground group-data-[viewport=false]/navigation-menu:shadow group-data-[viewport=false]/navigation-menu:duration-200 group-data-[viewport=false]/navigation-menu:data-[state=closed]:animate-out group-data-[viewport=false]/navigation-menu:data-[state=closed]:fade-out-0 group-data-[viewport=false]/navigation-menu:data-[state=closed]:zoom-out-95 group-data-[viewport=false]/navigation-menu:data-[state=open]:animate-in group-data-[viewport=false]/navigation-menu:data-[state=open]:fade-in-0 group-data-[viewport=false]/navigation-menu:data-[state=open]:zoom-in-95",
        className,
      )}
      {...props}
    />
  );
}

/**
 * 開いた内容をまとめて表示する共通領域。
 *
 * @remarks
 * `NavigationMenu` の `viewport` が `true` のとき内部で描画されるため、通常は直接指定しない。
 *
 * @param props - Radix `NavigationMenu.Viewport` の props。
 *
 * @see Storybook `Navigation/NavigationMenu`
 */
function NavigationMenuViewport({
  className,
  ...props
}: ComponentProps<typeof NavigationMenuPrimitive.Viewport>) {
  return (
    <div className={cn("absolute top-full left-0 isolate z-50 flex justify-center")}>
      <NavigationMenuPrimitive.Viewport
        data-slot="navigation-menu-viewport"
        className={cn(
          "origin-top relative mt-1.5 h-[var(--radix-navigation-menu-viewport-height)] w-full overflow-hidden rounded-md border bg-popover text-popover-foreground shadow data-[state=closed]:animate-out data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:zoom-in-90 md:w-[var(--radix-navigation-menu-viewport-width)]",
          className,
        )}
        {...props}
      />
    </div>
  );
}

/**
 * 遷移先の link。
 *
 * @remarks
 * リポジトリ内の遷移では `asChild` を指定して `next/link` の `Link` を子に渡す。現在地を示す
 * 場合は `active` を渡すと `aria-current="page"` が付く。
 *
 * @param props - Radix `NavigationMenu.Link` の props。
 *
 * @see Storybook `Navigation/NavigationMenu`
 */
function NavigationMenuLink({
  className,
  ...props
}: ComponentProps<typeof NavigationMenuPrimitive.Link>) {
  return (
    <NavigationMenuPrimitive.Link
      data-slot="navigation-menu-link"
      className={cn(
        "flex flex-col gap-1 rounded-sm p-2 text-sm transition-all hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active focus-visible:shadow-glow-primary data-[active=true]:bg-accent/50 data-[active=true]:text-accent-foreground data-[active=true]:hover:bg-accent data-[active=true]:focus:bg-accent [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

/**
 * 開いている項目を指す装飾の矢印。
 *
 * @remarks
 * 位置を示すだけで、開閉状態は trigger の `aria-expanded` が伝える。省略してもよい。
 *
 * @param props - Radix `NavigationMenu.Indicator` の props。
 *
 * @see Storybook `Navigation/NavigationMenu`
 */
function NavigationMenuIndicator({
  className,
  ...props
}: ComponentProps<typeof NavigationMenuPrimitive.Indicator>) {
  return (
    <NavigationMenuPrimitive.Indicator
      data-slot="navigation-menu-indicator"
      className={cn(
        "top-full z-[1] flex h-1.5 items-end justify-center overflow-hidden data-[state=hidden]:animate-out data-[state=hidden]:fade-out data-[state=visible]:animate-in data-[state=visible]:fade-in",
        className,
      )}
      {...props}
    >
      <div className="relative top-[60%] h-2 w-2 rotate-45 rounded-tl-sm bg-border shadow-md" />
    </NavigationMenuPrimitive.Indicator>
  );
}

export {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuIndicator,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  NavigationMenuViewport,
  navigationMenuTriggerStyle,
};
