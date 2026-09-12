import { cva } from "class-variance-authority";
import { Slot } from "radix-ui";
import type { ComponentProps } from "react";

import { cn } from "@/components/cn";

import {
  BUBBLE_ALIGN,
  BUBBLE_REACTIONS_SIDE,
  BUBBLE_VARIANT,
  type BubbleAlign,
  type BubbleReactionsSide,
  type BubbleVariant,
} from "./bubble.definition";

/**
 * 続けて表示する吹き出しをひとまとまりとして縦に並べる領域。
 *
 * @remarks
 * 間隔だけを持つ。1 件のメッセージの中で本文を複数の吹き出しに分ける場合に使う。送信者・時刻・
 * avatar を伴うメッセージ単位のまとまりは `MessageGroup` が担う。
 *
 * @see Storybook `Display/Bubble`
 */
function BubbleGroup({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("flex min-w-0 flex-col gap-2", className)}
      data-slot="bubble-group"
      {...props}
    />
  );
}

const bubbleVariants = cva(
  "group/bubble relative flex w-fit max-w-[80%] min-w-0 flex-col gap-1 group-data-[align=end]/message:self-end data-[align=end]:self-end data-[variant=ghost]:max-w-full",
  {
    variants: {
      variant: {
        [BUBBLE_VARIANT.DEFAULT]:
          "*:data-[slot=bubble-content]:bg-primary *:data-[slot=bubble-content]:text-primary-foreground [&>[data-slot=bubble-content]:is(button,a):hover]:bg-primary/80",
        [BUBBLE_VARIANT.SECONDARY]:
          "*:data-[slot=bubble-content]:bg-accent *:data-[slot=bubble-content]:text-accent-foreground [&>[data-slot=bubble-content]:is(button,a):hover]:bg-[color-mix(in_oklch,var(--semantic-color-accent),var(--semantic-color-foreground)_5%)]",
        [BUBBLE_VARIANT.MUTED]:
          "*:data-[slot=bubble-content]:bg-muted [&>[data-slot=bubble-content]:is(button,a):hover]:bg-[color-mix(in_oklch,var(--semantic-color-muted),var(--semantic-color-foreground)_5%)]",
        [BUBBLE_VARIANT.TINTED]:
          "*:data-[slot=bubble-content]:bg-[oklch(from_var(--semantic-color-primary)_0.93_calc(c*0.4)_h)] *:data-[slot=bubble-content]:text-foreground dark:*:data-[slot=bubble-content]:bg-[oklch(from_var(--semantic-color-primary)_0.3_calc(c*0.4)_h)] [&>[data-slot=bubble-content]:is(button,a):hover]:bg-[oklch(from_var(--semantic-color-primary)_0.88_calc(c*0.5)_h)] dark:[&>[data-slot=bubble-content]:is(button,a):hover]:bg-[oklch(from_var(--semantic-color-primary)_0.35_calc(c*0.5)_h)]",
        [BUBBLE_VARIANT.OUTLINE]:
          "*:data-[slot=bubble-content]:border-border *:data-[slot=bubble-content]:bg-background [&>[data-slot=bubble-content]:is(button,a):hover]:bg-muted [&>[data-slot=bubble-content]:is(button,a):hover]:text-foreground dark:[&>[data-slot=bubble-content]:is(button,a):hover]:bg-input/30",
        [BUBBLE_VARIANT.GHOST]:
          "border-none *:data-[slot=bubble-content]:rounded-none *:data-[slot=bubble-content]:bg-transparent *:data-[slot=bubble-content]:p-0 [&>[data-slot=bubble-content]:is(button,a):hover]:bg-muted [&>[data-slot=bubble-content]:is(button,a):hover]:text-foreground dark:[&>[data-slot=bubble-content]:is(button,a):hover]:bg-muted/50",
        [BUBBLE_VARIANT.DESTRUCTIVE]:
          "*:data-[slot=bubble-content]:bg-destructive/10 *:data-[slot=bubble-content]:text-destructive dark:*:data-[slot=bubble-content]:bg-destructive/20 [&>[data-slot=bubble-content]:is(button,a):hover]:bg-destructive/20 dark:[&>[data-slot=bubble-content]:is(button,a):hover]:bg-destructive/30",
      },
    },
    defaultVariants: {
      variant: BUBBLE_VARIANT.DEFAULT,
    },
  },
);

