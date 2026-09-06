import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

import { Button } from "@/components/design-system/action/button/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/design-system/overlay/dropdown-menu/dropdown-menu";
import { EllipsisIcon } from "@/components/icon";
import type { StaticDataTableColumn } from "../static-data/static-data";
import { ROW_ACTION_KIND, type RowAction } from "./row-actions.definition";

/** {@link RowActionsMenu} の props。 */
export type RowActionsMenuProps<Row> = {
  /** 行に対して提供する操作を組み立てる。 */
  actions: (row: Row) => readonly RowAction[];
  /** 操作の対象となる行。 */
  row: Row;
  /** trigger のアクセシブルな名前。どの行に対する操作かが分かる文言を返す。 */
  triggerLabel: (row: Row) => string;
};

/**
 * 行操作の定義を DropdownMenu へ展開する sugar。
 *
 * @remarks
 * 一覧の行ごとに同じ操作構成を繰り返すための薄い合成層で、取得・保存・遷移先の決定・確認 UI は
 * 持たない。`command` の実行内容と、削除など不可逆操作の確認 (`AlertDialog`) は呼び出し元が扱う。
 * 行の束縛も呼び出し元の責務で、`actions` が受け取った行に対して確定済みの `href` と `onSelect`
 * を返す。
 *
 * trigger は icon だけなので、`triggerLabel` が唯一のアクセシブルな名前になる。行を特定できる
 * 文言を返さないと、支援技術からは同じ名前の操作が行数ぶん並ぶことになる。
 *
 * `link` だけで構成すれば Server Component から使える。`command` は関数を保持するため、
 * 呼び出し元が Client Component である必要がある。
 *
 * **操作が 1 つも無い行には trigger ごと出さない。** 押せる物が並んでいるのに開くと空、という
 * 面を作らないためで、行によって操作の有無が変わる一覧（すでに済んでいる行など）では `actions`
 * が空を返すのが自然な表し方になる。
 *
 * @see Storybook `Sugar/Table/RowActions`
 */
export function RowActionsMenu<Row>({ actions, row, triggerLabel }: RowActionsMenuProps<Row>) {
  const items = actions(row);

  if (items.length === 0) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="ghost">
          <EllipsisIcon />
          <span className="sr-only">{triggerLabel(row)}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {items.map((action) => {
          if (action.kind === ROW_ACTION_KIND.SEPARATOR) {
            return <DropdownMenuSeparator key={action.id} />;
          }

          if (action.kind === ROW_ACTION_KIND.LINK) {
            return (
              <DropdownMenuItem asChild disabled={action.disabled} key={action.id}>
                <Link href={action.href}>{action.label}</Link>
              </DropdownMenuItem>
            );
          }

          return (
            <DropdownMenuItem
              disabled={action.disabled}
              key={action.id}
              onSelect={action.onSelect}
              variant={action.variant}
            >
              {action.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** {@link rowActionsColumn} の設定。 */
export type RowActionsColumnOptions<Row> = {
  /** 行に対して提供する操作を組み立てる。 */
  actions: (row: Row) => readonly RowAction[];
  /** 読み上げ用の列見出し。視覚的には隠す。 */
  header?: ReactNode;
  /** 列の識別子。 */
  id?: string;
  /** trigger のアクセシブルな名前。 */
  triggerLabel: (row: Row) => string;
  /** 列幅。 */
  width?: CSSProperties["width"];
};

/**
 * 行操作の定義から、`StaticDataTable` の操作列を組み立てる sugar。
 *
 * @remarks
 * 一つの設定から、列の幅・見出し・alignment と、全行ぶんの `RowActionsMenu` を展開する。
 * 列そのものは表示専用で、業務型は `Row` の generics として呼び出し元に残る。
 *
 * 見出しは既定で視覚的に隠す。操作列に見える見出しは不要だが、column header が空だと table の
 * 意味論が崩れるため読み上げ用の文言は保持する。
 *
 * @example
 * ```tsx
 * const actions = rowActionsColumn<User>({
 *   triggerLabel: (user) => `${user.name} の操作`,
 *   actions: (user) => [
 *     {
 *       id: "edit",
 *       kind: ROW_ACTION_KIND.LINK,
 *       label: "編集する",
 *       href: `/admin/users/${user.id}`,
 *     },
 *   ],
 * });
 *
 * <StaticDataTable columns={[...columns, actions]} getRowKey={(user) => user.id} rows={users} />
 * ```
 *
 * @see Storybook `Sugar/Table/RowActions`
 */
export function rowActionsColumn<Row>({
  actions,
  header = "操作",
  id = "row-actions",
  triggerLabel,
  width = "3rem",
}: RowActionsColumnOptions<Row>): StaticDataTableColumn<Row> {
  return {
    align: "end",
    cell: (row) => <RowActionsMenu actions={actions} row={row} triggerLabel={triggerLabel} />,
    header: <span className="sr-only">{header}</span>,
    id,
    width,
  };
}
