import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useCallback, useState } from "react";

import { DROPDOWN_MENU_ITEM_VARIANT } from "@/components/design-system/overlay/dropdown-menu/dropdown-menu.definition";
import { StaticDataTable } from "../static-data/static-data";
import { RowActionsMenu, rowActionsColumn } from "./row-actions";
import { ROW_ACTION_KIND, type RowAction } from "./row-actions.definition";

type Item = {
  id: string;
  name: string;
  status: string;
};

const ITEMS = [
  { id: "1", name: "標準プラン", status: "公開中" },
  { id: "2", name: "特別プラン", status: "下書き" },
  { id: "3", name: "旧プラン", status: "終了" },
] satisfies readonly [Item, ...Item[]];

function itemRowKey(item: Item) {
  return item.id;
}

const NAME_COLUMN = { cell: (item: Item) => item.name, header: "名称", id: "name" };
const STATUS_COLUMN = { cell: (item: Item) => item.status, header: "状態", id: "status" };

function linkActions(item: Item): readonly RowAction[] {
  return [
    {
      href: `/items/${item.id}`,
      id: "detail",
      kind: ROW_ACTION_KIND.LINK,
      label: "詳細を見る",
    },
    {
      disabled: item.status === "終了",
      href: `/items/${item.id}/edit`,
      id: "edit",
      kind: ROW_ACTION_KIND.LINK,
      label: "編集する",
    },
  ];
}

function itemTriggerLabel(item: Item) {
  return `${item.name} の操作`;
}

function LinkOnlyTable() {
  return (
    <StaticDataTable
      className="w-[32rem]"
      columns={[
        NAME_COLUMN,
        STATUS_COLUMN,
        rowActionsColumn<Item>({ actions: linkActions, triggerLabel: itemTriggerLabel }),
      ]}
      getRowKey={itemRowKey}
      rows={ITEMS}
    />
  );
}

function CommandTable() {
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const buildActions = useCallback(
    (item: Item): readonly RowAction[] => [
      { href: `/items/${item.id}`, id: "detail", kind: ROW_ACTION_KIND.LINK, label: "詳細を見る" },
      { id: "sep", kind: ROW_ACTION_KIND.SEPARATOR },
      {
        id: "remove",
        kind: ROW_ACTION_KIND.COMMAND,
        label: "一覧から外す",
        onSelect: () => setRemovedIds((current) => [...current, item.id]),
        variant: DROPDOWN_MENU_ITEM_VARIANT.DESTRUCTIVE,
      },
    ],
    [],
  );

  return (
    <StaticDataTable
      className="w-[32rem]"
      columns={[
        NAME_COLUMN,
        STATUS_COLUMN,
        rowActionsColumn<Item>({ actions: buildActions, triggerLabel: itemTriggerLabel }),
      ]}
      getRowKey={itemRowKey}
      rows={ITEMS.filter((item) => !removedIds.includes(item.id))}
    />
  );
}

function StandaloneMenu() {
  return <RowActionsMenu actions={linkActions} row={ITEMS[0]} triggerLabel={itemTriggerLabel} />;
}

const meta = {
  title: "Sugar/Table/RowActions",
  parameters: { layout: "centered" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/** 遷移だけで構成した操作列。Server Component からも使える形。 */
export const LinkActions: Story = { render: () => <LinkOnlyTable /> };

/** その場で実行する操作を含む場合。実行内容は呼び出し元が持つ。 */
export const CommandActions: Story = { render: () => <CommandTable /> };

/** table を伴わず、単独の行操作 menu として使う場合。 */
export const Standalone: Story = { render: () => <StandaloneMenu /> };
