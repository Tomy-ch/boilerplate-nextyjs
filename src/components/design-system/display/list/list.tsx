import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type { ComponentProps } from "react";

import { cn } from "@/components/cn";
import { Separator } from "../separator/separator";
import {
  LIST_ITEM_MEDIA_VARIANT,
  LIST_ITEM_SIZE,
  LIST_ITEM_VARIANT,
  type ListItemMediaVariant,
  type ListItemSize,
  type ListItemVariant,
} from "./list.definition";

/**
 * 同型の行を縦に並べる、SSR first の一覧。
 *
 * @remarks
 * `ul` を render し、子は `ListItem` と `ListSeparator` に限る。順序に意味がある一覧では
 * `asChild` で `ol` へ合成する。
 *
 * 列を揃えて属性を比較させたい場合は `Table`、情報と操作を囲う塊は `Card` を使う。
 *
 * @param props.asChild - 単一の子要素へ合成するか。`ol` を渡す場合に指定する。
 *
 * @see Storybook `Display/List`
 */
function List({
  asChild = false,
  className,
  ...props
}: ComponentProps<"ul"> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "ul";

  return <Comp className={cn("flex flex-col", className)} data-slot="list" {...props} />;
}

const listItemVariants = cva(
  "group/list-item flex flex-wrap items-center rounded-md border border-transparent text-sm transition-colors duration-100",
  {
    variants: {
      variant: {
        [LIST_ITEM_VARIANT.DEFAULT]: "bg-transparent",
        [LIST_ITEM_VARIANT.OUTLINE]: "border-border",
        [LIST_ITEM_VARIANT.MUTED]: "bg-muted/50",
      },
      size: {
        [LIST_ITEM_SIZE.DEFAULT]: "gap-4 p-4",
        [LIST_ITEM_SIZE.SMALL]: "gap-2.5 px-4 py-3",
      },
    },
    defaultVariants: {
      variant: LIST_ITEM_VARIANT.DEFAULT,
      size: LIST_ITEM_SIZE.DEFAULT,
    },
  },
);

/**
 * 一覧の行 1 件。
 *
 * @remarks
 * `li` を render するため、`List` の直下に置く。媒体・見出し・説明・補助操作を子として組み立てる。
 *
 * 行全体を遷移先にする場合は、この要素を link に差し替えず `ListItemLink` を子に置く。`li` を
 * 失うと `ul` の意味論が崩れる。
 *
 * @param props.variant - 面の見せ方。{@link LIST_ITEM_VARIANT} のいずれか。
 * @param props.size - 余白の大きさ。{@link LIST_ITEM_SIZE} のいずれか。
 *
 * @see Storybook `Display/List`
 */
function ListItem({
  className,
  variant = LIST_ITEM_VARIANT.DEFAULT,
  size = LIST_ITEM_SIZE.DEFAULT,
  ...props
}: Omit<ComponentProps<"li">, "size"> &
  Omit<VariantProps<typeof listItemVariants>, "size" | "variant"> & {
    size?: ListItemSize;
    variant?: ListItemVariant;
  }) {
  return (
    <li
      className={cn(listItemVariants({ variant, size, className }))}
      data-size={size}
      data-slot="list-item"
      data-variant={variant}
      {...props}
    />
  );
}

/**
 * 行全体を遷移先にする link。
 *
 * @remarks
 * `ListItem` の子として置き、媒体・見出し・説明を内側へ入れる。`li` を保ったまま行全体を
 * 操作対象にするための要素で、`BreadcrumbLink` / `PaginationLink` と同じ役割にあたる。
 *
 * リポジトリ内の遷移では `asChild` を指定して `next/link` の `Link` を子に渡す。
 *
 * @param props.asChild - 単一の子要素へ合成するか。
 *
 * @see Storybook `Display/List`
 */
function ListItemLink({
  asChild = false,
  className,
  ...props
}: ComponentProps<"a"> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "a";

  return (
    <Comp
      className={cn(
        "-m-2 flex flex-1 flex-wrap items-center gap-4 rounded-md p-2 transition-colors hover:bg-accent/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active focus-visible:shadow-glow-primary",
        className,
      )}
      data-slot="list-item-link"
      {...props}
    />
  );
}

