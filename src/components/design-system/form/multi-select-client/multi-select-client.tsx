"use client";

import { type ChangeEvent, useCallback, useId, useState } from "react";

import { cn } from "@/components/cn";
import { ChevronsUpDownIcon } from "@/components/icon";

import { Button } from "../../action/button/button";
import { Popover, PopoverContent, PopoverTrigger } from "../../overlay/popover/popover";
import { CheckboxNative } from "../checkbox-native/checkbox-native";

/** {@link MultiSelectClient} が並べる候補 1 件。 */
export type MultiSelectClientOption = {
  /** form へ送信する値。 */
  value: string;
  /** 画面へ表示する文言。 */
  label: string;
  /** 選べない候補か。 */
  disabled?: boolean;
};

/** {@link MultiSelectClient} の props。 */
export type MultiSelectClientProps = {
  /** form へ送信するフィールド名。選ばれた数だけ同じ名前で繰り返し送る。 */
  name: string;
  /** 並べる候補。 */
  options: readonly MultiSelectClientOption[];
  /** controlled value。 */
  value?: readonly string[];
  /** uncontrolled の初期値。 */
  defaultValue?: readonly string[];
  /** 選択が変わったときの通知。候補の並び順で渡す。 */
  onValueChange?: (values: readonly string[]) => void;
  /** 1 つも選ばれていないときに trigger へ表示する文言。 */
  placeholder?: string;
  /**
   * 2 件以上選ばれたときの要約を組む。
   *
   * @remarks
   * 省略すると「<先頭の文言> 他 N 件」になる。単位や語順を変えたい場合に渡す。
   */
  formatSummary?: (labels: readonly string[]) => string;
  /** trigger のアクセシブルな名前。`aria-labelledby` を渡す場合は不要。 */
  "aria-label"?: string;
  /** 名前を外の要素から参照する場合の id。 */
  "aria-labelledby"?: string;
  /** 入力を無効にするか。 */
  disabled?: boolean;
  /** trigger へ追加する class。 */
  className?: string;
};

function defaultSummary(labels: readonly string[]): string {
  return `${labels[0]} 他 ${labels.length - 1} 件`;
}

/**
 * 1 つ入り切りした後の選択を組み直す。
 *
 * @remarks
 * **候補の並び順で返します。** 押した順に積むと、同じ組み合わせでも並びが変わり、値を URL へ
 * 載せる呼び出し元では同じ条件が別のリンクとして見えます。
 */
export function toToggledValues(
  options: readonly MultiSelectClientOption[],
  current: readonly string[],
  toggled: string,
  checked: boolean,
): readonly string[] {
  return options
    .map((option) => option.value)
    .filter((candidate) => (candidate === toggled ? checked : current.includes(candidate)));
}

/** 選ばれている文言を、trigger に出す 1 行へ畳む。 */
export function toSummary(
  labels: readonly string[],
  placeholder: string,
  format: (labels: readonly string[]) => string,
): string {
  if (labels.length === 0) return placeholder;

  return labels.length === 1 ? labels[0] : format(labels);
}

/**
 * 候補を畳んだまま複数選ぶ client island。
 *
 * @remarks
 * trigger を押すと候補が overlay で開き、その中の checkbox で選ぶ。**選択は即座に反映され、
 * 確定の操作を持たない。** 確定を待たせるかどうかは呼び出し元が決めるものなので、この部品は
 * 変更を `onValueChange` で通知するだけにしてある。
 *
 * **選ぶのは複数を同時に効かせる場合に限る**（使い分けは `README.md`「選ぶ基準」）。
 * 絞り込みは持たないため、候補が画面に収まらないほど多い用途には向かない。
 *
 * **trigger の名前は「項目名 + 選択の要約」になる。** どちらの経路でも、項目名の要素と trigger
 * 自身の両方を指す `aria-labelledby` として組む。`aria-label` を属性のまま置くと button の内容を
 * **上書きして要約が読み上げから消え**、項目名を button の中へ入れるだけだと要素の間に区切りが
 * 入らず語が繋がって読まれる。どちらも渡さないと overlay に名前が付かず、a11y 自動検査に違反する。
 *
 * 値の運び方・`role="listbox"` を与えない理由・必須指定を持たない理由・hydration の要否は
 * `README.md`「責務境界」。
 *
 * @example
 * ```tsx
 * <span id="tags-label">タグ</span>
 * <MultiSelectClient
 *   aria-labelledby="tags-label"
 *   name="tags"
 *   options={[
 *     { value: "1", label: "下書き" },
 *     { value: "2", label: "公開" },
 *   ]}
 *   onValueChange={(values) => console.log(values)}
 * />
 * ```
 *
 * @param props - 下記の表示用 props。native 属性は透過しない。
 * @param props.name - 送信するフィールド名。選ばれた数だけ繰り返す。
 * @param props.options - 並べる候補。並び順がそのまま表示順になる。
 * @param props.formatSummary - 2 件以上選ばれたときの要約。省略時は「<先頭> 他 N 件」。
 * @see Storybook `Form/MultiSelectClient`
 */
