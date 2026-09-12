import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "@/components/design-system/action/button/button";
import {
  FilterBar,
  FilterBarActiveFilters,
  FilterBarControls,
  FilterChip,
} from "@/components/patterns/filter-bar/filter-bar";
import { withScreenSpan } from "@/observability/render-span";
import { PRODUCT_LIST_PATH, type ProductListSelection } from "../facade/list-url/list-url";
import { toActiveFilters } from "./active-filters";
import { ProductFilterDraftProvider } from "./filter-draft";
import type { FilterOption } from "./query";
import { ProductFilterSheet } from "./ui/filter-sheet/filter-sheet";
import { ProductFilterSidebar } from "./ui/filter-sidebar/filter-sidebar";
import { ProductKeywordField } from "./ui/keyword-field/keyword-field";
import { ProductSortSelect } from "./ui/sort-select/sort-select";
import {
  ProductStickyAside,
  ProductStickyBar,
  ProductStickyRegion,
} from "./ui/sticky-region/sticky-region";

/** `ProductListView` の props。 */
export type ProductListViewProps = {
  /** 選べる分類。 */
  categories: readonly FilterOption[];
  /** 一度に選べる分類の数。 */
  categoryLimit: number;
  /** 並び替えの選択肢。 */
  sortOptions: readonly FilterOption[];
  /** いま効いている条件。 */
  selection: ProductListSelection;
  /** 一覧本体。取得の仕方で差し替えられるよう外から受け取る。 */
  children: ReactNode;
};

/**
 * 取得を持たず、条件が変わったときに取り直す範囲を区切る商品一覧の器。
 *
 * @remarks
 * 一覧本体を受け取る形にしてあるのは、画面の組み方の確認に取得を必要としないようにするためです。
 * 検索欄・条件の chip・絞り込みの入力欄はこの外側にあり、一覧が取り直されても待機表示に落ちません。
 *
 * 検索・並び替え・効いている条件を `FilterBar` にまとめます。landmark になるため、支援技術から
 * 絞り込みへ直接移動できます。効いている条件を chip で出すのは、脇の領域を持てない幅では入力欄が
 * overlay の中にあり、閉じている間は何で絞り込まれているかが画面から読めないためです。条件が
 * 増えるほどこの差は開きます。
 *
 * すべてを解除する操作は右端に留めます。chip の後ろへ流すと、条件が増えて折り返すたびに操作の
 * 位置が動き、同じ場所を狙って押せません。下端で揃えるのは、chip が複数行になったときに操作だけが
 * 上に浮かないようにするためです。
 *
 * **確定の操作は複数あっても、確定するものは 1 つです。** キーワードの入力欄と絞り込みの入力欄は
 * 画面の別の場所にあり、幅によって後者は脇にも overlay にも現れます。組み立て中の条件を 1 つに
 * 保つ供給でこの部分木を包み、どの操作から確定しても同じ条件が飛ぶようにしてあります。
 *
 * 絞り込みの入力欄を 2 つ置き、CSS の段で出し分けます。位置が動く出し分けを JS の幅判定で行うと、
 * サーバでは判定できないため hydration の前後で配置が動きます。脇に常設できる幅の下限も、脇に
 * 領域を持てない幅で操作を下端へ固定する判断も、`docs/rules.md`「レイアウトと帯」が持ちます
 * （「脇に常設する領域は `lg` 以上でだけ出す」と「常に届く操作は `lg` 未満で画面下端に固定する」）。
 *
 * 並び替えを絞り込みの側へ入れず、幅によらず同じ場所へ置きます。単一選択なので選ぶことが確定と
 * 同じであり、まとめて確定する絞り込みの中に入れると確定の操作が 2 段になります。
 */
export const ProductListView = withScreenSpan(
  "features/products/list/view",
  ({ categories, categoryLimit, sortOptions, selection, children }: ProductListViewProps) => {
    const activeFilters = toActiveFilters(categories, selection);

    return (
      <ProductFilterDraftProvider selection={selection}>
        <ProductStickyRegion>
          <div className="space-y-6">
            <ProductStickyBar>
              <FilterBar label="商品の検索と絞り込み">
                <FilterBarControls className="justify-between">
                  <ProductKeywordField selection={selection} />
                  <ProductSortSelect options={sortOptions} selection={selection} />
                </FilterBarControls>
                <div className="flex items-end justify-between gap-4">
                  <FilterBarActiveFilters className="min-w-0 flex-1">
                    {activeFilters.map((filter) => (
                      <FilterChip
                        key={filter.key}
                        label={filter.label}
                        removeHref={filter.removeHref}
                        value={filter.value}
                      />
                    ))}
                  </FilterBarActiveFilters>
                  {/* 1 件しか効いていないときは、その chip の解除と行き先が同じになる。 */}
                  {activeFilters.length > 1 ? (
                    <Button asChild className="shrink-0" size="sm" variant="ghost">
                      <Link href={PRODUCT_LIST_PATH}>条件をすべて解除</Link>
                    </Button>
                  ) : null}
                </div>
              </FilterBar>
            </ProductStickyBar>
            <div className="flex gap-8">
              <ProductStickyAside>
                <ProductFilterSidebar categories={categories} categoryLimit={categoryLimit} />
              </ProductStickyAside>
              <div className="min-w-0 flex-1">{children}</div>
            </div>
            <div className="lg:hidden">
              <ProductFilterSheet
                categories={categories}
                categoryLimit={categoryLimit}
                selection={selection}
              />
            </div>
          </div>
        </ProductStickyRegion>
      </ProductFilterDraftProvider>
    );
  },
);
