"use client";

import { RadioGroup as RadioGroupPrimitive } from "radix-ui";
import type * as React from "react";

import { cn } from "@/components/cn";
import { CircleIcon } from "@/components/icon";

/** {@link RadioGroupClient} の props。 */
export type RadioGroupClientProps = React.ComponentProps<typeof RadioGroupPrimitive.Root>;

/**
 * 排他的な選択肢を一組として扱う client island。
 *
 * @remarks
 * 選択状態を browser 側で保持するため hydration が必要で、Server Component からは直接 render
 * できない。静的で少数の候補を native form として送るだけなら `RadioGroupNative` を使い、
 * この部品は native radio では満たせない操作要件がある場合に限る。
 *
 * 集合そのものは名前を持たないため、`aria-label` か `aria-labelledby` で**何の選択かを必ず
 * 示す**。矢印キーでの移動と roving tabindex は配下の項目に対して自動で効く。
 *
 * `value` を渡すと制御 component、`defaultValue` を渡すと非制御 component として動く。
 *
 * @example
 * ```tsx
 * <RadioGroupClient aria-label="配送方法" defaultValue="standard" name="shipping">
 *   <div className="flex items-center gap-2">
 *     <RadioGroupClientItem id="standard" value="standard" />
 *     <Label htmlFor="standard">通常配送</Label>
 *   </div>
 *   <div className="flex items-center gap-2">
 *     <RadioGroupClientItem id="express" value="express" />
 *     <Label htmlFor="express">お急ぎ便</Label>
 *   </div>
 * </RadioGroupClient>
 * ```
 *
 * @param props - Radix `RadioGroup.Root` の props。
 * @see Storybook `Form/RadioGroupClient`
 */
function RadioGroupClient({ className, ...props }: RadioGroupClientProps) {
  return (
    <RadioGroupPrimitive.Root
      data-slot="radio-group"
      className={cn("grid gap-3", className)}
      {...props}
    />
  );
}

/**
 * 集合の中の 1 つの選択肢。
 *
 * @remarks
 * `value` は必須で、集合の中で一意にする。この部品は印だけを描画し文言を持たないため、
 * `id` を与えて `Label` と結び付けるか `aria-label` を渡す。名前が無いと何を選ぶ項目か伝わらない。
 *
 * 選べない項目は `disabled` を渡し、集合から取り除かずに残す。入力内容が不正であることを示す
 * 場合は `aria-invalid` を渡す。
 *
 * @param props - Radix `RadioGroup.Item` の props。
 * @see Storybook `Form/RadioGroupClient`
 */
function RadioGroupClientItem({
  className,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Item>) {
  return (
    <RadioGroupPrimitive.Item
      data-slot="radio-group-item"
      className={cn(
        "aspect-square size-4 shrink-0 rounded-full border border-input text-primary shadow-xs transition-[color,box-shadow] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active focus-visible:shadow-glow-primary disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:bg-input/30 dark:aria-invalid:ring-destructive/40",
        className,
      )}
      {...props}
    >
      <RadioGroupPrimitive.Indicator
        data-slot="radio-group-indicator"
        className="relative flex items-center justify-center"
      >
        <CircleIcon className="absolute top-1/2 left-1/2 size-2 -translate-x-1/2 -translate-y-1/2 fill-primary" />
      </RadioGroupPrimitive.Indicator>
    </RadioGroupPrimitive.Item>
  );
}

export { RadioGroupClient, RadioGroupClientItem };
