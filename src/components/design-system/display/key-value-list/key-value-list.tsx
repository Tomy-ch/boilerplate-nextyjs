import type { ComponentProps } from "react";

import { cn } from "@/components/cn";

/**
 * label と value の対を並べる記述リスト。
 *
 * @remarks
 * 対象の属性、設定値、要約のように「項目名と値」が繰り返す表示に使う。native の `dl` を
 * 描画するため hydration を必要とせず、Server Component から直接 render できる。
 *
 * 値の整形は持たない。日時・金額・割合は `model/` の formatter を通した文字列を渡す。項目の
 * 並び順、表示する / しないの判断、取得も持たない。
 *
 * 行が二つの軸で比較される表形式のデータには使わない。列見出しと行見出しの両方が意味を持つ場合は
 * `Table` を使う。
 *
 * @example
 * ```tsx
 * <KeyValueList>
 *   <KeyValueItem>
 *     <KeyValueLabel>状態</KeyValueLabel>
 *     <KeyValueValue>公開中</KeyValueValue>
 *   </KeyValueItem>
 * </KeyValueList>
 * ```
 *
 * @see Storybook `Display/KeyValueList`
 */
export function KeyValueList({ className, ...props }: ComponentProps<"dl">) {
  return (
    <dl
      className={cn("grid gap-x-6 gap-y-3 text-sm", className)}
      data-slot="key-value-list"
      {...props}
    />
  );
}

/**
 * label と value の対を一組にまとめる行。
 *
 * @remarks
 * 狭い幅では label を上、value を下に積み、`sm` 以上で横に並べる。`dl` の直下に `div` を置くのは
 * HTML が認める組で、一対を一つの grid 行として扱うために必要になる。
 *
 * @see Storybook `Display/KeyValueList`
 */
export function KeyValueItem({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      // 値の列は `minmax(0,1fr)`。`1fr` の最小値は `min-content` なので、区切りの無い長い値が
      // 列ごと押し広げ、器から溢れる。`wrap-break-word` は min-content 幅を縮めないため、
      // 折り返しの指定だけでは防げない。
      className={cn(
        "grid gap-1 sm:grid-cols-[minmax(6rem,12rem)_minmax(0,1fr)] sm:gap-x-6",
        className,
      )}
      data-slot="key-value-item"
      {...props}
    />
  );
}

/**
 * 値そのものではなく、値が何であるかを示す短い語を置く項目名。
 *
 * @remarks
 * 補足が要る場合は value 側へ書く。
 *
 * @see Storybook `Display/KeyValueList`
 */
export function KeyValueLabel({ className, ...props }: ComponentProps<"dt">) {
  return (
    <dt className={cn("text-muted-foreground", className)} data-slot="key-value-label" {...props} />
  );
}

/**
 * 長い値を折り返して見せる項目の値。
 *
 * @remarks
 * 改行を含む値をそのまま見せる場合は、呼び出し元が `className` で
 * `whitespace-pre-line` を指定する。値が無い場合は `KeyValueEmpty` を置く。
 *
 * @see Storybook `Display/KeyValueList`
 */
export function KeyValueValue({ className, ...props }: ComponentProps<"dd">) {
  return (
    <dd
      className={cn("wrap-break-word text-foreground", className)}
      data-slot="key-value-value"
      {...props}
    />
  );
}

/**
 * 値が無いことを示す表示。
 *
 * @remarks
 * `KeyValueValue` の中に置く。記号だけでは読み上げが意味を成さないため、記号は支援技術から隠し、
 * 代わりに読み上げ用の語を添える。行ごと消さないのは、項目が存在すること自体が情報であり、
 * 消すと他の項目の位置が動いて読み取りにくくなるためである。
 *
 * @param props - native `span` 属性。`children` に読み上げる語を渡す。既定は「未設定」。
 *
 * @see Storybook `Display/KeyValueList`
 */
export function KeyValueEmpty({
  children = "未設定",
  className,
  ...props
}: ComponentProps<"span">) {
  return (
    <span className={cn("text-muted-foreground", className)} data-slot="key-value-empty" {...props}>
      <span aria-hidden="true">—</span>
      <span className="sr-only">{children}</span>
    </span>
  );
}
