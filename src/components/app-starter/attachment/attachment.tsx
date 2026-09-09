import { cva } from "class-variance-authority";
import { Slot } from "radix-ui";
import type { ComponentProps } from "react";

import { cn } from "@/components/cn";

import { Button } from "../../design-system/action/button/button";
import { BUTTON_SIZE, BUTTON_VARIANT } from "../../design-system/action/button/button.definition";
import { ScrollArea } from "../../design-system/container/scroll-area/scroll-area";
import {
  ATTACHMENT_MEDIA_VARIANT,
  ATTACHMENT_ORIENTATION,
  ATTACHMENT_SIZE,
  ATTACHMENT_STATE,
  type AttachmentMediaVariant,
  type AttachmentOrientation,
  type AttachmentSize,
  type AttachmentState,
} from "./attachment.definition";

const attachmentVariants = cva(
  "group/attachment relative flex w-fit max-w-full min-w-0 shrink-0 flex-wrap rounded-xl border border-border bg-card backdrop-blur-panel text-card-foreground transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-active has-[>a,>button]:hover:bg-muted/50 data-[state=error]:border-destructive/30 data-[state=idle]:border-dashed data-[state=processing]:shimmer data-[state=uploading]:shimmer",
  {
    variants: {
      size: {
        [ATTACHMENT_SIZE.DEFAULT]:
          "gap-2 text-sm has-data-[slot=attachment-content]:px-2.5 has-data-[slot=attachment-content]:py-2 has-data-[slot=attachment-media]:p-2",
        [ATTACHMENT_SIZE.SMALL]:
          "gap-2.5 text-xs has-data-[slot=attachment-content]:px-2 has-data-[slot=attachment-content]:py-1.5 has-data-[slot=attachment-media]:p-1.5",
        [ATTACHMENT_SIZE.EXTRA_SMALL]:
          "gap-1.5 rounded-lg text-xs has-data-[slot=attachment-content]:px-1.5 has-data-[slot=attachment-content]:py-1 has-data-[slot=attachment-media]:p-1",
      },
      orientation: {
        [ATTACHMENT_ORIENTATION.HORIZONTAL]: "min-w-40 items-center",
        [ATTACHMENT_ORIENTATION.VERTICAL]: "w-24 flex-col has-data-[slot=attachment-content]:w-30",
      },
    },
  },
);

/** {@link Attachment} の props。 */
export type AttachmentProps = ComponentProps<"div"> & {
  /** 添付の大きさ。 */
  size?: AttachmentSize;
  /** 内容の並べ方。 */
  orientation?: AttachmentOrientation;
  /** 今どの段階にあるか。 */
  state?: AttachmentState;
};

/**
 * 選択済みの添付 1 件を表す枠。
 *
 * @remarks
 * 表示専用の Server Component であり、hydration を必要としない。名前・大きさ・進行状態は
 * 整形済みの内容として子に受け取る。
 *
 * ファイルの選択、送信、削除、再試行は持たない。`state` は見た目を切り替えるだけで、実際の
 * 進行を管理するのは呼び出し元である。`state` は支援技術へ伝わらないため、進行中や失敗は
 * `AttachmentDescription` の文言としても示す。
 *
 * `uploading` と `processing` では枠全体に帯が流れ、処理が止まっていないことを示す。
 * `prefers-reduced-motion` では帯ごと消えるため、これだけに頼らず文言でも示す。
 *
 * 枠全体を押せるようにする場合は `AttachmentTrigger` を子に置く。枠自体は操作にならない。
 *
 * @example
 * ```tsx
 * <Attachment state={ATTACHMENT_STATE.DONE}>
 *   <AttachmentMedia>
 *     <FileIcon />
 *   </AttachmentMedia>
 *   <AttachmentContent>
 *     <AttachmentTitle>仕様書.pdf</AttachmentTitle>
 *     <AttachmentDescription>1.2 MB</AttachmentDescription>
 *   </AttachmentContent>
 * </Attachment>
 * ```
 *
 * @param props - native `div` 属性と、以下の表示用 props。
 * @param props.size - 添付の大きさ。{@link ATTACHMENT_SIZE} のいずれか。
 * @param props.orientation - 内容の並べ方。{@link ATTACHMENT_ORIENTATION} のいずれか。
 * @param props.state - 今どの段階にあるか。{@link ATTACHMENT_STATE} のいずれか。
 *
 * @see Storybook `Display/Attachment`
 */
