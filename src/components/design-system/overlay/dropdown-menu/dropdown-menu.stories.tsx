import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useCallback, useState } from "react";

import { EllipsisIcon } from "@/components/icon";

import { Button } from "../../action/button/button";
import { Kbd } from "../../display/kbd/kbd";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "./dropdown-menu";
import { DROPDOWN_MENU_ITEM_VARIANT } from "./dropdown-menu.definition";

function ActionMenu({ defaultOpen = false }: { defaultOpen?: boolean }) {
  return (
    <DropdownMenu defaultOpen={defaultOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">操作</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem>詳細を見る</DropdownMenuItem>
        <DropdownMenuItem>複製する</DropdownMenuItem>
        <DropdownMenuItem disabled>公開する</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function GroupedMenu() {
  return (
    <DropdownMenu defaultOpen>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">アカウント</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>アカウント</DropdownMenuLabel>
        <DropdownMenuGroup>
          <DropdownMenuItem>
            プロフィール
            <DropdownMenuShortcut>
              <Kbd>⇧</Kbd>
              <Kbd>P</Kbd>
            </DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem>
            設定
            <DropdownMenuShortcut>
              <Kbd>⌘</Kbd>
              <Kbd>,</Kbd>
            </DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant={DROPDOWN_MENU_ITEM_VARIANT.DESTRUCTIVE}>
          退会する
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function IconTriggerMenu() {
  return (
    <DropdownMenu defaultOpen>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="ghost">
          <EllipsisIcon />
          <span className="sr-only">この行の操作</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem>編集する</DropdownMenuItem>
        <DropdownMenuItem variant={DROPDOWN_MENU_ITEM_VARIANT.DESTRUCTIVE}>
          削除する
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const COLUMNS = ["名称", "更新日時", "状態"];

function preventClose(event: Event) {
  event.preventDefault();
}

function ColumnCheckboxItem({
  checked,
  column,
  keepOpenOnSelect,
  onToggle,
}: {
  checked: boolean;
  column: string;
  keepOpenOnSelect: boolean;
  onToggle: (column: string, checked: boolean) => void;
}) {
  const handleCheckedChange = useCallback(
    (next: boolean) => onToggle(column, next),
    [column, onToggle],
  );

  return (
    <DropdownMenuCheckboxItem
      checked={checked}
      onCheckedChange={handleCheckedChange}
      onSelect={keepOpenOnSelect ? preventClose : undefined}
    >
      {column}
    </DropdownMenuCheckboxItem>
  );
}

function SelectionMenu({ keepOpenOnSelect = false }: { keepOpenOnSelect?: boolean }) {
  const [visibleColumns, setVisibleColumns] = useState<string[]>(["名称"]);
  const [density, setDensity] = useState("comfortable");
  const keepOpen = keepOpenOnSelect ? preventClose : undefined;
  const handleToggle = useCallback((column: string, checked: boolean) => {
    setVisibleColumns((current) =>
      checked ? [...current, column] : current.filter((name) => name !== column),
    );
  }, []);

  return (
    <DropdownMenu defaultOpen>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">表示設定</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>表示する列</DropdownMenuLabel>
        {COLUMNS.map((column) => (
          <ColumnCheckboxItem
            checked={visibleColumns.includes(column)}
            column={column}
            key={column}
            keepOpenOnSelect={keepOpenOnSelect}
            onToggle={handleToggle}
          />
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuLabel>表示密度</DropdownMenuLabel>
        <DropdownMenuRadioGroup onValueChange={setDensity} value={density}>
          <DropdownMenuRadioItem onSelect={keepOpen} value="comfortable">
            標準
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem onSelect={keepOpen} value="compact">
            高密度
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NestedMenu() {
  return (
    <DropdownMenu defaultOpen>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">共有</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem>リンクをコピー</DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>権限を変更</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem>閲覧のみ</DropdownMenuItem>
            <DropdownMenuItem>編集を許可</DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const meta = {
  title: "Overlay/DropdownMenu",
  component: DropdownMenu,
  parameters: {
    docs: { story: { inline: false, iframeHeight: 420 } },
    layout: "centered",
  },
} satisfies Meta<typeof DropdownMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

/** trigger を操作して開く基本構成。disabled な項目を含む。 */
export const Default: Story = { render: () => <ActionMenu /> };

/** 開いた状態の項目の並び。 */
export const Open: Story = { render: () => <ActionMenu defaultOpen /> };

/** 見出し・group・区切り・shortcut 表示・破壊的操作を組み合わせた場合。 */
export const Grouped: Story = { render: () => <GroupedMenu /> };

/** icon だけの trigger。`sr-only` でアクセシブルな名前を与える。 */
export const IconTrigger: Story = { render: () => <IconTriggerMenu /> };

/** 複数選択と択一選択を含む場合。既定では選択のたびに menu が閉じる。 */
export const WithSelection: Story = { render: () => <SelectionMenu /> };

/** 続けて切り替える場合。`onSelect` で `preventDefault` すると、枠外を触るまで開いたままになる。 */
export const WithSelectionKeptOpen: Story = {
  render: () => <SelectionMenu keepOpenOnSelect />,
};

/** 入れ子の menu を持つ場合。 */
export const Nested: Story = { render: () => <NestedMenu /> };
