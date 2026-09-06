"use client";

import { Select as SelectPrimitive } from "radix-ui";
import type * as React from "react";

import { cn } from "@/components/cn";
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from "@/components/icon";

/** {@link SelectClient} の props。 */
export type SelectClientProps = React.ComponentProps<typeof SelectPrimitive.Root>;

/**
 * custom popup と keyboard / focus 操作を提供する、client island 専用の選択 UI。
 *
 * @remarks
 * 初期表示の既定には使わない。静的で少数の候補は Server Component で使える `SelectNative` を
 * 優先し、native control では満たせない選択操作が必要な箇所だけに限定する。`SelectContent` は
 * Portal で表示されるため、browser JavaScript と hydration を必要とする。
 *
 * この部品は Client Component だが、Next.js は初期 HTML を SSR した上で hydration する。
 * `"use client"` 境界を route 全体へ広げず、必要な form control の島として配置する。
 *
 * 選択された値を native form として送る場合は `name` を渡す。開閉と選択の状態は `value` /
 * `defaultValue` で制御 / 非制御を選ぶ。
 *
 * @example
 * ```tsx
 * <SelectClient defaultValue="standard" name="plan">
 *   <SelectTrigger>
 *     <SelectValue placeholder="プランを選択" />
 *   </SelectTrigger>
 *   <SelectContent>
 *     <SelectGroup>
 *       <SelectLabel>個人向け</SelectLabel>
 *       <SelectItem value="free">無料</SelectItem>
 *       <SelectItem value="standard">標準</SelectItem>
 *     </SelectGroup>
 *     <SelectSeparator />
 *     <SelectItem value="enterprise">法人</SelectItem>
 *   </SelectContent>
 * </SelectClient>
 * ```
 *
 * @param props - 選択状態と `name` を含む Root の props。
 * @see Storybook `Form/SelectClient`
 */
function SelectClient({ ...props }: SelectClientProps) {
  return <SelectPrimitive.Root data-slot="select" {...props} />;
}

/**
 * 候補をひとまとまりとして束ねる区分。
 *
 * @remarks
 * 区分の名前は `SelectLabel` を子に置いて示す。`SelectLabel` だけでは支援技術へ区分として
 * 伝わらないため、両者は対で使う。
 *
 * @param props - Radix `Select.Group` の props。
 * @see Storybook `Form/SelectClient`
 */
function SelectGroup({ ...props }: React.ComponentProps<typeof SelectPrimitive.Group>) {
  return <SelectPrimitive.Group data-slot="select-group" {...props} />;
}

/**
 * 選択中の値を trigger の中へ表示する領域。
 *
 * @remarks
 * 何も選ばれていない間は `placeholder` を表示する。`placeholder` は候補ではないため、
 * 未選択を許さない項目でも「選択してください」の意味以上を持たせない。
 *
 * @param props - Radix `Select.Value` の props。
 * @see Storybook `Form/SelectClient`
 */
function SelectValue({ ...props }: React.ComponentProps<typeof SelectPrimitive.Value>) {
  return <SelectPrimitive.Value data-slot="select-value" {...props} />;
}

/**
 * 候補一覧を開く操作部。選択中の値を表示する。
 *
 * @remarks
 * 視覚的なラベルを持たないため、`Label` と結び付けるか `aria-label` でアクセシブルな名前を
 * 与える。入力内容が不正であることを示す場合は `aria-invalid` を渡す。
 *
 * @param props - Radix `Select.Trigger` の props と `size`。
 * @param props.size - trigger の高さ。`default` は 36px、`sm` は 32px。
 * @see Storybook `Form/SelectClient`
 */
