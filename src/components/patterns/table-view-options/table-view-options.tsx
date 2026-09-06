"use client";

import { useCallback } from "react";

import { Button } from "@/components/design-system/action/button/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/design-system/overlay/dropdown-menu/dropdown-menu";
import { SlidersIcon } from "@/components/icon";
import { TABLE_DENSITY, type TableDensity } from "./table-view-options.definition";

/** 表示を切り替えられる列 1 つ。 */
export type TableColumnOption = {
  /** 列の識別子。 */
  id: string;
  /** menu に出す列の名前。 */
  label: string;
  /** いま表示しているか。 */
  visible: boolean;
  /** 隠せない列か。対象を識別できなくなる列に指定する。 */
  locked?: boolean;
};

/** {@link TableViewOptions} の props。 */
export type TableViewOptionsProps = {
  /** 表示を切り替えられる列。 */
  columns: readonly TableColumnOption[];
  /** 列の表示を切り替える。 */
  onColumnVisibilityChange: (columnId: string, visible: boolean) => void;
  /** いまの表示密度。 */
  density: TableDensity;
  /** 表示密度を変える。 */
  onDensityChange: (density: TableDensity) => void;
  /** 操作のアクセシブルな名前。 */
  label?: string;
};

/**
 * 表の見た目の設定を 1 か所へ集める client island。
 *
 * @remarks
 * 表示する列と行の詰め方を menu から切り替える。設定値は持たず、いまの状態を受け取って変更を
 * 呼び出し元へ返す。URL に載せるか browser に残すかは feature が決める。
 *
 * データの取得、並べ替え、絞り込み、業務型は持たない。
 *
 * 画面幅による列の出し分けはこの menu と別物である。menu は利用者の選択、画面幅は既定の出し分け
 * であり、狭い画面で隠れている列は menu で表示にしても現れない。列の優先度は
 * `TABLE_COLUMN_PRIORITY_CLASS` を列の cell へ適用して表す。
 *
 * @param props.columns - 表示を切り替えられる列。
 * @param props.density - いまの表示密度。
 *
 * @see Storybook `Container/TableViewOptions`
 */
export function TableViewOptions({
  columns,
  onColumnVisibilityChange,
  density,
  onDensityChange,
  label = "表示設定",
}: TableViewOptionsProps) {
  // Radix は選ばれた値を string で返す。二値しか出さないので、片方かそれ以外かで畳む。
  const changeDensity = useCallback(
    (value: string) =>
      onDensityChange(
        value === TABLE_DENSITY.COMPACT ? TABLE_DENSITY.COMPACT : TABLE_DENSITY.COMFORTABLE,
      ),
    [onDensityChange],
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button data-slot="table-view-options-trigger" size="sm" type="button" variant="outline">
          <SlidersIcon aria-hidden="true" />
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>表示する列</DropdownMenuLabel>
        {columns.map((column) => (
          <ColumnVisibilityItem
            column={column}
            key={column.id}
            onColumnVisibilityChange={onColumnVisibilityChange}
          />
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuLabel>表示密度</DropdownMenuLabel>
        <DropdownMenuRadioGroup onValueChange={changeDensity} value={density}>
          <DropdownMenuRadioItem value={TABLE_DENSITY.COMFORTABLE}>ゆったり</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value={TABLE_DENSITY.COMPACT}>詰めて表示</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** 列 1 つの表示切り替え。隠せない列は操作させない。 */
function ColumnVisibilityItem({
  column,
  onColumnVisibilityChange,
}: {
  column: TableColumnOption;
  onColumnVisibilityChange: (columnId: string, visible: boolean) => void;
}) {
  const change = useCallback(
    (visible: boolean) => onColumnVisibilityChange(column.id, visible),
    [column.id, onColumnVisibilityChange],
  );

  return (
    <DropdownMenuCheckboxItem
      checked={column.visible}
      disabled={column.locked}
      onCheckedChange={change}
    >
      {column.label}
    </DropdownMenuCheckboxItem>
  );
}
