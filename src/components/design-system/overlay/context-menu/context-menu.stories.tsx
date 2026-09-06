import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";

import { EllipsisIcon } from "@/components/icon";

import { Button } from "../../action/button/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../dropdown-menu/dropdown-menu";
import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "./context-menu";
import { CONTEXT_MENU_ITEM_VARIANT } from "./context-menu.definition";

const TARGET_CLASS =
  "flex h-32 w-72 items-center justify-center rounded-md border border-border text-sm text-muted-foreground";

const meta = {
  title: "Overlay/ContextMenu",
  component: ContextMenu,
  parameters: { layout: "centered" },
} satisfies Meta<typeof ContextMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

function BasicContextMenu() {
  return (
    <ContextMenu>
      <ContextMenuTrigger className={TARGET_CLASS}>
        この領域を右クリックすると開きます
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem>
          開く
          <ContextMenuShortcut>⌘O</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem>
          複製する
          <ContextMenuShortcut>⌘D</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem variant={CONTEXT_MENU_ITEM_VARIANT.DESTRUCTIVE}>削除する</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

function VisibleEquivalentRow() {
  return (
    <div className="flex w-96 items-center justify-between gap-4 rounded-md border border-border px-4 py-3">
      <ContextMenu>
        <ContextMenuTrigger className="flex-1 text-sm">
          項目名（右クリックでも同じ操作を開けます）
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem>編集する</ContextMenuItem>
          <ContextMenuItem>複製する</ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem variant={CONTEXT_MENU_ITEM_VARIANT.DESTRUCTIVE}>
            削除する
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button aria-label="項目の操作" size="sm" variant="ghost">
            <EllipsisIcon aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem>編集する</DropdownMenuItem>
          <DropdownMenuItem>複製する</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive">削除する</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function LabelledGroupContextMenu() {
  return (
    <ContextMenu>
      <ContextMenuTrigger className={TARGET_CLASS}>操作対象を示す見出し付き</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuLabel>選択中の項目</ContextMenuLabel>
        <ContextMenuSeparator />
        <ContextMenuGroup>
          <ContextMenuItem>編集する</ContextMenuItem>
          <ContextMenuItem disabled>権限が無い操作</ContextMenuItem>
        </ContextMenuGroup>
      </ContextMenuContent>
    </ContextMenu>
  );
}

function SelectionStateContextMenu() {
  const [showDetail, setShowDetail] = useState(true);
  const [density, setDensity] = useState("comfortable");

  return (
    <ContextMenu>
      <ContextMenuTrigger className={TARGET_CLASS}>表示設定を切り替える</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuCheckboxItem checked={showDetail} onCheckedChange={setShowDetail}>
          詳細を表示
        </ContextMenuCheckboxItem>
        <ContextMenuSeparator />
        <ContextMenuLabel inset>表示密度</ContextMenuLabel>
        <ContextMenuRadioGroup onValueChange={setDensity} value={density}>
          <ContextMenuRadioItem value="comfortable">標準</ContextMenuRadioItem>
          <ContextMenuRadioItem value="compact">高密度</ContextMenuRadioItem>
        </ContextMenuRadioGroup>
      </ContextMenuContent>
    </ContextMenu>
  );
}

function SubMenuContextMenu() {
  return (
    <ContextMenu>
      <ContextMenuTrigger className={TARGET_CLASS}>入れ子の menu を含む</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem>編集する</ContextMenuItem>
        <ContextMenuSub>
          <ContextMenuSubTrigger>移動先を選ぶ</ContextMenuSubTrigger>
          <ContextMenuSubContent>
            <ContextMenuItem>上の階層へ</ContextMenuItem>
            <ContextMenuItem>別の一覧へ</ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>
      </ContextMenuContent>
    </ContextMenu>
  );
}

/** 対象領域を右クリック（touch は長押し、keyboard は Context Menu キー）すると開く基本構成。 */
export const Default: Story = { render: () => <BasicContextMenu /> };

/**
 * 可視の導線と併置した構成。右端の `DropdownMenu` が誰でも到達できる経路で、context menu は
 * 同じ操作への加速手段にすぎない。context menu だけにしか無い操作は置かない。
 */
export const WithVisibleEquivalent: Story = { render: () => <VisibleEquivalentRow /> };

/** 見出しと群、選べない項目を含む場合。 */
export const LabelledGroup: Story = { render: () => <LabelledGroupContextMenu /> };

/** 選択状態を持つ項目。checkbox と radio は選んだ時点で即座に反映される。 */
export const SelectionState: Story = { render: () => <SelectionStateContextMenu /> };

/** 入れ子の menu。階層は一段に留める。 */
export const SubMenu: Story = { render: () => <SubMenuContextMenu /> };
