"use client";

import { useCallback, useState } from "react";

import { cn } from "@/components/cn";
import { CheckIcon, ChevronsUpDownIcon } from "@/components/icon";

import { Button } from "../../action/button/button";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "../../overlay/command/command";
import { Popover, PopoverContent, PopoverTrigger } from "../../overlay/popover/popover";

/** {@link ComboboxClient} が並べる候補 1 件。 */
export type ComboboxClientOption = {
  /** form へ送信する値。 */
  value: string;
  /** 画面へ表示し、絞り込みの対象にもなる文言。 */
  label: string;
  /** 選べない候補か。 */
  disabled?: boolean;
};

/** {@link ComboboxClient} の props。 */
export type ComboboxClientProps = {
  /** form へ送信するフィールド名。 */
  name: string;
  /** 並べる候補。 */
  options: ComboboxClientOption[];
  /** controlled value。 */
  value?: string;
  /** uncontrolled の初期値。 */
  defaultValue?: string;
  /** 選択が変わったときの通知。 */
  onValueChange?: (value: string) => void;
  /** 未選択時に trigger へ表示する文言。 */
  placeholder?: string;
  /** 絞り込み入力の placeholder。 */
  searchPlaceholder?: string;
  /** 一致する候補が無いときの文言。 */
  emptyMessage?: string;
  /** trigger のアクセシブルな名前。 */
  "aria-label"?: string;
  /** trigger の名前を外の要素から参照する場合の id。 */
  "aria-labelledby"?: string;
  /** 入力を無効にするか。 */
  disabled?: boolean;
  /** trigger へ追加する class。 */
  className?: string;
};

/**
 * 入力語で候補を絞り込みながら 1 件を選ぶ client island。
 *
 * @remarks
 * `Popover` と `Command` を合成した実装パターンであり、shadcn CLI の単独部品ではない。選択値は
 * hidden input として持つため、native form へそのまま載る。
 *
 * 候補が少なく静的なら `SelectNative` を優先する。この component を選ぶのは、候補が多く**入力で
 * 絞り込む**必要がある場合に限る。絞り込みの必要がないのに使うと、選ぶまでに入力という手数が
 * 増えるだけになる。
 *
 * 候補の取得・並び順・件数の制限は持たない。`options` として渡された配列をそのまま扱い、
 * 絞り込みは `Command` が label に対して行う。サーバ側で検索する必要がある場合は、呼び出し元が
 * `options` を差し替える。
 *
 * hydration が必要で、Server Component からは直接 render できない。
 *
 * **trigger に `role="combobox"` は付けない。** 絞り込み入力そのものが `Command` の中で
 * `role="combobox"` として公開されるため、trigger にも付けると combobox が二重になり、
 * `aria-controls` の関連付けも競合する。trigger は popover を開く button であり、開閉は Radix が
 * `aria-expanded` に反映する。
 *
 * trigger は文言を持たない場合があるため、`aria-label` か `aria-labelledby` で**アクセシブルな
 * 名前を必ず与える**。絞り込み入力の名前は `Command` の `label` として渡している。
 *
 * 絞り込みは label に対して行う。`CommandItem` の `value` は form へ送る値であり表示文言と異なる
 * ため、label を `keywords` として渡して検索対象にしている。
 *
 * **必須指定は持たない。** 値を運ぶ hidden input は constraint validation の対象外であり、
 * `required` を付けても browser は検証しない。必須であることの表示は `Field`、実際の強制は
 * Server Action や server 側の検証で行う。
 *
 * @see Storybook `Form/ComboboxClient`
 */
export function ComboboxClient({
  name,
  options,
  value,
  defaultValue,
  onValueChange,
  placeholder = "選択してください",
  searchPlaceholder = "検索",
  emptyMessage = "該当する候補がありません",
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  disabled = false,
  className,
}: ComboboxClientProps) {
  const [open, setOpen] = useState(false);
  const [selectedValue, setSelectedValue] = useState(defaultValue ?? "");
  const currentValue = value ?? selectedValue;
  const selectedOption = options.find((option) => option.value === currentValue);

  const handleSelect = useCallback(
    (nextValue: string) => {
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
            aria-label={ariaLabel}
            aria-labelledby={ariaLabelledBy}
            className={cn("w-full justify-between font-normal", className)}
            disabled={disabled}
            type="button"
            variant="outline"
          >
            <span className={cn(selectedOption === undefined && "text-muted-foreground")}>
              {selectedOption?.label ?? placeholder}
            </span>
            <ChevronsUpDownIcon aria-hidden="true" className="size-4 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          className="w-(--radix-popover-trigger-width) p-0"
        >
          <Command label={ariaLabel ?? searchPlaceholder}>
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList>
              {options.map((option) => (
                <CommandItem
                  disabled={option.disabled}
                  key={option.value}
                  keywords={[option.label]}
                  onSelect={handleSelect}
                  value={option.value}
                >
                  <span className="flex-1">{option.label}</span>
                  {option.value === currentValue ? (
                    <CheckIcon aria-hidden="true" className="size-4" />
                  ) : null}
                </CommandItem>
              ))}
            </CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
          </Command>
        </PopoverContent>
      </Popover>
      <input name={name} type="hidden" value={currentValue} />
    </div>
  );
}
