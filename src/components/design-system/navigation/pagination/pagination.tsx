import Link from "next/link";
import type { ComponentProps } from "react";

import { cn } from "@/components/cn";
import { ChevronLeftIcon, ChevronRightIcon, EllipsisIcon } from "@/components/icon";

import { Button, type ButtonProps } from "../../action/button/button";

/**
 * URL 遷移型のページ移動を構成する SSR first の navigation。
 *
 * @see Storybook `Navigation/Pagination`
 */
export function Pagination({ className, ...props }: ComponentProps<"nav">) {
  return (
    <nav
      aria-label="ページネーション"
      className={cn("mx-auto flex w-full justify-center", className)}
      data-slot="pagination"
      {...props}
    />
  );
}

/**
 * ページ送りの項目を横一列に並べる `ul`。
 *
 * @remarks
 * {@link Pagination} の直下に置き、子は {@link PaginationItem} で包む。順序のある一覧として
 * 支援技術に公開されるため、`li` 以外を直接の子にしない。
 *
 * **入り切らなければ折り返す。** 並ぶ数は呼び出し元が決めるもので、狭い段で何個まで収まるかは
 * 部品からは判らない。折り返さないと、はみ出した分がページごと横へあふれ、他の内容まで横送り
 * しないと読めなくなる。
 *
 * @param props - native `ul` 属性。
 * @see Storybook `Navigation/Pagination`
 */
export function PaginationContent({ className, ...props }: ComponentProps<"ul">) {
  return (
    <ul
      className={cn("flex flex-row flex-wrap items-center justify-center gap-1", className)}
      data-slot="pagination-content"
      {...props}
    />
  );
}

/**
 * ページ送りの 1 項目を表す `li`。
 *
 * @remarks
 * 中に {@link PaginationLink}、{@link PaginationPrevious}、{@link PaginationNext}、
 * {@link PaginationEllipsis} のいずれか一つを置く。
 *
 * @param props - native `li` 属性。
 * @see Storybook `Navigation/Pagination`
 */
export function PaginationItem(props: ComponentProps<"li">) {
  return <li data-slot="pagination-item" {...props} />;
}

/**
 * {@link PaginationLink} の props。
 *
 * @remarks
 * `href` は必須で、移動先のページを表す URL を呼び出し元が組み立てる。現在ページの
 * `searchParams` を引き継ぐ責務は持たないため、絞り込みや並び順を保ったまま移動する場合は
 * 呼び出し元が既存の query を含めた URL を渡す。
 */
export type PaginationLinkProps = ComponentProps<typeof Link> &
  Pick<ButtonProps, "size"> & { isActive?: boolean };

/**
 * 移動先ページへの link。
 *
 * @remarks
 * アプリ内の route 遷移のため `next/link` を使う。viewport に入った時点で移動先が prefetch され、
 * 遷移は client-side transition になる。prefetch を抑えたい場合は呼び出し元が `prefetch={false}`
 * を渡す。
 *
 * 現在ページには `isActive` を指定する。`aria-current="page"` が付き、支援技術へ現在地を伝える。
 *
 * @see Storybook `Navigation/Pagination`
 */
export function PaginationLink({
  className,
  isActive = false,
  size = "sm",
  ...props
}: PaginationLinkProps) {
  return (
    <Button asChild size={size} variant={isActive ? "outline" : "ghost"}>
      <Link
        aria-current={isActive ? "page" : undefined}
        className={className}
        data-active={isActive}
        data-slot="pagination-link"
        {...props}
      />
    </Button>
  );
}

/**
 * {@link PaginationPrevious} / {@link PaginationNext} の props。
 *
 * @remarks
 * `href` は省略できる。先頭・末尾のように**行き先が無い端**では省略し、link ではなく操作できない
 * control として描く。要素ごと消さないのは、片側だけになったときに残った操作が左右へ動いて
 * 誤操作を招くためである。
 *
 * `children` を渡すと表示内容を差し替えられる。その場合は `aria-label` も併せて指定する。
 */
export type PaginationStepProps = Omit<PaginationLinkProps, "href" | "isActive"> & {
  href?: string;
};

/** 前後移動を 1 つ描く。行き先があれば link、無ければ操作できない control になる。 */
function PaginationStep({
  "aria-label": ariaLabel,
  children,
  className,
  href,
  size = "sm",
  ...props
}: PaginationStepProps & { "aria-label": string }) {
  if (href === undefined) {
    return (
      <Button
        aria-label={ariaLabel}
        className={className}
        disabled
        size={size}
        type="button"
        variant="ghost"
      >
        {children}
      </Button>
    );
  }

  return (
    <PaginationLink aria-label={ariaLabel} className={className} href={href} size={size} {...props}>
      {children}
    </PaginationLink>
  );
}

/**
 * 一つ前のページへ戻る操作。
 *
 * @remarks
 * 既定のアクセシブルな名前は「前のページ」で、`children` を渡すと見た目だけが差し替わる。
 * 名前も変える場合は `aria-label` を明示する。先頭ページで押せなくする制御は呼び出し元が持つ。
 *
 * @param props - {@link PaginationLink} の props。
 * @param props.children - 表示内容。省略すると矢印と「前へ」を表示する。
 * @see Storybook `Navigation/Pagination`
 */
export function PaginationPrevious({
  "aria-label": ariaLabel = "前のページ",
  children,
  ...props
}: PaginationStepProps) {
  return (
    <PaginationStep aria-label={ariaLabel} {...props}>
      {children ?? (
        <>
          <ChevronLeftIcon />
          前へ
        </>
      )}
    </PaginationStep>
  );
}

/**
 * 一つ次のページへ進む操作。
 *
 * @remarks
 * 既定のアクセシブルな名前は「次のページ」で、`children` を渡すと見た目だけが差し替わる。
 * 名前も変える場合は `aria-label` を明示する。最終ページで押せなくする制御は呼び出し元が持つ。
 *
 * @param props - {@link PaginationLink} の props。
 * @param props.children - 表示内容。省略すると「次へ」と矢印を表示する。
 * @see Storybook `Navigation/Pagination`
 */
export function PaginationNext({
  "aria-label": ariaLabel = "次のページ",
  children,
  ...props
}: PaginationStepProps) {
  return (
    <PaginationStep aria-label={ariaLabel} {...props}>
      {children ?? (
        <>
          次へ
          <ChevronRightIcon />
        </>
      )}
    </PaginationStep>
  );
}

/**
 * 表示を省略したページ範囲があることを示す記号。
 *
 * @remarks
 * 記号自体は装飾として支援技術から隠し、「省略されたページ」という文字列だけを読み上げる。
 * 操作を持たないため、省略した範囲へ移動する手段は前後のページ番号が担う。
 *
 * @param props - native `span` 属性。
 * @see Storybook `Navigation/Pagination`
 */
export function PaginationEllipsis({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      className={cn("flex size-8 items-center justify-center", className)}
      data-slot="pagination-ellipsis"
      {...props}
    >
      {/* 隠すのは記号だけ。外側に付けると子孫ごとアクセシビリティツリーから外れ、
          sr-only の文言も一緒に消える。 */}
      <EllipsisIcon aria-hidden="true" className="size-4" />
      <span className="sr-only">省略されたページ</span>
    </span>
  );
}
