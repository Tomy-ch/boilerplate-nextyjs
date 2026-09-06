"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";

import type { AdminProductFilterOption } from "../../filter-option";
import { type AdminProductListConditions, toConditionHref } from "../../query";
import { AdminProductFilterControl } from "../filter-control/filter-control";

/** 差し替えられる絞り込みの項目。 */
type AdminProductFilterField = "categoryCodes" | "statusCodes";

/** `AdminProductFilterSelect` の props。 */
export type AdminProductFilterSelectProps = {
  /** どの条件を差し替えるか。 */
  field: AdminProductFilterField;
  /** 何で絞り込む欄かを示す文言。 */
  label: string;
  /** 選べる候補。「すべて」は含めない。 */
  options: readonly AdminProductFilterOption[];
  /** いま効いている条件。選んだ先の URL を組むのに要る。 */
  conditions: AdminProductListConditions;
};

/**
 * 選んだ時点で反映する絞り込み。脇に畳まず常に見えている幅で使う。
 *
 * @remarks
 * **1 つ入り切りするたびに反映します。** 選んだ結果が同じ画面にそのまま出るため、確定を待たせる
 * 理由がありません。複数選ぶときは往復が増えますが、1 つ選ぶたびに件数が変わるのが見えるほうが、
 * 組み終えるまで結果が判らないより速く目的へ着きます。overlay の中では結果が隠れるので、そちらは
 * まとめて確定します。
 *
 * 選び直すと読み進めた位置を捨てます。前の条件の途中の位置は、新しい条件では別の場所を指します。
 *
 * @see Storybook `Features/Admin/Products/List/FilterSelect`
 */
export function AdminProductFilterSelect({
  field,
  label,
  options,
  conditions,
}: AdminProductFilterSelectProps) {
  const router = useRouter();
  const select = useCallback(
    (values: readonly string[]) => {
      router.push(toConditionHref({ ...conditions, [field]: values }));
    },
    [conditions, field, router],
  );

  return (
    <AdminProductFilterControl
      label={label}
      onSelect={select}
      options={options}
      value={conditions[field]}
    />
  );
}