/**
 * 発話や通知の 1 かたまりを囲む吹き出しの外枠。
 *
 * @remarks
 * 面の色・角丸・余白は子の `BubbleContent` に対して指定するため、この要素自体は枠を描かない。
 * 表示専用の Server Component であり、hydration を必要としない。
 *
 * 幅は内容に合わせて縮み、既定では領域の 80% を上限とする。`Message` の中に置いた場合は、
 * 親の `align` に追従して左右へ寄る。`Message` の外で単独に使う場合だけ、この component の
 * `align` で寄せる向きを指定する。
 *
 * `variant` は面の見た目だけを変え、意味論を持たない。`destructive` を選んでも支援技術へは
 * 何も伝わらないため、失敗や取り消しといった意味は本文の文言で示す。
 *
 * @example
 * ```tsx
 * <Bubble variant={BUBBLE_VARIANT.MUTED}>
 *   <BubbleContent>受け取りました。</BubbleContent>
 * </Bubble>
 * ```
 *
 * @param props - native `div` 属性と、以下の表示用 props。
 * @param props.variant - 面の見せ方。{@link BUBBLE_VARIANT} のいずれか。
 * @param props.align - 吹き出しを寄せる向き。{@link BUBBLE_ALIGN} のいずれか。
 *
 * @see Storybook `Display/Bubble`
 */
function Bubble({
  variant = BUBBLE_VARIANT.DEFAULT,
  align = BUBBLE_ALIGN.START,
  className,
  ...props
}: ComponentProps<"div"> & {
  variant?: BubbleVariant;
  align?: BubbleAlign;
}) {
  return (
    <div
      className={cn(bubbleVariants({ variant }), className)}
      data-align={align}
      data-slot="bubble"
      data-variant={variant}
      {...props}
    />
  );
}

/**
 * 吹き出しが伝える本文。
 *
 * @remarks
 * 面の色と角丸はこの要素へ適用される。`Bubble` の中に複数置くと、同じ面の吹き出しが縦に並ぶ。
 *
 * `asChild` で `button` や link へ合成すると、押せる吹き出しになる。その場合、操作の意味は
 * 子要素のテキストが伝え、遷移先や実行内容は呼び出し元が持つ。
 *
 * @param props - native `div` 属性と、以下の表示用 props。
 * @param props.asChild - 子要素へ本文の見た目と props を合成するか。
 *
 * @see Storybook `Display/Bubble`
 */
function BubbleContent({
  asChild = false,
  className,
  ...props
}: ComponentProps<"div"> & {
  asChild?: boolean;
}) {
  const Component = asChild ? Slot.Root : "div";

  return (
    <Component
      className={cn(
        "w-fit max-w-full min-w-0 overflow-hidden rounded-xl border border-transparent px-3 py-2 text-sm leading-relaxed wrap-break-word group-data-[align=end]/bubble:self-end [button]:text-left [button,a]:transition-colors [button,a]:focus-visible:outline-2 [button,a]:focus-visible:outline-offset-2 [button,a]:focus-visible:outline-active focus-visible:shadow-glow-primary",
        className,
      )}
      data-slot="bubble-content"
      {...props}
    />
  );
}

const bubbleReactionsVariants = cva(
  "absolute z-10 flex w-fit shrink-0 items-center justify-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-sm ring-3 ring-card has-[button]:p-0",
  {
    variants: {
      side: {
        [BUBBLE_REACTIONS_SIDE.TOP]: "top-0 -translate-y-3/4",
        [BUBBLE_REACTIONS_SIDE.BOTTOM]: "bottom-0 translate-y-3/4",
      },
      align: {
        [BUBBLE_ALIGN.START]: "left-3",
        [BUBBLE_ALIGN.END]: "right-3",
      },
    },
    defaultVariants: {
      side: BUBBLE_REACTIONS_SIDE.BOTTOM,
      align: BUBBLE_ALIGN.END,
    },
  },
);

/**
 * 吹き出しの縁へ重ねて表示する反応の並び。
 *
 * @remarks
 * `Bubble` の直接の子として置く。吹き出しの上下いずれかの縁へ絶対配置で重なるため、この要素の
 * 高さぶんだけ周囲に余白が要る場合は呼び出し元が確保する。
 *
 * 反応の集計、押下による増減、誰が反応したかの一覧は持たない。絵文字だけで意味を伝えないよう、
 * 件数や反応の名前をテキストとして併記するか、操作にアクセシブルな名前を与える。
 *
 * @param props - native `div` 属性と、以下の表示用 props。
 * @param props.side - 重ねる縁。{@link BUBBLE_REACTIONS_SIDE} のいずれか。
 * @param props.align - 縁のどちら側へ寄せるか。{@link BUBBLE_ALIGN} のいずれか。
 *
 * @see Storybook `Display/Bubble`
 */
function BubbleReactions({
  side = BUBBLE_REACTIONS_SIDE.BOTTOM,
  align = BUBBLE_ALIGN.END,
  className,
  ...props
}: ComponentProps<"div"> & {
  align?: BubbleAlign;
  side?: BubbleReactionsSide;
}) {
  return (
    <div
      className={cn(bubbleReactionsVariants({ side, align }), className)}
      data-align={align}
      data-side={side}
      data-slot="bubble-reactions"
      {...props}
    />
  );
}

export { Bubble, BubbleContent, BubbleGroup, BubbleReactions };