export function Attachment({
  className,
  state = ATTACHMENT_STATE.DONE,
  size = ATTACHMENT_SIZE.DEFAULT,
  orientation = ATTACHMENT_ORIENTATION.HORIZONTAL,
  ...props
}: AttachmentProps) {
  return (
    <div
      className={cn(attachmentVariants({ size, orientation }), className)}
      data-orientation={orientation}
      data-size={size}
      data-slot="attachment"
      data-state={state}
      {...props}
    />
  );
}

const attachmentMediaVariants = cva(
  "relative flex aspect-square w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted text-foreground group-data-[orientation=vertical]/attachment:w-full group-data-[size=sm]/attachment:w-8 group-data-[size=xs]/attachment:w-7 group-data-[size=xs]/attachment:rounded-md group-data-[state=error]/attachment:bg-destructive/10 group-data-[state=error]/attachment:text-destructive group-data-[orientation=vertical]/attachment:*:data-[slot=spinner]:size-6! [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 group-data-[orientation=vertical]/attachment:[&_svg:not([class*='size-'])]:size-6 group-data-[size=xs]/attachment:[&_svg:not([class*='size-'])]:size-3.5",
  {
    variants: {
      variant: {
        [ATTACHMENT_MEDIA_VARIANT.ICON]: "",
        [ATTACHMENT_MEDIA_VARIANT.IMAGE]:
          "opacity-60 group-data-[state=done]/attachment:opacity-100 group-data-[state=idle]/attachment:opacity-100 *:[img]:aspect-square *:[img]:w-full *:[img]:object-cover",
      },
    },
    defaultVariants: {
      variant: ATTACHMENT_MEDIA_VARIANT.ICON,
    },
  },
);

/** {@link AttachmentMedia} の props。 */
export type AttachmentMediaProps = ComponentProps<"div"> & {
  /** 置く媒体の種類。 */
  variant?: AttachmentMediaVariant;
};

/**
 * 添付の種類を示すアイコンまたは画像を置く枠。
 *
 * @remarks
 * `icon` はアイコンを、`image` は縮小表示を置く。いずれも装飾であり、何のファイルかは
 * `AttachmentTitle` のテキストが伝える。画像を置く場合も同じ理由で `alt` は空にできる。
 *
 * @param props - native `div` 属性と、以下の表示用 props。
 * @param props.variant - 置く媒体の種類。{@link ATTACHMENT_MEDIA_VARIANT} のいずれか。
 *
 * @see Storybook `Display/Attachment`
 */
export function AttachmentMedia({
  className,
  variant = ATTACHMENT_MEDIA_VARIANT.ICON,
  ...props
}: AttachmentMediaProps) {
  return (
    <div
      className={cn(attachmentMediaVariants({ variant }), className)}
      data-slot="attachment-media"
      data-variant={variant}
      {...props}
    />
  );
}

/**
 * 名前と補足を縦に並べる領域。
 *
 * @param props - native `div` 属性。
 *
 * @see Storybook `Display/Attachment`
 */
export function AttachmentContent({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "max-w-full min-w-0 flex-1 leading-tight group-data-[orientation=vertical]/attachment:px-1",
        className,
      )}
      data-slot="attachment-content"
      {...props}
    />
  );
}

/**
 * 添付の名前。
 *
 * @remarks
 * 枠に収まらない場合は末尾を省略する。省略された名前だけでは判別できないため、全体を示す
 * 必要がある場合は呼び出し元が `title` 属性などを添える。
 *
 * @param props - native `span` 属性。
 *
 * @see Storybook `Display/Attachment`
 */
export function AttachmentTitle({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      className={cn("block max-w-full min-w-0 truncate font-emphasis", className)}
      data-slot="attachment-title"
      {...props}
    />
  );
}

/**
 * 大きさ・進行状況・失敗理由などの補足。
 *
 * @remarks
 * 進行中や失敗であることはここのテキストで示す（{@link Attachment} の `state` は見た目にしか出ない）。
 *
 * @param props - native `span` 属性。
 *
 * @see Storybook `Display/Attachment`
 */
