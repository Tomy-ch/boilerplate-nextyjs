// @vitest-environment jsdom

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { DROPDOWN_MENU_ITEM_VARIANT } from "@/components/design-system/overlay/dropdown-menu/dropdown-menu.definition";
import { StaticDataTable } from "../static-data/static-data";
import { RowActionsMenu, rowActionsColumn } from "./row-actions";
import { ROW_ACTION_KIND, type RowAction } from "./row-actions.definition";

beforeAll(() => {
  // Radix の menu は位置計算に使う API を jsdom が持たないため、実装を変えずにここで補う。
  Element.prototype.scrollIntoView = vi.fn();
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

async function openMenu(name: string) {
  await userEvent.click(screen.getByRole("button", { name }));
}

type Item = { id: string; name: string; retired: boolean };

const ITEMS = [
  { id: "1", name: "標準プラン", retired: false },
  { id: "2", name: "旧プラン", retired: true },
] satisfies readonly [Item, ...Item[]];

function itemRowKey(item: Item) {
  return item.id;
}

function triggerLabel(item: Item) {
  return `${item.name} の操作`;
}

function ActionsTable({ onRemove }: { onRemove?: (id: string) => void }) {
  const actions = (item: Item): readonly RowAction[] => [
    { href: `/items/${item.id}`, id: "detail", kind: ROW_ACTION_KIND.LINK, label: "詳細を見る" },
    {
      disabled: item.retired,
      href: `/items/${item.id}/edit`,
      id: "edit",
      kind: ROW_ACTION_KIND.LINK,
      label: "編集する",
    },
    { id: "sep", kind: ROW_ACTION_KIND.SEPARATOR },
    {
      id: "remove",
      kind: ROW_ACTION_KIND.COMMAND,
      label: "一覧から外す",
      onSelect: () => onRemove?.(item.id),
      variant: DROPDOWN_MENU_ITEM_VARIANT.DESTRUCTIVE,
    },
  ];

  return (
    <StaticDataTable
      columns={[
        { cell: (item) => item.name, header: "名称", id: "name" },
        rowActionsColumn<Item>({ actions, triggerLabel }),
      ]}
      getRowKey={itemRowKey}
      rows={ITEMS}
    />
  );
}

describe("rowActionsColumn", () => {
  it("行ごとに、対象が分かるアクセシブルな名前の trigger を並べる", () => {
    render(<ActionsTable />);

    expect(screen.getByRole("button", { name: "標準プラン の操作" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "旧プラン の操作" })).toBeInTheDocument();
  });

  it("操作列の見出しは読み上げ用に保持しつつ視覚的に隠す", () => {
    render(<ActionsTable />);

    const header = screen.getByRole("columnheader", { name: "操作" });

    expect(within(header).getByText("操作")).toHaveClass("sr-only");
  });

  it("link の定義を行ごとの遷移先へ展開する", async () => {
    render(<ActionsTable />);

    await openMenu("標準プラン の操作");

    expect(screen.getByRole("menuitem", { name: "詳細を見る" })).toHaveAttribute(
      "href",
      "/items/1",
    );
  });

  it("行の状態に応じて操作を無効にする", async () => {
    render(<ActionsTable />);

    await openMenu("旧プラン の操作");

    expect(screen.getByRole("menuitem", { name: "編集する" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("command の定義を選ぶと、対象の行を伴って呼び出し元の処理を実行する", async () => {
    const onRemove = vi.fn();
    render(<ActionsTable onRemove={onRemove} />);

    await openMenu("旧プラン の操作");
    await userEvent.click(screen.getByRole("menuitem", { name: "一覧から外す" }));

    expect(onRemove).toHaveBeenCalledWith("2");
  });

  it("破壊的な操作を variant で区別する", async () => {
    render(<ActionsTable />);

    await openMenu("標準プラン の操作");

    expect(screen.getByRole("menuitem", { name: "一覧から外す" })).toHaveAttribute(
      "data-variant",
      DROPDOWN_MENU_ITEM_VARIANT.DESTRUCTIVE,
    );
  });

  it("separator を項目群の区切りとして展開する", async () => {
    render(<ActionsTable />);

    await openMenu("標準プラン の操作");

    expect(screen.getByRole("separator")).toHaveAttribute("data-slot", "dropdown-menu-separator");
  });
});

describe("RowActionsMenu", () => {
  it("table を伴わず単独でも使える", async () => {
    const actions = (item: Item): readonly RowAction[] => [
      { href: `/items/${item.id}`, id: "detail", kind: ROW_ACTION_KIND.LINK, label: "詳細を見る" },
    ];
    render(<RowActionsMenu actions={actions} row={ITEMS[0]} triggerLabel={triggerLabel} />);

    await openMenu("標準プラン の操作");

    expect(screen.getByRole("menuitem", { name: "詳細を見る" })).toHaveAttribute(
      "href",
      "/items/1",
    );
  });

  it("操作が 1 つも無い行には trigger ごと出さない", () => {
    const noActions = (): readonly RowAction[] => [];

    render(<RowActionsMenu actions={noActions} row={ITEMS[0]} triggerLabel={triggerLabel} />);

    expect(screen.queryByRole("button", { name: "標準プラン の操作" })).not.toBeInTheDocument();
  });

  it("開いた状態で WCAG AA 相当の a11y 自動検査に違反しない", async () => {
    const { baseElement } = render(<ActionsTable />);

    await openMenu("標準プラン の操作");

    const result = await axe(baseElement, {
      rules: { "color-contrast": { enabled: false }, region: { enabled: false } },
    });

    expect(result.violations).toEqual([]);
  });
});
