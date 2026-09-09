"use client";

import { useProductFilterDraft } from "../../filter-draft";
import type { FilterOption } from "../../query";
import { ProductFilterFields } from "../filter-fields/filter-fields";

/** `ProductFilterSidebar` の props。 */
export type ProductFilterSidebarProps = {
  /** 選べる分類。 */
  categories: readonly FilterOption[];
  /** 一度に選べる分類の数。 */
  categoryLimit: number;
};

/**
 * 脇に常設する絞り込み。選んだ時点で一覧へ反映する。
 *
 * @remarks
 * 下書きをつなぐだけです。入力欄は {@link ProductFilterFields} が持ちます。下書きは画面で 1 つの
 * ものを読みます（`filter-draft.tsx`）。キーワードの入力欄と別々に持つと、片方で確定したときに
 * もう片方の入力途中が捨てられます。
 *
 * **確定の操作を置きません。** この幅では一覧が隣に見えているので、選んだ結果はその場に出ます。
 * 確定を挟むと、結果を見るために毎回もう 1 回押させることになります。overlay の中は一覧が
 * 見えないぶん確定を置きますが、その使い分けは
 * [画面要件](../../../../../../docs/spec/route/shop/products/page.screen.md) が持ちます。
 *
 * **反映を待っている間も入力欄を押せるままにします。** 待っている間を塞ぐと、条件を続けて選ぶ
 * 操作がそのたびに止まります。代わりに支援技術へは `aria-busy` で伝えます。
 *
 * 出す幅の判断は持ちません。脇の領域を出す下限は `docs/rules.md`「レイアウトと帯」の「脇に常設する
 * 領域は `lg` 以上でだけ出す」が決めており、置く側が担います。
 * landmark も持ちません。この画面には検索と条件をまとめた `FilterBar` が既にあり、入れ子にすると
 * 同じ目的の landmark が 2 つ並びます。脇の領域そのものの名前は置く側が `aside` に与えます。
 */
export function ProductFilterSidebar({ categories, categoryLimit }: ProductFilterSidebarProps) {
  "use memo";

  const { draft, pending, commit } = useProductFilterDraft();

  return (
    <div aria-busy={pending}>
      <ProductFilterFields
        categories={categories}
        categoryLimit={categoryLimit}
        draft={draft}
        onChange={commit}
      />
    </div>
  );
}
