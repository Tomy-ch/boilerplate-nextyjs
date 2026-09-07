import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/design-system/navigation/pagination/pagination";
import { withPartSpan } from "@/observability/render-span";
import { toPageWindow } from "../../page-window";
import { type AdminUserListLocation, toUserListHref } from "../../query";

/** `AdminUserPagination` の props。 */
export type AdminUserPaginationProps = {
  /** URL が表す、いま見ている場所。 */
  location: AdminUserListLocation;
  /** 全部で何ページあるか。 */
  pageCount: number;
};

/**
 * 利用者一覧のページ送り。
 *
 * @remarks
 * **任意のページへ跳べます。** 契約が位置と全件数を返す offset 方式のため、次と前しか指せない
 * cursor 方式の一覧（商品・購入）とは部品から違います。
 *
 * 端では前後を link にせず、押せない control として残します。消すと残った側が左右へ動き、同じ
 * 場所を狙って押せません（`components/design-system/navigation/pagination`）。
 *
 * @see Storybook `Features/Admin/Users/Pagination`
 */
export const AdminUserPagination = withPartSpan(
  "features/admin/users/ui/pagination/pagination",
  ({ location, pageCount }: AdminUserPaginationProps) => {
    const { page, scope } = location;

    return (
      <Pagination aria-label="利用者一覧のページ送り">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              {...(page > 1 ? { href: toUserListHref({ scope, page: page - 1 }) } : {})}
            />
          </PaginationItem>
          {toPageWindow(page, pageCount).map((entry) =>
            entry.kind === "gap" ? (
              <PaginationItem key={`gap-${entry.after}`}>
                <PaginationEllipsis />
              </PaginationItem>
            ) : (
              <PaginationItem key={entry.page}>
                <PaginationLink
                  aria-label={`${entry.page} ページ目`}
                  href={toUserListHref({ scope, page: entry.page })}
                  isActive={entry.page === page}
                >
                  {entry.page}
                </PaginationLink>
              </PaginationItem>
            ),
          )}
          <PaginationItem>
            <PaginationNext
              {...(page < pageCount ? { href: toUserListHref({ scope, page: page + 1 }) } : {})}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    );
  },
);