export function AttachmentDescription({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "mt-0.5 block min-w-0 truncate text-xs text-muted-foreground group-data-[state=error]/attachment:text-destructive",
        "max-w-full",
        className,
      )}
      data-slot="attachment-description"
      {...props}
    />
  );
}

/**
 * 削除や再試行などの操作を並べる領域。
 *
 * @remarks
 * `vertical` では枠の右上へ重ねて置く。
 *
 * @param props - native `div` 属性。
 *
 * @see Storybook `Display/Attachment`
 */
export function AttachmentActions({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "relative z-20 flex shrink-0 items-center group-data-[orientation=vertical]/attachment:absolute group-data-[orientation=vertical]/attachment:top-3 group-data-[orientation=vertical]/attachment:right-3 group-data-[orientation=vertical]/attachment:gap-1",
        className,
      )}
      data-slot="attachment-actions"
      {...props}
    />
  );
}

/**
 * 添付 1 件に対する操作。
 *
 * @remarks
 * アイコンだけを置く場合が多いため、**アクセシブルな名前は呼び出し元が必ず与える**。名前だけで
 * どの添付に対する操作かが判るよう、添付の名前も名前に含める。
 *
 * @param props - {@link Button} の props。
 *
 * @see Storybook `Display/Attachment`
 */
export function AttachmentAction({
  className,
  size = BUTTON_SIZE.SMALL,
  variant = BUTTON_VARIANT.GHOST,
  ...props
}: ComponentProps<typeof Button>) {
  return (
    <Button
      className={cn(className)}
      data-slot="attachment-action"
      size={size}
      variant={variant}
      {...props}
    />
  );
}

/** {@link AttachmentTrigger} の props。 */
export type AttachmentTriggerProps = ComponentProps<"button"> & {
  /** 子要素へ trigger の当たり判定と props を合成するか。 */
  asChild?: boolean;
};

/**
 * 枠全体を押せるようにする、面いっぱいの当たり判定。
 *
 * @remarks
 * 枠の上へ重なるため、この要素自身の focus 表示は抑え、代わりに `Attachment` が
 * `focus-within` の outline を出す。`AttachmentActions` はさらに上に重なるので、個別の操作は
 * それぞれ押せる。
 *
 * **アクセシブルな名前は呼び出し元が必ず与える**。面だけでは何をする操作か判らない。
 *
 * @param props - native `button` 属性と、以下の表示用 props。
 * @param props.asChild - 子要素へ trigger の当たり判定と props を合成するか。
 *
 * @see Storybook `Display/Attachment`
 */
export function AttachmentTrigger({
  className,
  asChild = false,
  type,
  ...props
}: AttachmentTriggerProps) {
  const Component = asChild ? Slot.Root : "button";

  return (
    <Component
      className={cn("absolute inset-0 z-10 outline-none", className)}
      data-slot="attachment-trigger"
      type={asChild ? undefined : (type ?? "button")}
      {...props}
    />
  );
}

/** {@link AttachmentGroup} の props。 */
export type AttachmentGroupProps = ComponentProps<"section"> & {
  /** 領域の名前。 */
  label?: string;
};

/**
 * 複数の添付を横に並べる領域。
 *
 * @remarks
 * 収まらない場合は横スクロールし、添付の先頭で止まる。件数・並び順・上限は持たない。
 *
 * スクロールは `ScrollArea` が引き受けるため、keyboard だけでも横へ送れる。添付そのものが
 * focus を持つ構成では `tabIndex={-1}` を渡し、領域自体の tab stop を外す。
 *
 * focus できる領域には名前が要り、名前は role を伴わないと公開されないため `role="group"` を
 * 当てる。landmark にはしない。添付のまとまりは画面の骨格ではない。
 *
 * @param props - native `section` 属性と `label`。
 *
 * @see Storybook `Display/Attachment`
 */
export function AttachmentGroup({
  className,
  label = "添付の一覧",
  ...props
}: AttachmentGroupProps) {
  return (
    <ScrollArea
      aria-label={label}
      className={cn(
        "flex min-w-0 scroll-fade-x snap-x snap-mandatory scroll-px-1 scrollbar-none gap-3 py-1 *:data-[slot=attachment]:flex-none *:data-[slot=attachment]:snap-start",
        className,
      )}
      data-slot="attachment-group"
      orientation="horizontal"
      role="group"
      {...props}
    />
  );
}
