import type { ComponentProps } from "react";

import { cn } from "@/components/cn";

/**
 * ページ先頭で、そのページが何かと主要な操作を示すブロック。
 *
 * @remarks
 * `ContentContainer` の直下に置く。**左右余白を持たない。** 余白は `ContentContainer` が所有する。
 *
 * **`main` の内側に置くこと。** `header` 要素は `main` / `article` / `aside` / `nav` /
 * `section` の外にあると `banner` landmark になり、サイト全体の header を名乗ってしまう。
 *
 * 本文の構造とデータ取得は持たない。表示する文言は呼び出し元が決める。配置の責務は同層の
 * README「責務境界」が持つ。
 *
 * Server Component として使える。hydration は不要で、`PageHeaderActions` に client island を
 * 置く場合もその部品だけが境界を持つ。
 *
 * @example
 * ```tsx
 * <PageHeader>
 *   <PageHeaderTitle>メンバー一覧</PageHeaderTitle>
 *   <PageHeaderDescription>参加中のメンバーを確認します。</PageHeaderDescription>
 *   <PageHeaderActions>
 *     <Button>メンバーを追加</Button>
 *   </PageHeaderActions>
 * </PageHeader>
 * ```
 *
 * @see Storybook `Layout/PageHeader`
 */
export function PageHeader({ className, ...props }: ComponentProps<"header">) {
  return (
    <header
      className={cn("grid gap-x-4 gap-y-2 py-6 sm:grid-cols-[1fr_auto]", className)}
      data-slot="page-header"
      {...props}
    />
  );
}

/**
 * そのページの名前。
 *
 * @remarks
 * `h1` として描画する。ページに 1 つだけ置く。見出し階層の起点になるため、装飾目的で
 * 使わない。
 *
 * @see Storybook `Layout/PageHeader`
 */
export function PageHeaderTitle({ className, ...props }: ComponentProps<"h1">) {
  return (
    <h1
      className={cn(
        "text-2xl font-emphasis tracking-wide text-foreground text-shadow-glow sm:col-start-1 sm:row-start-1",
        className,
      )}
      data-slot="page-header-title"
      {...props}
    />
  );
}

/**
 * タイトルを補う一文。
 *
 * @remarks
 * そのページで何ができるかを短く述べる。操作の手順や注意書きは本文へ置く。
 *
 * @see Storybook `Layout/PageHeader`
 */
export function PageHeaderDescription({ className, ...props }: ComponentProps<"p">) {
  return (
    <p
      className={cn("text-sm text-muted-foreground sm:col-start-1 sm:row-start-2", className)}
      data-slot="page-header-description"
      {...props}
    />
  );
}

/**
 * そのページの主要な操作を置く領域。
 *
 * @remarks
 * ページ全体に対する操作だけを置く。特定の行や項目に対する操作は、その対象の近くへ置く。
 *
 * 狭い画面ではタイトルの下へ回り込む。操作が増えるほど回り込んだときの縦の占有が増えるため、
 * 数は絞り、副次的なものは `DropdownMenu` へまとめる。
 *
 * @see Storybook `Layout/PageHeader`
 */
export function PageHeaderActions({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex shrink-0 flex-wrap items-center gap-2 sm:col-start-2 sm:row-span-2 sm:row-start-1 sm:justify-self-end",
        className,
      )}
      data-slot="page-header-actions"
      {...props}
    />
  );
}
