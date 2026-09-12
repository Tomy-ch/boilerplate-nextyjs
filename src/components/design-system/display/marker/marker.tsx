import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type { ComponentProps } from "react";

import { cn } from "@/components/cn";

import { MARKER_VARIANT, type MarkerVariant } from "./marker.definition";

const markerVariants = cva(
  "group/marker relative flex min-h-4 w-full items-center gap-2 text-left text-sm text-muted-foreground [&_svg:not([class*='size-'])]:size-4 [a]:underline [a]:underline-offset-3 [a]:hover:text-foreground",
  {
    variants: {
      variant: {
        [MARKER_VARIANT.DEFAULT]: "",
        [MARKER_VARIANT.SEPARATOR]:
          "before:mr-1 before:h-px before:min-w-0 before:flex-1 before:bg-border after:ml-1 after:h-px after:min-w-0 after:flex-1 after:bg-border",
        [MARKER_VARIANT.BORDER]: "border-b border-border pb-2",
      },
    },
    defaultVariants: {
      variant: MARKER_VARIANT.DEFAULT,
    },
  },
);

/** {@link Marker} の props。 */
export type MarkerProps = ComponentProps<"div"> &
  Omit<VariantProps<typeof markerVariants>, "variant"> & {
    /**
     * Marker と周囲の内容の区切り方。
     *
     * - `default`: 区切り線を持たず、内容の流れに沿って一行を置く
     * - `separator`: 内容の左右へ水平線を伸ばし、区切りの見出しとして中央に置く
     * - `border`: 下に罫線を引き、直後の内容の始まりを示す
     */
    variant?: MarkerVariant;
    /** 子要素へ marker の見た目と props を合成するか。 */
    asChild?: boolean;
  };

/**
 * 本文より一段控えた、一行の注釈・区切りラベル。
 *
 * @remarks
 * 補助的な位置づけの短い一行を置くための表示専用 Server Component である。時系列の区切り、
 * 一覧の末尾を示すラベル、最終更新のようなメタ情報を、本文の情報量を増やさずに添える用途に使う。
 * hydration を必要とせず、Server Component から直接 render できる。
 *
 * 文言、表示するかどうかの判断、日時や数値の整形は持たない。いずれも呼び出し元が決める。
 *
 * 読み落とされては困る内容には使わない。API 失敗や操作不能理由のように利用者の注意を引くべき
 * 通知は、`role="alert"` の意味論を持つ `Alert` を使う。装飾だけの水平線が要る場合は
 * `Separator` を使う。
 *
 * 既定では `div` を render する。この component 自身は role を持たないため、区切りとしての意味を
 * 支援技術へ伝える必要がある場合は、呼び出し元が見出し要素を子に置くか `asChild` で合成する。
 *
 * @example
 * ```tsx
 * <Marker variant={MARKER_VARIANT.SEPARATOR}>
 *   <MarkerContent>ここまで表示しました</MarkerContent>
 * </Marker>
 * ```
 *
 * @param props - native `div` 属性と、以下の表示用 props。
 * @param props.variant - 周囲の内容との区切り方。
 * @param props.asChild - 子要素へ marker の見た目と props を合成するか。
 * @see Storybook `Display/Marker`
 */
export function Marker({
  asChild = false,
  className,
  variant = MARKER_VARIANT.DEFAULT,
  ...props
}: MarkerProps) {
  const Component = asChild ? Slot.Root : "div";

  return (
    <Component
      className={cn(markerVariants({ variant, className }))}
      data-slot="marker"
      data-variant={variant}
      {...props}
    />
  );
}

/**
 * Marker の先頭へ置く装飾アイコン。
 *
 * @remarks
 * `aria-hidden` を持つため支援技術へは読み上げられない。アイコンだけで意味を伝えず、意味は必ず
 * `MarkerContent` のテキストに書く。
 *
 * @see Storybook `Display/Marker`
 */
export function MarkerIcon({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      aria-hidden="true"
      className={cn("size-4 shrink-0 [&_svg:not([class*='size-'])]:size-4", className)}
      data-slot="marker-icon"
      {...props}
    />
  );
}

/**
 * Marker が伝える本文。
 *
 * @remarks
 * `separator` の Marker では、左右へ伸びる水平線に挟まれて中央に置かれる。長い文は折り返す。
 *
 * @see Storybook `Display/Marker`
 */
export function MarkerContent({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "min-w-0 wrap-break-word group-data-[variant=separator]/marker:flex-none group-data-[variant=separator]/marker:text-center *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className,
      )}
      data-slot="marker-content"
      {...props}
    />
  );
}
