"use client";

import type { ReactNode } from "react";

import { Badge } from "@/components/design-system/display/badge/badge";
import { rowActionsColumn } from "@/components/patterns/table/row-actions/row-actions";
import { ROW_ACTION_KIND } from "@/components/patterns/table/row-actions/row-actions.definition";
import {
  StaticDataTable,
  type StaticDataTableColumn,
} from "@/components/patterns/table/static-data/static-data";

import type { AdminUserRow } from "../../row";

/**
 * 狭い段で伏せる列に付ける class。
 *
 * @remarks
 * 電話番号は行を見比べるときの手がかりで、1 人を特定するのには要りません。狭い段で残すのは
 * **誰か（名前）・どこへ連絡するか（メール）・どういう状態か・何ができるか**です。
 */
const WIDE_ONLY = "hidden md:table-cell";

/** `AdminUserTable` の props。 */
export type AdminUserTableProps = {
  /** 並べる利用者。 */
  items: readonly AdminUserRow[];
  /** 退会させる操作が選ばれたことを伝える。確認を出すのは呼び出し元。 */
  onWithdraw: (user: AdminUserRow) => void;
  /** 一覧の下に置くページ送り。 */
  pagination?: ReactNode;
};

function rowKey(item: AdminUserRow): string {
  return item.id;
}

function toColumns(
  onWithdraw: (user: AdminUserRow) => void,
): readonly StaticDataTableColumn<AdminUserRow>[] {
  return [
    {
      id: "name",
      header: "名前",
      cell: (item) => <span className="font-emphasis">{item.name}</span>,
    },
    { id: "email", header: "メール", cell: (item) => item.email },
    {
      id: "phone",
      header: "電話番号",
      headerClassName: `${WIDE_ONLY} w-40`,
      cellClassName: WIDE_ONLY,
      cell: (item) => item.phone,
    },
    {
      id: "status",
      header: "状態",
      headerClassName: "w-28",
      cell: (item) =>
        item.withdrawn ? <Badge variant="outline">退会済み</Badge> : <Badge>有効</Badge>,
    },
    {
      ...rowActionsColumn<AdminUserRow>({
        triggerLabel: (item) => `${item.name} の操作`,
        // 退会済みには操作を出さない。もう一度退会させる意味が無く、出しても契約が拒むだけ。
        // 空を返すと `RowActionsMenu` が trigger ごと描かない。
        actions: (item) =>
          item.withdrawn
            ? []
            : [
                {
                  id: "withdraw",
                  kind: ROW_ACTION_KIND.COMMAND,
                  label: "退会させる",
                  variant: "destructive",
                  onSelect: () => onWithdraw(item),
                },
              ],
      }),
      width: undefined,
      headerClassName: "w-12",
      cellClassName: "relative",
    },
  ];
}

/**
 * 管理側の利用者一覧。
 *
 * @remarks
 * 取得もページ送りの組み立ても持ちません。並べる利用者と、下へ置くものを受け取るだけです。
 *
 * **確認を出すのはここではありません。** 退会は不可逆なので確認を挟みますが、確認の面と送信の
 * 結果は一覧の外側に居ます（[`WithdrawableUserList`](../withdrawable-list/withdrawable-list.tsx)）。行が知って
 * いるのは「この人に対して退会が選ばれた」ことだけです。
 *
 * **退会済みかを色だけで伝えません。** 状態の列に文字のバッジを置き、行そのものは淡くしません
 * （[0100](../../../../../../docs/adr/0100-accessibility-target.md)）。
 *
 * @see Storybook `Features/Admin/Users/Table`
 */
export function AdminUserTable({ items, onWithdraw, pagination }: AdminUserTableProps) {
  return (
    <StaticDataTable
      columns={toColumns(onWithdraw)}
      emptyMessage="条件に一致する利用者はいません。"
      getRowKey={rowKey}
      label="利用者の一覧"
      pagination={pagination}
      rows={items}
    />
  );
}
