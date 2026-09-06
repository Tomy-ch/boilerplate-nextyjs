import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useId } from "react";

import { CheckIcon } from "@/components/icon";

import { Button } from "../../action/button/button";
import { FieldError } from "../field/field";
import { Input } from "../input/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
} from "../input-group/input-group";
import {
  INPUT_GROUP_ADDON_ALIGN,
  INPUT_GROUP_BUTTON_SIZE,
} from "../input-group/input-group.definition";
import {
  EditableTable,
  EditableTableBody,
  EditableTableCaption,
  EditableTableCell,
  EditableTableHead,
  EditableTableHeader,
  EditableTableRow,
} from "./editable-table";

const meta = {
  title: "Form/EditableTable",
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: [
          "native の form control を table の cell に置いて編集させます。**表を `form` で包んだ形**で、",
          "行や cell ごとの送信は持ちません。読み取り専用の表は `Table` を使い、",
          "列定義から組み立てたい場合は `EditableDataTable` を使います。",
          "cell に control を置いても列見出しとの関係は保たれるため、`aria-label` で",
          "「どの行のどの項目か」を control 自身に持たせます。",
          "検証・保存・行の増減は呼び出し元が持ちます。",
        ].join(""),
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="w-[40rem] max-w-[calc(100vw-2rem)]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const INLINE_EDIT_INPUT_CLASS =
  "absolute inset-0 h-full w-full rounded-none border-0 bg-transparent px-2 py-0 text-foreground caret-background shadow-none focus-visible:bg-background focus-visible:text-foreground focus-visible:caret-foreground focus-visible:outline-none focus-visible:selection:bg-foreground focus-visible:selection:text-background";
const INLINE_EDIT_UNDERLINE_CLASS =
  "pointer-events-none absolute inset-x-0 bottom-2 border-b border-b-transparent transition-colors duration-150 group-hover/editable-cell:border-b-foreground group-focus-within/editable-cell:border-b-foreground motion-reduce:transition-none";

/** 1 行だけの編集。送信は form 全体で 1 回行う。 */
export const Default: Story = {
  render: () => (
    <EditableTable action="/" label="編集する行の一覧">
      <EditableTableCaption>表示名の編集</EditableTableCaption>
      <EditableTableHeader>
        <EditableTableRow>
          <EditableTableHead scope="col">項目</EditableTableHead>
          <EditableTableHead scope="col">値</EditableTableHead>
          <EditableTableHead scope="col">
            <span className="sr-only">操作</span>
          </EditableTableHead>
        </EditableTableRow>
      </EditableTableHeader>
      <EditableTableBody>
        <EditableTableRow>
          <EditableTableCell>表示名</EditableTableCell>
          <EditableTableCell>
            <Input aria-label="表示名" defaultValue="サンプル" name="displayName" />
          </EditableTableCell>
          <EditableTableCell>
            <Button type="submit">保存</Button>
          </EditableTableCell>
        </EditableTableRow>
      </EditableTableBody>
    </EditableTable>
  ),
};

function InvalidTable() {
  const errorId = useId();
  return (
    <EditableTable action="/" label="編集する行の一覧">
      <EditableTableHeader>
        <EditableTableRow>
          <EditableTableHead scope="col">項目</EditableTableHead>
          <EditableTableHead scope="col">値</EditableTableHead>
        </EditableTableRow>
      </EditableTableHeader>
      <EditableTableBody>
        <EditableTableRow>
          <EditableTableCell>識別子</EditableTableCell>
          <EditableTableCell>
            <Input
              aria-describedby={errorId}
              aria-invalid="true"
              aria-label="識別子"
              name="identifier"
            />
            <FieldError id={errorId}>入力内容を確認してください。</FieldError>
          </EditableTableCell>
        </EditableTableRow>
      </EditableTableBody>
    </EditableTable>
  );
}

/**
 * 検証に通らなかった cell。エラー文言は cell の中へ置き、control の `aria-describedby` から
 * 参照させる。
 */
export const Invalid: Story = {
  render: () => <InvalidTable />,
};

/**
 * 単位と行内操作を `InputGroup` で値の枠内へ畳む場合。操作専用の列を作らずに済み、
 * 単位が「どの入力に属するか」も枠で示せる。cell へ client island を持ち込むため、
 * 単位も枠内操作も不要な cell は `Input` のままにする。
 */
export const InputGroupCells: Story = {
  render: () => (
    <EditableTable action="/" label="編集する行の一覧">
      <EditableTableCaption>単位と行内操作を含む編集</EditableTableCaption>
      <EditableTableHeader>
        <EditableTableRow>
          <EditableTableHead scope="col">項目</EditableTableHead>
          <EditableTableHead className="w-1/2" scope="col">
            値
          </EditableTableHead>
        </EditableTableRow>
      </EditableTableHeader>
      <EditableTableBody>
        <EditableTableRow>
          <EditableTableCell>重量</EditableTableCell>
          <EditableTableCell>
            <InputGroup>
              <InputGroupInput
                aria-label="重量"
                defaultValue="12"
                inputMode="numeric"
                name="weight"
              />
              <InputGroupAddon align={INPUT_GROUP_ADDON_ALIGN.INLINE_END}>
                <InputGroupText>kg</InputGroupText>
              </InputGroupAddon>
            </InputGroup>
          </EditableTableCell>
        </EditableTableRow>
        <EditableTableRow>
          <EditableTableCell>割合</EditableTableCell>
          <EditableTableCell>
            <InputGroup>
              <InputGroupInput
                aria-label="割合"
                defaultValue="30"
                inputMode="numeric"
                name="ratio"
              />
              <InputGroupAddon align={INPUT_GROUP_ADDON_ALIGN.INLINE_END}>
                <InputGroupText>%</InputGroupText>
              </InputGroupAddon>
            </InputGroup>
          </EditableTableCell>
        </EditableTableRow>
        <EditableTableRow>
          <EditableTableCell>表示名</EditableTableCell>
          <EditableTableCell>
            <InputGroup>
              <InputGroupInput aria-label="表示名" defaultValue="サンプル" name="displayName" />
              <InputGroupAddon align={INPUT_GROUP_ADDON_ALIGN.INLINE_END}>
                <InputGroupButton
                  aria-label="表示名を保存"
                  size={INPUT_GROUP_BUTTON_SIZE.ICON_SMALL}
                  type="submit"
                >
                  <CheckIcon aria-hidden="true" />
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
          </EditableTableCell>
        </EditableTableRow>
      </EditableTableBody>
    </EditableTable>
  ),
};

/**
 * cell の枠を消して、表の見た目のまま直接書き換えさせる場合。枠が無いぶん編集できることが
 * 伝わりにくいので、hover と focus で下線を出す。
 */
export const DataTableLike: Story = {
  render: () => (
    <EditableTable action="/" label="編集する行の一覧">
      <EditableTableCaption>インライン編集</EditableTableCaption>
      <EditableTableHeader>
        <EditableTableRow>
          <EditableTableHead scope="col">項目</EditableTableHead>
          <EditableTableHead className="w-1/2" scope="col">
            状態
          </EditableTableHead>
        </EditableTableRow>
      </EditableTableHeader>
      <EditableTableBody>
        <EditableTableRow>
          <EditableTableCell>概要</EditableTableCell>
          <EditableTableCell className="group/editable-cell relative h-10 w-1/2 p-0">
            <Input
              aria-label="概要の状態"
              className={INLINE_EDIT_INPUT_CLASS}
              defaultValue="確認済み"
              name="summaryStatus"
            />
            <span aria-hidden="true" className={INLINE_EDIT_UNDERLINE_CLASS} />
          </EditableTableCell>
        </EditableTableRow>
        <EditableTableRow>
          <EditableTableCell>お知らせ</EditableTableCell>
          <EditableTableCell className="group/editable-cell relative h-10 w-1/2 p-0">
            <Input
              aria-label="お知らせの状態"
              className={INLINE_EDIT_INPUT_CLASS}
              defaultValue="準備中"
              name="noticeStatus"
            />
            <span aria-hidden="true" className={INLINE_EDIT_UNDERLINE_CLASS} />
          </EditableTableCell>
        </EditableTableRow>
      </EditableTableBody>
    </EditableTable>
  ),
};
