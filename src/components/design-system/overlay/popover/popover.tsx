"use client";

import { Popover as PopoverPrimitive } from "radix-ui";
import type { ComponentProps } from "react";

import { cn } from "@/components/cn";

/**
 * trigger の近傍に補足内容や補助操作を開く、client island の popover root。
 *
 * @remarks
 * 位置計算・外側クリック・Escape・focus 管理を browser 側で行うため hydration が必要で、
 * Server Component からは直接 render できない。内容自体に client runtime が要らない場合は、
 * Server Component で組み立てた要素を `children` として渡す。
 *
 * 補足情報が操作や判断に不可欠な場合は popover だけに置かない。開かなければ到達できない
 * ため、常時表示または明示的な導線を feature 側にも用意する。
 *
 * @param props - Radix `Popover.Root` の props。`open` / `defaultOpen` / `onOpenChange` で
 *   開閉を制御でき、省略時は trigger の操作だけで開閉する。
 *
 * @see Storybook `Overlay/Popover`
 */
function Popover({ ...props }: ComponentProps<typeof PopoverPrimitive.Root>) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />;
}

/**
 * Popover を開閉する trigger。
 *
 * @remarks
 * 既定では `button` を render する。`Button` や link を trigger にする場合は `asChild` を
 * 指定して単一の子要素へ合成する。開閉状態は `aria-expanded` として自動的に反映され、開いている
 * 間だけ `aria-haspopup="dialog"` と `aria-controls` で内容と関連付けられる。
 *
 * この組み合わせは axe の `aria-valid-attr-value` を「要手動確認」に倒す。axe は
 * `aria-haspopup` があると参照先 ID の実在を確認せず一律で要確認にするため、Storybook の a11y
 * panel には incomplete として並ぶ。violation ではなく、実際に ID が内容を指すことは test で
 * 確認済みなので、この項目を理由に属性を外さない。
 *
 * @param props - Radix `Popover.Trigger` の props。
 *
 * @see Storybook `Overlay/Popover`
 */
function PopoverTrigger({ ...props }: ComponentProps<typeof PopoverPrimitive.Trigger>) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />;
}

/**
 * Portal へ表示する popover の内容。
 *
 * @remarks
 * `role="dialog"` を持つため、`aria-label` または `PopoverTitle` の `id` を指す
 * `aria-labelledby` でアクセシブルな名前を必ず与える。名前のない dialog は支援技術から
 * 用途が判別できず、a11y 自動検査にも違反する。`PopoverDescription` を添える場合は、その
 * `id` を `aria-describedby` から参照して名前と説明を関連付ける。
 *
 * 背景は `bg-background`、境界は `border-border` を使う。ページ内容の上へ重ねるため、
 * 面が透明だと背後の文字と重なって可読性と contrast が失われる。
 *
 * 表示位置は `side` / `align` / `sideOffset` で調整する。viewport に収まらない場合は Radix が
 * 自動で反転・調整するため、feature 側で座標を計算しない。
 *
 * @param props - Radix `Popover.Content` の props。`className` は既定の見た目へ追加・上書き
 *   できる。
 *
 * @see Storybook `Overlay/Popover`
 */
function PopoverContent({
  className,
  align = "center",
  sideOffset = 4,
  ...props
}: ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        align={align}
        className={cn(
          "z-50 w-72 origin-(--radix-popover-content-transform-origin) rounded-md border border-border bg-background p-4 text-foreground shadow-md data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
          className,
        )}
        data-slot="popover-content"
        sideOffset={sideOffset}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}

/**
 * trigger とは別の要素を popover の位置基準にする anchor。
 *
 * @remarks
 * trigger 自体を基準にする通常の用途では指定しない。入力欄の右端の icon button で開き、
 * 入力欄全体に幅を合わせる場合のように、開く操作と位置基準が異なるときだけ使う。
 *
 * @param props - Radix `Popover.Anchor` の props。
 *
 * @see Storybook `Overlay/Popover`
 */
function PopoverAnchor({ ...props }: ComponentProps<typeof PopoverPrimitive.Anchor>) {
  return <PopoverPrimitive.Anchor data-slot="popover-anchor" {...props} />;
}

/**
 * popover の見出しと説明をまとめる領域。
 *
 *
 * @see Storybook `Overlay/Popover`
 */
function PopoverHeader({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("flex flex-col gap-1 text-sm", className)}
      data-slot="popover-header"
      {...props}
    />
  );
}

/**
 * popover の主題を示す見出し。
 *
 * @remarks
 * この部品は見た目だけを持つ `div` である。`PopoverContent` の名前として使う場合は `id` を
 * 与え、`PopoverContent` の `aria-labelledby` から参照する。文書構造上の見出しが必要な場合は
 * 呼び出し元で heading 要素を子として渡す。
 *
 *
 * @see Storybook `Overlay/Popover`
 */
function PopoverTitle({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("font-emphasis", className)} data-slot="popover-title" {...props} />;
}

/**
 * 見出しを補足する説明文。
 *
 * @remarks
 * `PopoverContent` の説明として使う場合は `id` を与え、`PopoverContent` の
 * `aria-describedby` から参照する。
 *
 *
 * @see Storybook `Overlay/Popover`
 */
function PopoverDescription({ className, ...props }: ComponentProps<"p">) {
  return (
    <p
      className={cn("text-muted-foreground", className)}
      data-slot="popover-description"
      {...props}
    />
  );
}

export {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
};
