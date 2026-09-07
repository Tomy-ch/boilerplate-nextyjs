"use client";

import { type SyntheticEvent, useCallback, useId } from "react";

import { Button } from "@/components/design-system/action/button/button";

import { usePurchaseFilterDraft } from "../../filter-draft";
import { describeMissing } from "../../period-draft";
import { PurchasePeriodFields } from "../period-fields/period-fields";

/**
 * 帯の中に常設する期間の絞り込み。
 *
 * @remarks
 * 一覧が隣に見えている幅で使います。入力欄は {@link PurchasePeriodFields} が持ち、下書きは画面で
 * 1 つのものを読みます（`filter-draft.tsx`）。
 *
 * **確定の操作を置きます。** 商品一覧の脇の絞り込みが選んだ時点で反映するのは、1 回の操作で条件が
 * 1 つ決まるからです。ここは違い、期間の指定は開始日と終了日の 2 つが揃って初めて条件になります。
 *
 * **確定を入力欄の下へ段で分けます。** 同じ行に並べると、区分ごとに入力欄の数が違うぶん確定が
 * 左右に動き、区分を選んでから確定を押すまでの間に狙いが外れます。段を分ければ左端で揃うので、
 * どの区分でも同じ場所にあります。入力欄の行そのものは区分によらず同じ高さです
 * （{@link PurchasePeriodFields}）。
 *
 * 足りていない間は確定を押せなくし、何が足りないかを**確定の隣**に出します。押せてしまうと、
 * 押した結果が一覧の消えた画面（契約は 400 を返す）になり、原因が利用者から見えません。下へ
 * 継ぎ足すと、文言が出入りするたびに一覧の先頭が上下します。
 *
 * **反映を待っている間も入力欄を押せるままにします。** 待っている間を塞ぐと、条件を続けて選ぶ
 * 操作がそのたびに止まります。代わりに支援技術へは `aria-busy` で伝えます。
 *
 * **効いている期間は入力欄そのものが示します。** 条件が 1 つしか無いので、別に chip を並べても
 * 同じことを 2 度言うだけです。確定していない下書きが入っている間だけ両者はずれますが、それは
 * 「いま何に変えようとしているか」であって、隣に古い条件を置いても混乱が増えます。
 *
 * 名前を持たせて landmark にします。支援技術から絞り込みへ直接移動できます。
 *
 * 出す幅の判断は持ちません。この帯を出す下限は置く側が担います。
 */
export function PurchasePeriodBar() {
  const { draft, applied, pending, change, apply } = usePurchaseFilterDraft();
  const hintId = useId();
  const missing = describeMissing(draft);

  const submit = useCallback(
    (event: SyntheticEvent<HTMLFormElement>) => {
      event.preventDefault();
      apply();
    },
    [apply],
  );

  return (
    <form
      aria-busy={pending}
      aria-label="購入履歴の絞り込み"
      className="flex flex-col gap-3"
      onSubmit={submit}
    >
      <PurchasePeriodFields draft={draft} onChange={change} />
      <div className="flex flex-wrap items-center gap-3">
        <Button
          aria-describedby={missing === null ? undefined : hintId}
          disabled={applied === null}
          type="submit"
        >
          絞り込む
        </Button>
        {missing === null ? null : (
          <p className="text-muted-foreground text-sm" id={hintId}>
            {missing}
          </p>
        )}
      </div>
    </form>
  );
}