export function MultiSelectClient({
  name,
  options,
  value,
  defaultValue,
  onValueChange,
  placeholder = "すべて",
  formatSummary = defaultSummary,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  disabled = false,
  className,
}: MultiSelectClientProps) {
  const triggerId = useId();
  const ownLabelId = useId();
  const optionIdPrefix = useId();
  // 名前は常に「項目名 + 要約」の 2 要素を指す形で組む。属性の値として渡すと要素の間に
  // 区切りが入らず、実装によって語が繋がって読まれる。
  const nameSourceId = ariaLabelledBy ?? (ariaLabel === undefined ? undefined : ownLabelId);
  const [internalValues, setInternalValues] = useState<readonly string[]>(defaultValue ?? []);
  const currentValues = value ?? internalValues;
  const selectedLabels = options
    .filter((option) => currentValues.includes(option.value))
    .map((option) => option.label);

  const toggle = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const { value: toggled, checked } = event.currentTarget;
      const next = toToggledValues(options, currentValues, toggled, checked);

      if (value === undefined) setInternalValues(next);
      onValueChange?.(next);
    },
    [currentValues, onValueChange, options, value],
  );

  const summary = toSummary(selectedLabels, placeholder, formatSummary);

  return (
    <div className="flex w-full flex-col gap-2">
      {ariaLabelledBy === undefined && ariaLabel !== undefined ? (
        <span className="sr-only" id={ownLabelId}>
          {ariaLabel}
        </span>
      ) : null}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            aria-labelledby={
              nameSourceId === undefined ? undefined : `${nameSourceId} ${triggerId}`
            }
            className={cn("w-full justify-between font-normal", className)}
            disabled={disabled}
            id={triggerId}
            type="button"
            variant="outline"
          >
            {/* 要約は器の幅で切る。折り返すと trigger の高さが選択の件数で変わり、隣に
                並ぶ入力欄と行の高さが揃わなくなる。 */}
            <span
              className={cn(
                "min-w-0 truncate",
                selectedLabels.length === 0 && "text-muted-foreground",
              )}
            >
              {summary}
            </span>
            <ChevronsUpDownIcon aria-hidden="true" className="size-4 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          className="w-(--radix-popover-trigger-width) p-1"
        >
          <ul>
            {options.map((option, index) => {
              const optionId = `${optionIdPrefix}-${index}`;

              return (
                <li key={option.value}>
                  {/* 入れ子と htmlFor の両方を持たせる。面ごと押せるのは入れ子、
                      控えの関連付けが htmlFor で、静的解析が見るのは後者。 */}
                  <label
                    className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent has-disabled:cursor-not-allowed has-disabled:opacity-50"
                    htmlFor={optionId}
                  >
                    <CheckboxNative
                      checked={currentValues.includes(option.value)}
                      disabled={option.disabled}
                      id={optionId}
                      onChange={toggle}
                      value={option.value}
                    />
                    {option.label}
                  </label>
                </li>
              );
            })}
          </ul>
        </PopoverContent>
      </Popover>
      {currentValues.map((selected) => (
        <input key={selected} name={name} type="hidden" value={selected} />
      ))}
    </div>
  );
}
