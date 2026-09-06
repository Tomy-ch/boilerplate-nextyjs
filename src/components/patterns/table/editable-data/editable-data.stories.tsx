import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useId } from "react";

import { Button } from "@/components/design-system/action/button/button";
import { FieldError } from "@/components/design-system/form/field/field";
import { Input } from "@/components/design-system/form/input/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
} from "@/components/design-system/form/input-group/input-group";
import {
  INPUT_GROUP_ADDON_ALIGN,
  INPUT_GROUP_BUTTON_SIZE,
} from "@/components/design-system/form/input-group/input-group.definition";
import { CheckIcon } from "@/components/icon";
import { EditableDataTable, type EditableDataTableColumn } from "./editable-data";

type SettingRow = { id: string; label: string; value: string };
const rows: readonly SettingRow[] = [{ id: "name", label: "表示名", value: "サンプル" }];
const columns: readonly EditableDataTableColumn<SettingRow>[] = [
  { id: "label", header: "項目", width: "40%", cell: (row) => row.label },
  {
    id: "value",
    header: "値",
    width: "60%",
    cell: (row) => (
      <Input aria-label={`${row.label}の値`} defaultValue={row.value} name={`value-${row.id}`} />
    ),
  },
];
const getRowKey = (row: SettingRow) => row.id;
const meta = {
  title: "Sugar/Table/EditableData",
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: [
          "編集 cell を含む**列定義**から、native form と table を組み立てる sugar です。",
          "`StaticDataTable` との違いは form を伴うことだけで、列定義の形は変わりません。",
          "cell が返す要素は呼び出し元が決めるため、`Input` でも `InputGroup` でも置けます。",
          "送信は form 全体で 1 回です。検証・保存・行の増減は持ちません。",
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
/** 列定義が `Input` を返す基本形。 */
export const Default: Story = {
  render: () => (
    <EditableDataTable
      action="/"
      caption="設定の編集"
      columns={columns}
      getRowKey={getRowKey}
      rows={rows}
    />
  ),
};

function InvalidExample() {
  const errorId = useId();
  const invalidColumns: readonly EditableDataTableColumn<SettingRow>[] = [
    { id: "label", header: "項目", width: "40%", cell: (row) => row.label },
    {
      id: "value",
      header: "値",
      width: "60%",
      cell: (row) => (
        <>
          <Input
            aria-describedby={errorId}
            aria-invalid="true"
            aria-label={`${row.label}の値`}
            name={`value-${row.id}`}
          />
          <FieldError id={errorId}>入力内容を確認してください。</FieldError>
        </>
      ),
    },
  ];
  return (
    <EditableDataTable action="/" columns={invalidColumns} getRowKey={getRowKey} rows={rows} />
  );
}

/** 検証に通らなかった cell。エラー文言も列定義が返す要素の一部として置く。 */
export const Invalid: Story = { render: () => <InvalidExample /> };

const actionColumns: readonly EditableDataTableColumn<SettingRow>[] = [
  { id: "label", header: "項目", width: "35%", cell: (row) => row.label },
  {
    id: "value",
    header: "値",
    width: "45%",
    cell: (row) => (
      <Input aria-label={`${row.label}の値`} defaultValue={row.value} name={`value-${row.id}`} />
    ),
  },
  {
    id: "action",
    header: <span className="sr-only">操作</span>,
    width: "20%",
    align: "end",
    cell: () => <Button type="submit">保存</Button>,
  },
];

/** 行ごとの操作を列として持つ場合。操作専用の列を最後に足す。 */
export const WithRowAction: Story = {
  render: () => (
    <EditableDataTable action="/" columns={actionColumns} getRowKey={getRowKey} rows={rows} />
  ),
};

type MeasurementRow = { id: string; label: string; weight: string; displayName: string };
const measurementRows: readonly MeasurementRow[] = [
  { id: "default", label: "既定値", weight: "12", displayName: "サンプル" },
];
const getMeasurementRowKey = (row: MeasurementRow) => row.id;
const inputGroupColumns: readonly EditableDataTableColumn<MeasurementRow>[] = [
  { id: "label", header: "項目", width: "30%", cell: (row) => row.label },
  {
    id: "weight",
    header: "重量",
    width: "35%",
    cell: (row) => (
      <InputGroup>
        <InputGroupInput
          aria-label={`${row.label}の重量`}
          defaultValue={row.weight}
          inputMode="numeric"
          name={`weight-${row.id}`}
        />
        <InputGroupAddon align={INPUT_GROUP_ADDON_ALIGN.INLINE_END}>
          <InputGroupText>kg</InputGroupText>
        </InputGroupAddon>
      </InputGroup>
    ),
  },
  {
    id: "displayName",
    header: "表示名",
    width: "35%",
    cell: (row) => (
      <InputGroup>
        <InputGroupInput
          aria-label={`${row.label}の表示名`}
          defaultValue={row.displayName}
          name={`displayName-${row.id}`}
        />
        <InputGroupAddon align={INPUT_GROUP_ADDON_ALIGN.INLINE_END}>
          <InputGroupButton
            aria-label={`${row.label}を保存`}
            size={INPUT_GROUP_BUTTON_SIZE.ICON_SMALL}
            type="submit"
          >
            <CheckIcon aria-hidden="true" />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    ),
  },
];

/**
 * 列定義が `InputGroup` を返す場合。単位と行内操作を値の枠内へ畳めるため、`WithRowAction` の
 * ような操作専用の列を作らずに済む。sugar 側の列定義の形は変わらない。
 */
export const InputGroupCells: Story = {
  render: () => (
    <EditableDataTable
      action="/"
      caption="単位と行内操作を含む編集"
      columns={inputGroupColumns}
      getRowKey={getMeasurementRowKey}
      rows={measurementRows}
    />
  ),
};
