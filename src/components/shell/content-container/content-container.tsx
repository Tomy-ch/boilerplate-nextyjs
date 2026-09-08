import type { ComponentProps } from "react";

import { cn } from "@/components/cn";

/**
 * ページ本文の読み幅と左右余白を揃える枠。
 *
 * @remarks
 * `main` の内側に置き、その中身が画面幅いっぱいに広がらないようにする。**幅と左右余白だけ**を
 * 持ち、縦方向の構造・段組み・背景は持たない。それらは中身を組む側が決める。
 *
 * `main` 要素は描画しない。読み幅は一つだけで、個別の調整は `className` で行う。責務の線は
 * 同層の README「責務境界」が持つ。
 *
 * Server Component として使える。hydration は不要。
 *
 * @example
 * ```tsx
 * <main>
 *   <ContentContainer>
 *     <PageHeader>…</PageHeader>
 *     <section>…</section>
 *   </ContentContainer>
 * </main>
 * ```
 *
 * @param props - native `div` 属性。
 *
 * @see Storybook `Layout/ContentContainer`
 */
export function ContentContainer({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("mx-auto w-full max-w-5xl px-4 md:px-6", className)}
      data-slot="content-container"
      {...props}
    />
  );
}
