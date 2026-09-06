"use client";

import { useCallback, useState } from "react";

import { CalendarIcon } from "@/components/icon";

import { Button } from "../../action/button/button";
import { Popover, PopoverContent, PopoverTrigger } from "../../overlay/popover/popover";
import { Calendar } from "../calendar/calendar";

function parseDate(value: string | undefined) {
  if (value === undefined || value === "") return undefined;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function formatDate(date: Date | undefined) {
  if (date === undefined) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Calendar と Popover を組み合わせた client-side の日付入力。 */
export type DatePickerClientProps = {
  /** form へ送信するフィールド名。 */
  name: string;
  /** 初期値または controlled value の ISO 日付文字列。 */
  value?: string;
  /** uncontrolled の初期日付。 */
  defaultValue?: string;
  /** 日付が選択されたときの通知。 */
  onValueChange?: (value: string) => void;
  /** 入力を無効にするか。 */
  disabled?: boolean;
  /** 必須入力か。 */
  required?: boolean;
};

/**
 * 日付をカレンダー popup から選び、native form の値として送信する client island。
 *
 * @remarks
 * range・時刻・タイムゾーン変換は扱わない。単一日付を直接入力できる場合は
 * `Input type="date"` を優先し、calendar 操作が必要な場合だけ使用する。
 *
 * @see Storybook `Form/DatePickerClient`
 */
export function DatePickerClient({
  name,
  value,
  defaultValue,
  onValueChange,
  disabled = false,
  required = false,
}: DatePickerClientProps) {
  const [open, setOpen] = useState(false);
  const [selectedValue, setSelectedValue] = useState(defaultValue ?? "");
  const currentValue = value ?? selectedValue;
  const selectedDate = parseDate(currentValue);

  const handleSelect = useCallback(
    (date: Date | undefined) => {
      const nextValue = formatDate(date);
      if (value === undefined) setSelectedValue(nextValue);
      onValueChange?.(nextValue);
      setOpen(false);
    },
    [onValueChange, value],
  );

  return (
    <div className="flex w-full flex-col gap-2">
      <Popover onOpenChange={setOpen} open={open}>
        <PopoverTrigger asChild>
          <Button
            aria-label="日付を選択"
            className="w-full justify-between"
            disabled={disabled}
            type="button"
            variant="outline"
          >
            {selectedDate === undefined ? "日付を選択" : formatDate(selectedDate)}
            <CalendarIcon aria-hidden="true" className="size-4 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent aria-label="日付の選択" className="w-auto p-0">
          <Calendar
            captionLayout="dropdown"
            classNames={{
              dropdowns:
                "flex h-(--cell-size) w-full flex-row-reverse items-center justify-center gap-1.5",
            }}
            defaultMonth={selectedDate}
            endMonth={new Date(2100, 11, 31)}
            formatters={{
              formatMonthDropdown: (date) => `${date.getMonth() + 1}月`,
              formatYearDropdown: (date) => `${date.getFullYear()}年`,
            }}
            mode="single"
            onSelect={handleSelect}
            selected={selectedDate}
            startMonth={new Date(1900, 0, 1)}
          />
        </PopoverContent>
      </Popover>
      <input name={name} required={required} type="hidden" value={currentValue} />
    </div>
  );
}
