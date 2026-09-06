import { Slot } from "radix-ui";
import type { ComponentProps } from "react";

import { cn } from "@/components/cn";
import { ChevronRightIcon, EllipsisIcon } from "@/components/icon";

/**
 * 現在地までの階層を示す、SSR first の navigation landmark。
 *
 * @remarks
 * `nav` として landmark を作り、他の navigation と区別できるよう名前を持つ。表示だけの部品で、
 * 現在の route の判定や階層の組み立ては呼び出し元が行う。
 *
 * 階層が 1 段しかない画面には置かない。到達経路が 1 つに定まらない画面（複数の入口から開く
 * 詳細など）では、実際にたどった経路ではなくサイト構造上の階層を示す。
 *
 * @param props - native `nav` 属性。
 *
 * @see Storybook `Navigation/Breadcrumb`
 */
function Breadcrumb({ ...props }: ComponentProps<"nav">) {
  return <nav aria-label="パンくずリスト" data-slot="breadcrumb" {...props} />;
}

/**
 * 階層を並べる順序付きリスト。
 *
 * @remarks
 * `ol` として順序に意味があることを示す。`Breadcrumb` の直下に置き、子は `BreadcrumbItem` と
 * `BreadcrumbSeparator` に限る。
 *
 * @param props - native `ol` 属性。
 *
 * @see Storybook `Navigation/Breadcrumb`
 */
function BreadcrumbList({ className, ...props }: ComponentProps<"ol">) {
  return (
    <ol
      className={cn(
        "flex flex-wrap items-center gap-1.5 text-sm break-words text-muted-foreground sm:gap-2.5",
        className,
      )}
      data-slot="breadcrumb-list"
      {...props}
    />
  );
}

/**
 * 階層 1 段ぶんの項目。
 *
 * @param props - native `li` 属性。
 *
 * @see Storybook `Navigation/Breadcrumb`
 */
function BreadcrumbItem({ className, ...props }: ComponentProps<"li">) {
  return (
    <li
      className={cn("inline-flex items-center gap-1.5", className)}
      data-slot="breadcrumb-item"
      {...props}
    />
  );
}

/**
 * 上位階層へ戻る link。
 *
 * @remarks
 * 既定では `a` を render する。リポジトリ内の遷移では `asChild` を指定して `next/link` の
 * `Link` を子に渡す。
 *
 * @param props - native `a` 属性。
 * @param props.asChild - 単一の子要素へ合成するか。
 *
 * @see Storybook `Navigation/Breadcrumb`
 */
function BreadcrumbLink({
  asChild,
  className,
  ...props
}: ComponentProps<"a"> & {
  asChild?: boolean;
}) {
  const Comp = asChild ? Slot.Root : "a";

  return (
    <Comp
      className={cn("transition-colors hover:text-foreground", className)}
      data-slot="breadcrumb-link"
      {...props}
    />
  );
}

/**
 * 現在地を示す末尾の項目。
 *
 * @remarks
 * 自分自身への遷移は提供しないため link にはせず、`aria-current="page"` だけで現在地であること
 * を伝える。生成物は `role="link"` と `aria-disabled` を付けるが、focus できない要素に
 * interactive role を与えることになり a11y lint に反するため採らない。
 *
 * @param props - native `span` 属性。
 *
 * @see Storybook `Navigation/Breadcrumb`
 */
function BreadcrumbPage({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      aria-current="page"
      className={cn("font-normal text-foreground", className)}
      data-slot="breadcrumb-page"
      {...props}
    />
  );
}

/**
 * 項目の間に置く区切り。
 *
 * @remarks
 * 装飾なので読み上げ対象から外す。階層の関係は `ol` の構造が伝えるため、区切り自体に意味を
 * 持たせない。既定の記号を変える場合は `children` へ任意の要素を渡す。
 *
 * @param props - native `li` 属性。
 *
 * @see Storybook `Navigation/Breadcrumb`
 */
function BreadcrumbSeparator({ children, className, ...props }: ComponentProps<"li">) {
  return (
    <li
      aria-hidden="true"
      className={cn("[&>svg]:size-3.5", className)}
      data-slot="breadcrumb-separator"
      role="presentation"
      {...props}
    >
      {children ?? <ChevronRightIcon />}
    </li>
  );
}

/**
 * 折り畳んだ中間階層を示す省略記号。
 *
 * @remarks
 * 階層が長い場合に中間を省略して表示するための記号で、それ自体は開閉しない。省略した階層へ
 * 到達させる場合は、`DropdownMenu` などの操作を呼び出し元が合成する。
 *
 * @param props - native `span` 属性。
 *
 * @see Storybook `Navigation/Breadcrumb`
 */
function BreadcrumbEllipsis({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      className={cn("flex size-9 items-center justify-center", className)}
      data-slot="breadcrumb-ellipsis"
      {...props}
    >
      {/* 隠すのは記号だけ。外側に付けると子孫ごとアクセシビリティツリーから外れ、
          sr-only の文言も一緒に消える。 */}
      <EllipsisIcon aria-hidden="true" className="size-4" />
      <span className="sr-only">省略された階層</span>
    </span>
  );
}

export {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
};
