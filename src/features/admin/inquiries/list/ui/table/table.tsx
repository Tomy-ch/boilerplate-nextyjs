import Link from "next/link";
import type { ReactNode } from "react";

import {
  StaticDataTable,
  type StaticDataTableColumn,
} from "@/components/patterns/table/static-data/static-data";
import { formatDateTime } from "@/model/datetime";
import type { InquirySummary } from "@/model/inquiry/inquiry";
import { withPartSpan } from "@/observability/render-span";

import { adminInquiryDetailPath } from "../../../../paths";

const FOCUS_RING =
  "rounded-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active";

/**
 * 狭い段で伏せる列に付ける class。
 *
 * @remarks
 * 開始日時は並びの手がかりにならず（並ぶのは更新の新しい順）、1 件を選ぶのにも要りません。
 * 狭い段に残すのは**誰の問い合わせか**と**いつ動いたか**の 2 つです。
 */
const WIDE_ONLY = "hidden md:table-cell";

const COLUMNS: readonly StaticDataTableColumn<InquirySummary>[] = [
  {
    id: "user",
    header: "利用者",
    cell: (item) => (
      <Link
        className={`${FOCUS_RING} font-emphasis after:absolute after:inset-0`}
        href={adminInquiryDetailPath(item.id)}
      >
        {item.userId}
      </Link>
    ),
    cellClassName: "break-all",
  },
  {
    id: "updatedAt",
    header: "最終更新",
    headerClassName: "w-52",
    cell: (item) => formatDateTime(item.updatedAt),
  },
  {
    id: "createdAt",
    header: "開始",
    headerClassName: `${WIDE_ONLY} w-52`,
    cellClassName: WIDE_ONLY,
    cell: (item) => formatDateTime(item.createdAt),
  },
];

function rowKey(item: InquirySummary): string {
  return item.id;
}

/** `AdminInquiryTable` の props。 */
export type AdminInquiryTableProps = {
  /** 並べる問い合わせ。更新の新しい順で受け取る。 */
  items: readonly InquirySummary[];
  /** 一覧の下に置くページ送り。 */
  pagination?: ReactNode;
};

/**
 * 問い合わせの一覧。
 *
 * @remarks
 * **本文を出しません。** 契約が一覧に本文を載せておらず、載せるには行ごとに履歴を引くことに
 * なります。何が書かれているかは 1 件を開いて読みます。
 *
 * 行から開くのは利用者の識別子を押す形です。問い合わせ自身に題名が無く、行を指す語が他に
 * ありません。
 */
export const AdminInquiryTable = withPartSpan(
  "features/admin/inquiries/list/ui/table/table",
  ({ items, pagination }: AdminInquiryTableProps) => {
    return (
      <StaticDataTable
        columns={COLUMNS}
        emptyMessage="問い合わせはまだありません。"
        getRowKey={rowKey}
        label="問い合わせの一覧"
        pagination={pagination}
        rowClassName="relative cursor-pointer"
        rows={items}
      />
    );
  },
);
