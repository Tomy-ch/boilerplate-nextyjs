import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useCallback, useState } from "react";
import { expect, userEvent, within } from "storybook/test";

import { cn } from "@/components/cn";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/design-system/display/table/table";
import { TableViewOptions } from "./table-view-options";
import {
  TABLE_COLUMN_PRIORITY,
  TABLE_COLUMN_PRIORITY_CLASS,
  TABLE_DENSITY,
  TABLE_DENSITY_CLASS,
  TABLE_STICKY_COLUMN_CLASS,
  TABLE_STICKY_ROW_CLASS,
  type TableColumnPriority,
  type TableDensity,
} from "./table-view-options.definition";

const noop = () => undefined;

const meta = {
  title: "Container/TableViewOptions",
  component: TableViewOptions,
  parameters: { layout: "padded" },
  args: {
    columns: [],
    density: TABLE_DENSITY.COMFORTABLE,
    onColumnVisibilityChange: noop,
    onDensityChange: noop,
  },
} satisfies Meta<typeof TableViewOptions>;
export default meta;
type Story = StoryObj<typeof meta>;

type Column = {
  id: string;
  label: string;
  priority: TableColumnPriority;
  sticky?: boolean;
  locked?: boolean;
};

const COLUMNS: readonly Column[] = [
  {
    id: "name",
    label: "プラン名",
    priority: TABLE_COLUMN_PRIORITY.ALWAYS,
    sticky: true,
    locked: true,
  },
  { id: "status", label: "状態", priority: TABLE_COLUMN_PRIORITY.ALWAYS },
  { id: "price", label: "月額", priority: TABLE_COLUMN_PRIORITY.MEDIUM },
  { id: "contracts", label: "契約数", priority: TABLE_COLUMN_PRIORITY.MEDIUM },
  { id: "updatedAt", label: "更新日時", priority: TABLE_COLUMN_PRIORITY.LOW },
  { id: "owner", label: "担当者", priority: TABLE_COLUMN_PRIORITY.LOW },
];

const ROWS: readonly Record<string, string>[] = [
  {
    id: "1",
    name: "スタンダードプラン",
    status: "公開中",
    price: "¥1,200",
    contracts: "1,204",
    updatedAt: "2026-07-30 12:04",
    owner: "田中",
  },
  {
    id: "2",
    name: "ライトプラン",
    status: "下書き",
    price: "¥600",
    contracts: "0",
    updatedAt: "2026-07-28 09:15",
    owner: "佐藤",
  },
  {
    id: "3",
    name: "エンタープライズプラン",
    status: "公開中",
    price: "¥12,000",
    contracts: "38",
    updatedAt: "2026-07-31 18:40",
    owner: "鈴木",
  },
];

function columnClass(column: Column) {
  return cn(
    TABLE_COLUMN_PRIORITY_CLASS[column.priority],
    column.sticky && TABLE_STICKY_COLUMN_CLASS,
  );
}

function PlanTable({
  columns,
  density = TABLE_DENSITY.COMFORTABLE,
  label = "契約プランの一覧",
}: {
  columns: readonly Column[];
  density?: TableDensity;
  label?: string;
}) {
  return (
    <Table className={TABLE_DENSITY_CLASS[density]} label={label}>
      <TableHeader>
        <TableRow className={TABLE_STICKY_ROW_CLASS}>
          {columns.map((column) => (
            <TableHead className={columnClass(column)} key={column.id}>
              {column.label}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {ROWS.map((row) => (
          <TableRow className={TABLE_STICKY_ROW_CLASS} key={row["id"]}>
            {columns.map((column) => (
              <TableCell className={columnClass(column)} key={column.id}>
                {row[column.id]}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function ConfigurableTable() {
  const [density, setDensity] = useState<TableDensity>(TABLE_DENSITY.COMFORTABLE);
  const [hidden, setHidden] = useState<readonly string[]>([]);
  const changeVisibility = useCallback(
    (columnId: string, visible: boolean) =>
      setHidden((current) =>
        visible ? current.filter((id) => id !== columnId) : [...current, columnId],
      ),
    [],
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <TableViewOptions
          columns={COLUMNS.map((column) => ({
            id: column.id,
            label: column.label,
            locked: column.locked,
            visible: !hidden.includes(column.id),
          }))}
          density={density}
          onColumnVisibilityChange={changeVisibility}
          onDensityChange={setDensity}
        />
      </div>
      <PlanTable
        columns={COLUMNS.filter((column) => !hidden.includes(column.id))}
        density={density}
      />
    </div>
  );
}

export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "menu から列と密度を実際に切り替えられる。プラン名は対象を識別する列なので隠せず、横 scroll でも左端に残る。",
      },
    },
  },
  render: () => <ConfigurableTable />,
};

export const MenuOpen: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "menu を開いた状態。表示する列と表示密度を一つの menu にまとめ、隠せない列は操作させない。",
      },
    },
  },
  render: () => <ConfigurableTable />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole("button", { name: "表示設定" }));

    const menu = await within(document.body).findByRole("menu");

    await expect(within(menu).getByRole("menuitemcheckbox", { name: "プラン名" })).toHaveAttribute(
      "data-disabled",
    );
  },
};

export const DensityComparison: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "密度の差。詰めるのは行の高さと上下の余白だけで、左右の余白と文字の大きさは変えない。",
      },
    },
  },
  render: () => (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <h3 className="font-emphasis text-sm">ゆったり（既定）</h3>
        <PlanTable
          columns={COLUMNS}
          density={TABLE_DENSITY.COMFORTABLE}
          label="契約プラン（ゆったり）"
        />
      </section>
      <section className="flex flex-col gap-2">
        <h3 className="font-emphasis text-sm">詰めて表示</h3>
        <PlanTable
          columns={COLUMNS}
          density={TABLE_DENSITY.COMPACT}
          label="契約プラン（詰めて表示）"
        />
      </section>
    </div>
  ),
};

export const StickyFirstColumn: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "幅が足りず横 scroll する場合。識別列は左端に残り、背景を行から引き継ぐので下の内容が透けない。",
      },
    },
  },
  render: () => (
    <div className="max-w-sm">
      <PlanTable
        columns={COLUMNS.map((column) => ({
          ...column,
          priority: TABLE_COLUMN_PRIORITY.ALWAYS,
        }))}
      />
    </div>
  ),
};

export const ColumnPriority: Story = {
  globals: { viewport: { value: "narrow" } },
  parameters: {
    viewport: {
      options: {
        narrow: { name: "狭い画面", styles: { height: "640px", width: "420px" } },
      },
    },
    docs: {
      description: {
        story:
          "画面幅による出し分け。狭い画面では月額・契約数（medium）と更新日時・担当者（low）が消え、識別に要る列だけが残る。menu の選択とは別なので、狭い画面では menu で表示にしても現れない。",
      },
    },
  },
  render: () => (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-1 text-muted-foreground text-xs">
        <li>always: プラン名 / 状態 — どの幅でも残す</li>
        <li>medium: 月額 / 契約数 — md 以上で出す</li>
        <li>low: 更新日時 / 担当者 — lg 以上で出す</li>
      </ul>
      <PlanTable columns={COLUMNS} />
    </div>
  ),
};

export const MinimumColumns: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "隠せる列をすべて隠した状態。識別列は残るので、表がどの行のことか分からなくなることはない。",
      },
    },
  },
  render: () => <PlanTable columns={COLUMNS.filter((column) => column.locked)} />,
};