const listItemMediaVariants = cva(
  "flex shrink-0 items-center justify-center gap-2 group-has-[[data-slot=list-item-description]]/list-item:translate-y-0.5 group-has-[[data-slot=list-item-description]]/list-item:self-start [&_svg]:pointer-events-none",
  {
    variants: {
      variant: {
        [LIST_ITEM_MEDIA_VARIANT.DEFAULT]: "bg-transparent",
        [LIST_ITEM_MEDIA_VARIANT.ICON]:
          "size-8 rounded-sm border border-border bg-muted text-foreground [&_svg:not([class*='size-'])]:size-4",
        [LIST_ITEM_MEDIA_VARIANT.IMAGE]:
          "size-10 overflow-hidden rounded-sm [&_img]:size-full [&_img]:object-cover",
      },
    },
    defaultVariants: {
      variant: LIST_ITEM_MEDIA_VARIANT.DEFAULT,
    },
  },
);

/**
 * 行の先頭に置くアイコンや画像。
 *
 * @remarks
 * `icon` は控えめな面（`bg-muted`）に載せ、内容の色を `text-foreground` にする。
 *
 * @param props.variant - 媒体の種類。{@link LIST_ITEM_MEDIA_VARIANT} のいずれか。
 *
 * @see Storybook `Display/List`
 */
function ListItemMedia({
  className,
  variant = LIST_ITEM_MEDIA_VARIANT.DEFAULT,
  ...props
}: ComponentProps<"div"> &
  Omit<VariantProps<typeof listItemMediaVariants>, "variant"> & {
    variant?: ListItemMediaVariant;
  }) {
  return (
    <div
      className={cn(listItemMediaVariants({ variant, className }))}
      data-slot="list-item-media"
      data-variant={variant}
      {...props}
    />
  );
}

/**
 * 見出しと説明をまとめる領域。
 *
 *
 * @see Storybook `Display/List`
 */
function ListItemContent({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex flex-1 flex-col gap-1 [&+[data-slot=list-item-content]]:flex-none",
        className,
      )}
      data-slot="list-item-content"
      {...props}
    />
  );
}

/**
 * 行の主題。
 *
 *
 * @see Storybook `Display/List`
 */
function ListItemTitle({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("flex w-fit items-center gap-2 text-sm leading-snug font-emphasis", className)}
      data-slot="list-item-title"
      {...props}
    />
  );
}

/**
 * 主題を補足する説明文。
 *
 * @remarks
 * 2 行で切り詰める。全文を見せる必要がある場合は `className` で上書きする。
 *
 *
 * @see Storybook `Display/List`
 */
function ListItemDescription({ className, ...props }: ComponentProps<"p">) {
  return (
    <p
      className={cn(
        "line-clamp-2 text-sm leading-normal font-normal text-balance text-muted-foreground",
        "[&>a]:underline [&>a]:underline-offset-4 [&>a:hover]:text-secondary",
        className,
      )}
      data-slot="list-item-description"
      {...props}
    />
  );
}

/**
 * 行の末尾に置く補助操作の領域。
 *
 *
 * @see Storybook `Display/List`
 */
function ListItemActions({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("flex items-center gap-2", className)}
      data-slot="list-item-actions"
      {...props}
    />
  );
}

/**
 * 行の上へ添える補足の一行。
 *
 *
 * @see Storybook `Display/List`
 */
function ListItemHeader({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("flex basis-full items-center justify-between gap-2", className)}
      data-slot="list-item-header"
      {...props}
    />
  );
}

/**
 * 行の下へ添える補足の一行。
 *
 *
 * @see Storybook `Display/List`
 */
function ListItemFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("flex basis-full items-center justify-between gap-2", className)}
      data-slot="list-item-footer"
      {...props}
    />
  );
}

/**
 * 行の間に置く区切り。
 *
 * @remarks
 * `ul` の直下に置けるよう `li` として render し、読み上げ対象から外す。区切りは装飾であり、
 * 一覧の構造は `ul` と `li` が伝える。
 *
 *
 * @see Storybook `Display/List`
 */
function ListSeparator({ className, ...props }: ComponentProps<"li">) {
  return (
    <li aria-hidden="true" data-slot="list-separator" role="presentation" {...props}>
      <Separator className={cn("my-0", className)} decorative orientation="horizontal" />
    </li>
  );
}

export {
  List,
  ListItem,
  ListItemActions,
  ListItemContent,
  ListItemDescription,
  ListItemFooter,
  ListItemHeader,
  ListItemLink,
  ListItemMedia,
  ListItemTitle,
  ListSeparator,
};
