import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useId } from "react";

import { ChevronDownIcon, ListIcon, MapIcon, TableIcon } from "@/components/icon";

import { Input } from "../../form/input/input";
import {
  SelectClient,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../form/select-client/select-client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../overlay/dropdown-menu/dropdown-menu";
import { Button } from "../button/button";
import { BUTTON_SIZE, BUTTON_VARIANT } from "../button/button.definition";
import { ButtonGroup, ButtonGroupSeparator, ButtonGroupText } from "./button-group";
import { BUTTON_GROUP_ORIENTATION } from "./button-group.definition";

function ViewSwitch({ orientation }: { orientation?: "horizontal" | "vertical" }) {
  return (
    <ButtonGroup aria-label="表示の切り替え" orientation={orientation}>
      <Button variant={BUTTON_VARIANT.OUTLINE}>
        <ListIcon aria-hidden="true" />
        一覧
      </Button>
      <Button variant={BUTTON_VARIANT.OUTLINE}>
        <TableIcon aria-hidden="true" />表
      </Button>
      <Button variant={BUTTON_VARIANT.OUTLINE}>
        <MapIcon aria-hidden="true" />
        地図
      </Button>
    </ButtonGroup>
  );
}

function AmountField() {
  const amountId = useId();

  return (
    <ButtonGroup aria-label="金額の指定">
      <ButtonGroupText asChild>
        <label htmlFor={amountId}>￥</label>
      </ButtonGroupText>
      <Input className="w-32" id={amountId} inputMode="numeric" name="amount" defaultValue="1200" />
      <ButtonGroupText>／月</ButtonGroupText>
    </ButtonGroup>
  );
}

function SplitAction({ defaultOpen = false }: { defaultOpen?: boolean }) {
  return (
    <ButtonGroup aria-label="保存">
      <Button>保存する</Button>
      <ButtonGroupSeparator className="bg-background/40" />
      <DropdownMenu defaultOpen={defaultOpen}>
        <DropdownMenuTrigger asChild>
          <Button aria-label="保存方法を選ぶ">
            <ChevronDownIcon aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem>下書きとして保存</DropdownMenuItem>
          <DropdownMenuItem>複製して保存</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </ButtonGroup>
  );
}

function SeparatorContrast() {
  return (
    <div className="flex flex-col gap-4">
      <ButtonGroup aria-label="面を塗らない帯">
        <Button variant={BUTTON_VARIANT.OUTLINE}>編集</Button>
        <ButtonGroupSeparator />
        <Button variant={BUTTON_VARIANT.OUTLINE}>複製</Button>
      </ButtonGroup>
      <ButtonGroup aria-label="面を塗る帯">
        <Button>編集</Button>
        <ButtonGroupSeparator className="bg-background/40" />
        <Button>複製</Button>
      </ButtonGroup>
    </div>
  );
}

function NestedGroups() {
  return (
    <ButtonGroup aria-label="本文の書式">
      <ButtonGroup aria-label="文字の装飾">
        <Button size={BUTTON_SIZE.SMALL} variant={BUTTON_VARIANT.OUTLINE}>
          太字
        </Button>
        <Button size={BUTTON_SIZE.SMALL} variant={BUTTON_VARIANT.OUTLINE}>
          斜体
        </Button>
      </ButtonGroup>
      <ButtonGroup aria-label="段落の揃え">
        <Button size={BUTTON_SIZE.SMALL} variant={BUTTON_VARIANT.OUTLINE}>
          左
        </Button>
        <Button size={BUTTON_SIZE.SMALL} variant={BUTTON_VARIANT.OUTLINE}>
          中央
        </Button>
      </ButtonGroup>
    </ButtonGroup>
  );
}

function WithSelectTrigger() {
  const triggerId = useId();

  return (
    <ButtonGroup aria-label="並べ替え">
      <ButtonGroupText asChild>
        <label htmlFor={triggerId}>並び順</label>
      </ButtonGroupText>
      <SelectClient defaultValue="newest" name="sort">
        <SelectTrigger id={triggerId}>
          <SelectValue placeholder="選択してください" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="newest">新しい順</SelectItem>
          <SelectItem value="oldest">古い順</SelectItem>
          <SelectItem value="name">名前順</SelectItem>
        </SelectContent>
      </SelectClient>
    </ButtonGroup>
  );
}

const meta = {
  title: "Action/ButtonGroup",
  component: ButtonGroup,
  parameters: {
    layout: "centered",
    docs: {
      story: { inline: false, iframeHeight: 420 },
      description: {
        component: [
          "同じ対象への複数の操作を、隣り合う角丸と境界を繋いだ一続きの帯にまとめます。",
          "押した結果も、どれが選ばれているかも持ちません。選択状態を示すなら `ToggleGroup`、",
          "単に間を空けて並べるだけなら `flex` と `gap-*` を使います。",
          "まとまりに名前が要るため、どの story も `aria-label` を渡しています。",
        ].join(""),
      },
    },
  },
} satisfies Meta<typeof ButtonGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 既定の横並び。隣り合う辺の角丸が外れ、境界は 1 本に畳まれる。 */
export const Default: Story = { render: () => <ViewSwitch /> };

/** 縦積み。横幅が足りない場所では `orientation` を変えて同じ帯を縦に置く。 */
export const Vertical: Story = {
  render: () => <ViewSwitch orientation={BUTTON_GROUP_ORIENTATION.VERTICAL} />,
};

/**
 * 操作ではない語を挟む場合。単位や接頭辞は `ButtonGroupText` に置き、押せる要素と見た目で
 * 区別する。入力欄の名前にするときは `asChild` で `label` へ合成する。
 */
export const WithText: Story = { render: () => <AmountField /> };

/**
 * 主操作と、その別法を開く操作を一つの帯にする場合。境界が畳まれて 1 つの塊に見えるため、
 * 区切りを入れて押す先が 2 つあることを示す。開く先は `DropdownMenu` が持ち、この帯は
 * trigger を隣へ繋ぐだけである。
 */
export const SplitButton: Story = { render: () => <SplitAction /> };

/** 別法を開いた状態。menu の位置は trigger を基準に決まる。 */
export const SplitButtonOpen: Story = { render: () => <SplitAction defaultOpen /> };

/**
 * 区切りの色。既定の `bg-border` は面を塗らない `outline` の帯でそのまま見えるが、面を塗る
 * `default` の帯では塗りに沈むため、面と対比する色を呼び出し元が渡す。
 */
export const SeparatorOnFilledSurface: Story = { render: () => <SeparatorContrast /> };

/**
 * 帯を入れ子にした場合。内側の帯どうしは隙間で分かれ、それぞれの中だけで境界が畳まれる。
 * 意味の異なる操作を 1 本に繋げず、まとまりごとに名前を与える。
 */
export const Nested: Story = { render: () => <NestedGroups /> };

/**
 * 選択部品を帯へ入れる場合。`SelectClient` は送信用の hidden な `select` を後ろに置くため、
 * trigger が見た目の末尾でも `:last-child` に当たらない。帯側が角丸を戻している。
 */
export const WithSelect: Story = { render: () => <WithSelectTrigger /> };

/**
 * 大きさは繋がらない。並べる `Button` の `size` が揃っていないと、高さと角丸がずれて帯に
 * 見えなくなる。
 */
export const MismatchedSize: Story = {
  render: () => (
    <ButtonGroup aria-label="大きさが揃っていない例">
      <Button size={BUTTON_SIZE.SMALL} variant={BUTTON_VARIANT.OUTLINE}>
        小
      </Button>
      <Button size={BUTTON_SIZE.LARGE} variant={BUTTON_VARIANT.OUTLINE}>
        大
      </Button>
    </ButtonGroup>
  ),
};
