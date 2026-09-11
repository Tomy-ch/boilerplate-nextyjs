import type { ReactNode } from "react";

import { withScreenSpan } from "@/observability/render-span";

import { AdminInquiryFeedWatch } from "./ui/feed-watch/feed-watch";

/** `AdminInquiryListView` の props。 */
export type AdminInquiryListViewProps = {
  /** 一覧本体。取得の仕方で差し替えられるよう外から受け取る。 */
  children: ReactNode;
};

/**
 * 管理側の問い合わせ一覧の画面。
 *
 * @remarks
 * 取得を持ちません。一覧本体は `children` として受け取ります。
 *
 * **購読は一覧本体の外に置きます。** 中に置くと、取り直しのたびに購読ごと unmount され、
 * 取り直すたびに発券からやり直すことになります。
 *
 * 絞り込みを置きません。契約が受け付ける条件はページ送りだけで、状態も担当も持たない問い合わせに
 * 絞る軸がありません。
 */
export const AdminInquiryListView = withScreenSpan(
  "features/admin/inquiries/list/view",
  ({ children }: AdminInquiryListViewProps) => {
    return (
      <div className="space-y-6">
        <div className="flex justify-end">
          <AdminInquiryFeedWatch />
        </div>
        {children}
      </div>
    );
  },
);
