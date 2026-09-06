"use client";

import { Checkbox as CheckboxPrimitive } from "radix-ui";
import type * as React from "react";

import { cn } from "@/components/cn";
import { CheckIcon, MinusIcon } from "@/components/icon";

/** {@link CheckboxClient} の props。 */
export type CheckboxClientProps = React.ComponentProps<typeof CheckboxPrimitive.Root>;

/**
 * checked / unchecked / indeterminate を扱う、Radix ベースの client island 用 checkbox。
 *
 * @remarks
 * 初期状態は SSR されるが、状態変更には hydration 後の browser JavaScript が必要になる。
 * 項目名は `aria-label`、または `Label` と `id` を関連付けて必ず与える。業務上の選択状態や
 * 送信結果は feature 側が管理する。
 *
 * indeterminate は checked と別の印（横線）で示す。同じ印だと背景の塗りだけが違う状態になり、
 * 「一部選択」と「選択済み」が一目で区別できない。
 */
function CheckboxClient({ className, ...props }: CheckboxClientProps) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer size-4 shrink-0 rounded-md border border-input shadow-xs transition-shadow focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active focus-visible:shadow-glow-primary disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground dark:bg-input/30 dark:aria-invalid:ring-destructive/40 dark:data-[state=checked]:bg-primary",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="group/checkbox-indicator grid place-content-center text-current transition-none"
      >
        <CheckIcon className="size-3.5 group-data-[state=indeterminate]/checkbox-indicator:hidden" />
        <MinusIcon className="hidden size-3.5 group-data-[state=indeterminate]/checkbox-indicator:block" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { CheckboxClient };
