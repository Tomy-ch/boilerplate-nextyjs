import type { ComponentProps } from "react";

import { ChevronLeftIcon, ChevronRightIcon } from "@/components/icon";

import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "../../design-system/navigation/pagination/pagination";

/** {@link CursorPagination} の props。 */
export type CursorPaginationProps = Omit<ComponentProps<"nav">, "children"> & {
  /** 前のページの URL。先頭ページでは省略する。 */
  previousHref?: string;
  /** 次のページの URL。末尾ページでは省略する。 */
  nextHref?: string;
  /** 前へ戻る操作の文言。 */
  previousLabel?: string;
  /** 次へ進む操作の文言。 */
  nextLabel?: string;
};

/**
 * cursor 方式の一覧で前後のページへ移動する、SSR first の navigation。
 *
 * @remarks
 * cursor 方式は総件数とページ数を持たないため、ページ番号を並べない。移動できるのは前後の 1 件
 * ずつであり、それ以外の位置へ直接跳べないことが page 型との本質的な差である。ページ番号で移動
 * する一覧には `Pagination` を使う。
 *
 * 描画そのものは `Pagination` の部品を合成しているだけで、前後移動の機構を独自には持たない。
 * この component が担うのは「ページ番号を並べない」という cursor 方式の契約である。
 *
 * URL の組み立ては呼び出し元が持つ。API が返す `nextCursor` を query へ載せるのも、現在の
 * 絞り込みや並び順を引き継ぐのも呼び出し元の責務で、この component は受け取った `href` へ
 * 移動させるだけである。取得も再取得も行わない。
 *
 * **行き先が無い向きは `href` を省略する。** 省略された側は link ではなく操作できない control
 * として描かれ、位置は保たれる。
 *
 * 同じ画面に複数の navigation が並ぶため、`aria-label` で何の移動かを示す。省略時は「ページ送り」
 * になる。
 *
 * @see Storybook `Navigation/CursorPagination`
 */
export function CursorPagination({
  nextHref,
  nextLabel = "次へ",
  previousHref,
  previousLabel = "前へ",
  ...props
}: CursorPaginationProps) {
  return (
    <Pagination aria-label="ページ送り" data-slot="cursor-pagination" {...props}>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious aria-label={previousLabel} href={previousHref}>
            <ChevronLeftIcon aria-hidden="true" />
            {previousLabel}
          </PaginationPrevious>
        </PaginationItem>
        <PaginationItem>
          <PaginationNext aria-label={nextLabel} href={nextHref}>
            {nextLabel}
            <ChevronRightIcon aria-hidden="true" />
          </PaginationNext>
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}
