import { cva } from "class-variance-authority";
import { Slot } from "radix-ui";
import type { ComponentProps } from "react";

import { cn } from "@/components/cn";

import { Separator } from "../../display/separator/separator";
import { BUTTON_GROUP_ORIENTATION, type ButtonGroupOrientation } from "./button-group.definition";

/**
 * 操作群を一続きの帯として見せる class 名生成器。
 *
 * @remarks
 * {@link ButtonGroup} を render できない場所で、並びの見た目だけを借りるために公開している。
 * 通常は {@link ButtonGroup} を使う。
 *
 * @see Storybook `Action/ButtonGroup`
 */
export const buttonGroupVariants = cva(
  cn(
    "flex w-fit items-stretch",
    // 入れ子の group どうしは隙間で分ける。
    "has-[>[data-slot=button-group]]:gap-2",
    // 隣の面が focus の outline を覆わないよう、focus 中だけ手前へ出す。
    "[&>*]:focus-visible:relative [&>*]:focus-visible:z-10",
    // 入力欄を含む場合は入力欄だけが余りを取る。
    "[&>input]:flex-1",
    // SelectClient は送信用の hidden select を後ろに置くため、trigger が最後の見える子でも
    // :last-child に当たらない。角丸を戻す。
    "has-[select[aria-hidden=true]:last-child]:[&>[data-slot=select-trigger]:last-of-type]:rounded-r-md",
    "[&>[data-slot=select-trigger]:not([class*='w-'])]:w-fit",
  ),
  {
    variants: {
      orientation: {
        [BUTTON_GROUP_ORIENTATION.HORIZONTAL]:
          "[&>*:not(:first-child)]:rounded-l-none [&>*:not(:first-child)]:border-l-0 [&>*:not(:last-child)]:rounded-r-none",
        [BUTTON_GROUP_ORIENTATION.VERTICAL]:
          "flex-col [&>*:not(:first-child)]:rounded-t-none [&>*:not(:first-child)]:border-t-0 [&>*:not(:last-child)]:rounded-b-none",
      },
    },
    defaultVariants: {
      orientation: BUTTON_GROUP_ORIENTATION.HORIZONTAL,
    },
  },
);

/** {@link ButtonGroup} の props。 */
export type ButtonGroupProps = ComponentProps<"div"> & {
  /** 操作を並べる向き。 */
  orientation?: ButtonGroupOrientation;
};

/**
 * 同じ対象に対する複数の操作を、隣接した一続きの帯としてまとめる。
 *
 * @remarks
 * 隣り合う子の角丸と境界を繋ぐだけで、押した結果・選択状態・排他制御は持たない。どれか一つが
 * 選ばれている状態を示すなら `ToggleGroupNative` / `ToggleGroupClient` を、単に余白を空けて
 * 並べるだけなら `flex` と `gap-*` を使う。
 *
 * まとまりに名前が要るため `aria-label` を渡す。子の大きさは繋がらないので、並べる `Button` の
 * `size` は揃える。子は `Button` に限らず、`ButtonGroupText`・`Input`・`SelectClient` の trigger も
 * 置ける。
 *
 * @example
 * ```tsx
 * <ButtonGroup aria-label="表示の切り替え">
 *   <Button variant={BUTTON_VARIANT.OUTLINE}>一覧</Button>
 *   <Button variant={BUTTON_VARIANT.OUTLINE}>地図</Button>
 * </ButtonGroup>
 * ```
 *
 * @param props - native `div` 属性。`role="group"` は既定で付与する。
 * @param props.orientation - 操作を並べる向き。
 * @see Storybook `Action/ButtonGroup`
 */
export function ButtonGroup({
  className,
  orientation = BUTTON_GROUP_ORIENTATION.HORIZONTAL,
  ...props
}: ButtonGroupProps) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: fieldset は legend を伴う form control の集合を表す。ここは同じ対象への操作を束ねるだけであり、意味論は role="group" が正しい
    <div
      className={cn(buttonGroupVariants({ orientation }), className)}
      data-orientation={orientation}
      data-slot="button-group"
      role="group"
      {...props}
    />
  );
}

/** {@link ButtonGroupText} の props。 */
export type ButtonGroupTextProps = ComponentProps<"div"> & {
  /** 子要素へ見た目と props を合成するか。 */
  asChild?: boolean;
};

/**
 * 帯の中で、操作ではない短い語を操作と同じ高さで示す。
 *
 * @remarks
 * 単位・接頭辞・件数など、押せないことが見た目から分かる必要がある語に使う。押せる要素には
 * `Button` を使う。入力欄の名前として使う場合は `asChild` で `label` へ合成し、`htmlFor` を渡す。
 *
 * @example
 * ```tsx
 * <ButtonGroupText asChild>
 *   <label htmlFor={amountId}>金額</label>
 * </ButtonGroupText>
 * ```
 *
 * @param props.asChild - 子要素へ見た目と props を合成するか。
 * @see Storybook `Action/ButtonGroup`
 */
export function ButtonGroupText({ className, asChild = false, ...props }: ButtonGroupTextProps) {
  const Component = asChild ? Slot.Root : "div";

  return (
    <Component
      className={cn(
        "flex items-center gap-2 rounded-md border border-border bg-muted px-4 font-emphasis text-sm shadow-xs",
        "[&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      data-slot="button-group-text"
      {...props}
    />
  );
}

/** {@link ButtonGroupSeparator} の props。 */
export type ButtonGroupSeparatorProps = ComponentProps<typeof Separator>;

/**
 * 帯の中の操作どうしを線で分ける。
 *
 * @remarks
 * 向きは帯と直交するため、既定は横並びの帯に合わせた `vertical` である。縦積みの帯では
 * `horizontal` を渡す。操作の意味は各 `Button` の文言が持つので、既定で装飾として扱い
 * 読み上げ対象にしない。
 *
 * 色は `bg-border` なので、面を塗らない `outline` / `ghost` の帯でそのまま見える。面を塗る
 * `default` の帯では塗りに沈むため、`bg-background/40` のように面と対比する色を渡す。
 *
 * @param props - {@link Separator} の props。
 * @see Storybook `Action/ButtonGroup`
 */
export function ButtonGroupSeparator({
  className,
  decorative = true,
  orientation = "vertical",
  ...props
}: ButtonGroupSeparatorProps) {
  return (
    <Separator
      className={cn("self-stretch", className)}
      data-slot="button-group-separator"
      decorative={decorative}
      orientation={orientation}
      {...props}
    />
  );
}
