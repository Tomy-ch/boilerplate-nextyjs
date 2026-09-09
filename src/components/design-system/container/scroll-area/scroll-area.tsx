import type { ComponentProps } from "react";

import { cn } from "@/components/cn";

/** {@link ScrollArea} の props。 */
export type ScrollAreaProps = ComponentProps<"section"> & {
  /** スクロールさせる方向。 */
  orientation?: "vertical" | "horizontal" | "both";
};

/**
 * 内容を局所的にスクロールさせる、SSR first の scroll 領域。
 *
 * @remarks
 * `overflow` と browser 標準の scrollbar だけで成り立つため、client runtime を必要としない。
 * 領域の大きさは持たないので、`max-h-*` や `max-w-*` を `className` で与える。与えない場合は
 * 内容が伸びるだけでスクロールしない。
 *
 * 画面全体のスクロールで足りる場合は使わない。局所スクロールは、周囲の内容が視界に留まることに
 * 意味がある場合にだけ選ぶ。
 *
 * スクロールできる領域は keyboard だけで操作する利用者も到達できる必要があるため、`tabIndex` を
 * `0` にしている。要素は `section` で、`aria-label` か `aria-labelledby` を与えると `region` として
 * 公開される。**アクセシブルな名前は必ず与える**。名前がないと `section` は landmark にならず、
 * focus したときに何の領域へ入ったのか判らない。
 *
 * 内容が focus 可能な要素だけで構成される場合は `tabIndex={-1}` を渡して外す。子を辿れば browser
 * が自動でスクロールするため、領域自体の tab stop は増えるだけになる。読み取り専用の内容では
 * 外さない。
 *
 * 既定ではスクロールを親へ連鎖させない（`overscroll-contain`）。下層と独立した面として重なる領域を
 * 想定した既定なので、本文の流れに置く領域は `className` に `overscroll-auto` を渡して連鎖させる。
 *
 * scrollbar は browser と OS が描画するため、見た目は環境で異なる。統一した scrollbar が要件に
 * なった場合は、client island の scroll area を別途追加する。
 *
 * @see Storybook `Container/ScrollArea`
 */
export function ScrollArea({ className, orientation = "vertical", ...props }: ScrollAreaProps) {
  return (
    <section
      className={cn(
        "overscroll-contain focus-visible:outline-2 focus-visible:outline-active focus-visible:shadow-glow-primary focus-visible:outline-offset-2",
        orientation === "vertical" && "overflow-y-auto",
        orientation === "horizontal" && "overflow-x-auto",
        orientation === "both" && "overflow-auto",
        className,
      )}
      data-slot="scroll-area"
      // biome-ignore lint/a11y/noNoninteractiveTabindex: スクロール可能な領域は非対話でも focus 可能にする必要がある。外すと keyboard だけではスクロールできず WCAG 2.1.1 に反する
      tabIndex={0}
      {...props}
    />
  );
}
