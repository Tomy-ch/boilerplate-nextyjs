import type { ComponentProps } from "react";

import { cn } from "@/components/cn";

/**
 * キーボードの入力を表す、SSR first の表示 primitive。
 *
 * @remarks
 * `kbd` 要素として「利用者が押すキー」であることを意味論として伝える。表示だけを担い、
 * shortcut の登録も keydown の待ち受けもしない。実際のキー操作は呼び出し元が用意する。
 *
 * キーから操作を推測させない。何が起きるかは隣接する文言が伝え、`Kbd` はその手段を示す。
 * 対応する操作がキーボードから実行できない場合は表示しない。
 *
 * 修飾キーとの組み合わせは、単一の `Kbd` に文字列を詰めず、`KbdGroup` で個々のキーを並べる。
 *
 * @example
 * ```tsx
 * <KbdGroup>
 *   <Kbd>⌘</Kbd>
 *   <Kbd>K</Kbd>
 * </KbdGroup>
 * ```
 *
 * @see Storybook `Display/Kbd`
 */
function Kbd({ className, ...props }: ComponentProps<"kbd">) {
  return (
    <kbd
      className={cn(
        "pointer-events-none inline-flex h-5 w-fit min-w-5 items-center justify-center gap-1 rounded-sm bg-muted px-1 font-sans text-xs font-emphasis text-muted-foreground select-none",
        "[&_svg:not([class*='size-'])]:size-3",
        "[[data-slot=tooltip-content]_&]:bg-background/20 [[data-slot=tooltip-content]_&]:text-background dark:[[data-slot=tooltip-content]_&]:bg-background/10",
        className,
      )}
      data-slot="kbd"
      {...props}
    />
  );
}

/**
 * 複数のキーをひとまとまりの操作として並べる。
 *
 * @remarks
 * `kbd` を入れ子にするのは HTML 仕様が示す組み合わせの表し方で、外側が「一つの入力」、内側の
 * 各 `Kbd` が「個々のキー」を表す。区切り記号を挟む場合は子として置く。
 *
 * @see Storybook `Display/Kbd`
 */
function KbdGroup({ className, ...props }: ComponentProps<"kbd">) {
  return (
    <kbd
      className={cn("inline-flex items-center gap-1", className)}
      data-slot="kbd-group"
      {...props}
    />
  );
}

export { Kbd, KbdGroup };
