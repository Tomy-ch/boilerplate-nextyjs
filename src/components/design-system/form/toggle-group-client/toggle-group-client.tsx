"use client";

import type { VariantProps } from "class-variance-authority";
import { ToggleGroup as ToggleGroupPrimitive } from "radix-ui";
import { type ComponentProps, type CSSProperties, createContext, useContext } from "react";

import { cn } from "@/components/cn";

import { toggleVariants } from "../../action/toggle/toggle";

const ToggleGroupContext = createContext<
  VariantProps<typeof toggleVariants> & {
    spacing?: number;
  }
>({
  size: "default",
  variant: "default",
  spacing: 0,
});

/** {@link ToggleGroupClient} の props。 */
export type ToggleGroupClientProps = ComponentProps<typeof ToggleGroupPrimitive.Root> &
  VariantProps<typeof toggleVariants> & {
    /** 項目の間隔。`0` は隣接させ、ひと続きの segmented control に見せる。 */
    spacing?: number;
  };

/**
 * 関連する切り替えを 1 つの集合として扱う client island の toggle group。
 *
 * @remarks
 * 選択を browser 側の state として保持するため hydration が必要で、Server Component からは直接
 * render できない。選択を form の値として送る場合や URL へ載せる場合は、native form へそのまま
 * 載る `ToggleGroupNative` を使う。こちらを選ぶのは、URL にも form にも載せない即時の表示切替に
 * 限る。
 *
 * `type` は意味論そのものを変える。`single` は `radiogroup` と `radio` になり選択は
 * `aria-checked` で表され、`multiple` は `toolbar` と `aria-pressed` を持つ button になる。
 * `value` を渡すと制御 component、`defaultValue` を渡すと非制御 component として動く。
 *
 * `variant` と `size` はここで指定すると配下の項目へ引き継がれる。`spacing` を `0` にすると項目が
 * 隣接し、両端だけが丸い segmented control の見た目になる。
 *
 * 集合そのものは名前を持たないため、`aria-label` か `aria-labelledby` で**何の切り替えかを必ず
 * 示す**。矢印キーでの項目移動と roving tabindex は Radix が担う。
 *
 * @see Storybook `Form/ToggleGroupClient`
 */
function ToggleGroupClient({
  className,
  variant,
  size,
  spacing = 0,
  children,
  ...props
}: ToggleGroupClientProps) {
  const rootStyle: CSSProperties & { "--gap"?: number } = { "--gap": spacing };

  return (
    <ToggleGroupPrimitive.Root
      className={cn(
        "group/toggle-group flex w-fit items-center gap-[--spacing(var(--gap))] rounded-md data-[spacing=default]:data-[variant=outline]:shadow-xs",
        className,
      )}
      data-size={size}
      data-slot="toggle-group"
      data-spacing={spacing}
      data-variant={variant}
      style={rootStyle}
      {...props}
    >
      <ToggleGroupContext.Provider value={{ variant, size, spacing }}>
        {children}
      </ToggleGroupContext.Provider>
    </ToggleGroupPrimitive.Root>
  );
}

/**
 * 集合の中の 1 項目。
 *
 * @remarks
 * `value` は必須で、集合の中で一意にする。選択中は `type` に関わらず `data-state="on"` が付き、
 * `toggleVariants` はそれを見て両モードの見た目を示す。
 *
 * `variant` と `size` は集合から引き継がれるため、個別に指定するのは例外的な場合に限る。
 *
 * 表示する文言が項目のアクセシブルな名前になる。icon だけを置く場合は `aria-label` を添える。
 * 選択状態は role 側が伝えるため、名前を状態で切り替えない。
 *
 * @param props - Radix `ToggleGroup.Item` の props と `variant` / `size`。
 *
 * @see Storybook `Form/ToggleGroupClient`
 */
function ToggleGroupClientItem({
  className,
  children,
  variant,
  size,
  ...props
}: ComponentProps<typeof ToggleGroupPrimitive.Item> & VariantProps<typeof toggleVariants>) {
  const context = useContext(ToggleGroupContext);

  return (
    <ToggleGroupPrimitive.Item
      className={cn(
        toggleVariants({
          variant: context.variant || variant,
          size: context.size || size,
        }),
        "w-auto min-w-0 shrink-0 px-3 focus:z-10 focus-visible:z-10",
        "data-[spacing=0]:rounded-none data-[spacing=0]:shadow-none data-[spacing=0]:first:rounded-l-md data-[spacing=0]:last:rounded-r-md data-[spacing=0]:data-[variant=outline]:border-l-0 data-[spacing=0]:data-[variant=outline]:first:border-l",
        className,
      )}
      data-size={context.size || size}
      data-slot="toggle-group-item"
      data-spacing={context.spacing}
      data-variant={context.variant || variant}
      {...props}
    >
      {children}
    </ToggleGroupPrimitive.Item>
  );
}

export { ToggleGroupClient, ToggleGroupClientItem };