function SelectTrigger({
  className,
  size = "default",
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Trigger> & {
  size?: "sm" | "default";
}) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      className={cn(
        "flex w-fit items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 py-2 text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active focus-visible:shadow-glow-primary disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 data-[placeholder]:text-muted-foreground data-[size=default]:h-9 data-[size=sm]:h-8 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2 dark:bg-input/30 dark:hover:bg-input/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground",
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDownIcon className="size-4 opacity-50" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

/**
 * 候補一覧を載せる面。
 *
 * @remarks
 * Portal で `body` 直下へ描画されるため、呼び出し元の `overflow` や `z-index` に切り取られない。
 * その代わり DOM 上は trigger の兄弟ではなくなるので、test で取得するときは `container` ではなく
 * `baseElement` を見る。
 *
 * 一覧が表示領域に収まらない場合は、上下端に送りの操作部が現れる。
 *
 * @param props - Radix `Select.Content` の props。
 * @param props.position - 配置方式。`popper` は trigger の近傍へ、`item-aligned` は選択中の項目が
 *   trigger に重なる位置へ寄せる。
 * @param props.align - trigger に対する寄せ方向。
 * @see Storybook `Form/SelectClient`
 */
function SelectContent({
  className,
  children,
  position = "popper",
  align = "center",
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        data-slot="select-content"
        className={cn(
          "relative z-50 max-h-(--radix-select-content-available-height) min-w-[8rem] origin-(--radix-select-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-md border border-border bg-popover text-popover-foreground shadow-md data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
          position === "popper" &&
            "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
          className,
        )}
        position={position}
        align={align}
        {...props}
      >
        <SelectScrollUpButton />
        <SelectPrimitive.Viewport
          className={cn(
            "p-1",
            position === "popper" &&
              "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)] scroll-my-1",
          )}
        >
          {children}
        </SelectPrimitive.Viewport>
        <SelectScrollDownButton />
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

/**
 * 区分の名前。
 *
 * @remarks
 * `SelectGroup` の子として置く。単独で置いても区分として扱われず、候補一覧の中の飾りになる。
 *
 * @param props - Radix `Select.Label` の props。
 * @see Storybook `Form/SelectClient`
 */
function SelectLabel({ className, ...props }: React.ComponentProps<typeof SelectPrimitive.Label>) {
  return (
    <SelectPrimitive.Label
      data-slot="select-label"
      className={cn("px-2 py-1.5 text-xs text-muted-foreground", className)}
      {...props}
    />
  );
}

/**
 * 選べる候補の 1 件。
 *
 * @remarks
 * `value` は必須で、一覧の中で一意にする。選択中は右端に確認の印が付く。選べない候補は
 * `disabled` を渡し、一覧から取り除かずに残す。
 *
 * 表示する文言が候補のアクセシブルな名前になる。
 *
 * @param props - Radix `Select.Item` の props。
 * @see Storybook `Form/SelectClient`
 */
function SelectItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2",
        className,
      )}
      {...props}
    >
      <span
        data-slot="select-item-indicator"
        className="absolute right-2 flex size-3.5 items-center justify-center"
      >
        <SelectPrimitive.ItemIndicator>
          <CheckIcon className="size-4" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}

/**
 * 候補の区切り線。
 *
 * @remarks
 * 見た目だけの区切りであり、区分としての意味は持たない。名前を伴う区分が要る場合は
 * `SelectGroup` と `SelectLabel` を使う。
 *
 * @param props - Radix `Select.Separator` の props。
 * @see Storybook `Form/SelectClient`
 */
function SelectSeparator({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Separator>) {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cn("pointer-events-none -mx-1 my-1 h-px bg-border", className)}
      {...props}
    />
  );
}

/**
 * 一覧が収まらないときに上端へ現れる送りの操作部。
 *
 * @remarks
 * `SelectContent` が自動で配置するため、呼び出し元が置く必要はない。
 *
 * @param props - Radix `Select.ScrollUpButton` の props。
 * @see Storybook `Form/SelectClient`
 */
function SelectScrollUpButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollUpButton>) {
  return (
    <SelectPrimitive.ScrollUpButton
      data-slot="select-scroll-up-button"
      className={cn("flex cursor-default items-center justify-center py-1", className)}
      {...props}
    >
      <ChevronUpIcon className="size-4" />
    </SelectPrimitive.ScrollUpButton>
  );
}

/**
 * 一覧が収まらないときに下端へ現れる送りの操作部。
 *
 * @remarks
 * `SelectContent` が自動で配置するため、呼び出し元が置く必要はない。
 *
 * @param props - Radix `Select.ScrollDownButton` の props。
 * @see Storybook `Form/SelectClient`
 */
function SelectScrollDownButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollDownButton>) {
  return (
    <SelectPrimitive.ScrollDownButton
      data-slot="select-scroll-down-button"
      className={cn("flex cursor-default items-center justify-center py-1", className)}
      {...props}
    >
      <ChevronDownIcon className="size-4" />
    </SelectPrimitive.ScrollDownButton>
  );
}

export {
  SelectClient,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
};
