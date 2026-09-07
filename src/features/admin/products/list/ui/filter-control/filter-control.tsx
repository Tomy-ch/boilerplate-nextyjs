"use client";

import { useId } from "react";

import { cn } from "@/components/cn";
import { Label } from "@/components/design-system/form/label/label";
import { MultiSelectClient } from "@/components/design-system/form/multi-select-client/multi-select-client";

import type { AdminProductFilterOption } from "../../filter-option";

/** `AdminProductFilterControl` の props。 */
export type AdminProductFilterControlProps = {
  /** 何で絞り込む欄かを示す文言。 */
  label: string;
  /** 選べる候補。「すべて」は候補ではなく、何も選ばれていない状態が表す。 */
  options: readonly AdminProductFilterOption[];
  /** いま選ばれている値。空なら絞り込まない。 */
  value: readonly string[];
  /** 選び直されたときに呼ばれる。反映するか下書きに留めるかは呼び出し元が決める。 */
  onSelect: (values: readonly string[]) => void;
  /** 外側の並び方を決める class 名。 */
  className?: string;
};

/**
 * 絞り込みの選択欄。
 *
 * @remarks
 * 選ばれた値をどう扱うかは持ちません。**同じ欄が、選んだ時点で反映する場所と、まとめて確定する
 * overlay の中の 2 か所に出る**ためです。
 *
 * **複数を同時に効かせられます。** 候補は overlay の中の checkbox で、何も選ばれていない状態が
 * 「すべて」です。「すべて」を候補として置くと、それと具体的な値を同時に選べる形になります。
 *
 * `MultiSelectClient` は hydration を要します。native の `select` では複数選択の操作が
 * 実用に耐えず、候補ごとの入り切りを見せられません
 * （`components/design-system/form/multi-select-client`）。
 */
export function AdminProductFilterControl({
  label,
  options,
  value,
  onSelect,
  className,
}: AdminProductFilterControlProps) {
  const labelId = useId();

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Label className="shrink-0 text-muted-foreground" id={labelId}>
        {label}
      </Label>
      <MultiSelectClient
        aria-labelledby={labelId}
        className="h-9 w-52"
        name={label}
        onValueChange={onSelect}
        options={options}
        value={value}
      />
    </div>
  );
}
