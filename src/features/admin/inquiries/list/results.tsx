import { listInquiries } from "@/adapters/server/api/inquiries";
import { CursorPagination } from "@/components/app-starter/cursor-pagination/cursor-pagination";

import { type AdminInquiryListLocation, toNextPageHref, toPreviousPageHref } from "../query";
import { AdminInquiryTable } from "./ui/table/table";

/** `AdminInquiryResults` の props。 */
export type AdminInquiryResultsProps = {
  /** URL が表す、いま見ている場所。ページ送りの行き先を組むのに使う。 */
  location: AdminInquiryListLocation;
};

/**
 * 1 ページぶんの問い合わせ。
 *
 * @remarks
 * **取り直す範囲がここです。** 購読の状態は外側にあり、一覧の取り直しに巻き込まれません。
 *
 * 並び順は更新の新しい順で、契約が決めています。
 */
export async function AdminInquiryResults({ location }: AdminInquiryResultsProps) {
  const page = await listInquiries(location.cursor ?? undefined);

  return (
    <AdminInquiryTable
      items={page.items}
      pagination={
        <CursorPagination
          aria-label="問い合わせ一覧のページ送り"
          nextHref={page.nextCursor === null ? undefined : toNextPageHref(location, page.nextCursor)}
          previousHref={toPreviousPageHref(location)}
        />
      }
    />
  );
}
