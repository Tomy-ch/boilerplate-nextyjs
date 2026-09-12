import { Suspense } from "react";

import type { RawSearchParams } from "@/model/search-params";
import { withScreenSpan } from "@/observability/render-span";

import { toAdminInquiryListLocation } from "../read-location";
import { AdminInquiryResults } from "./results";
import { AdminInquiryListSkeleton } from "./ui/skeleton/skeleton";
import { AdminInquiryListView } from "./view";

/** `AdminInquiryListPageContent` の props。 */
export type AdminInquiryListPageContentProps = {
  /** route が受け取った素の検索条件。 */
  searchParams: RawSearchParams;
};

/**
 * 問い合わせ一覧の URL 解釈と画面の組み立て。
 *
 * @remarks
 * **取り直す範囲をここで区切ります。** 待機の境界を一覧本体だけに掛けるため、購読の状態は
 * ページを送っている間も消えません。
 *
 * **場所が変わったら作り直します**（`key`）。同じ位置に留まったまま中身だけ入れ替わると、前の
 * ページの行が新しい待機の下に残ります。
 */
export const AdminInquiryListPageContent = withScreenSpan(
  "features/admin/inquiries/list/page-content",
  ({ searchParams }: AdminInquiryListPageContentProps) => {
    const location = toAdminInquiryListLocation(searchParams);

    return (
      <AdminInquiryListView>
        <Suspense fallback={<AdminInquiryListSkeleton />} key={location.cursor ?? ""}>
          <AdminInquiryResults location={location} />
        </Suspense>
      </AdminInquiryListView>
    );
  },
);
