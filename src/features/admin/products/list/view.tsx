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
import { ADMIN_PRODUCT_LIST_PATH, ADMIN_PRODUCT_NEW_PATH } from "../../paths";
import { toAdminActiveFilters } from "./active-filters";
import type { AdminProductFilterOption } from "./filter-option";
import type { AdminProductListConditions } from "./query";
import { AdminProductFilterSelect } from "./ui/filter-select/filter-select";
import { AdminProductFilterSheet } from "./ui/filter-sheet/filter-sheet";
import { AdminProductKeywordField } from "./ui/keyword-field/keyword-field";

/** `AdminProductListView` の props。 */
export type AdminProductListViewProps = {
  /** いま効いている絞り込み。 */
  conditions: AdminProductListConditions;
  /** 選べる分類。「すべて」は含まない。 */
  categoryOptions: readonly AdminProductFilterOption[];
  /** 選べる状態。「すべて」は含まない。 */
  statusOptions: readonly AdminProductFilterOption[];
  /** 一覧本体。取得の仕方で差し替えられるよう外から受け取る。 */
  children: ReactNode;
};

/**
 * 管理側の商品一覧の画面。
 *
 * @remarks
 * 取得を持ちません。一覧本体は `children` として受け取り、取り直す範囲は
 * `AdminProductListResults` が持ちます。
 *
 * 絞り込みを `FilterBar` にまとめます。landmark になるため、支援技術から絞り込みへ直接移動
 * できます。
 *
 * **効いている条件を chip で出します。** 狭い段では分類と状態の入力欄が overlay の中にあり、
 * 閉じている間は何で絞り込まれているかが画面から読めません。検索語も、入力欄に文字が残って
 * いるだけでは打ちかけと区別できません。chip は 1 つずつ外せるため、絞り直すのに overlay を
 * 開き直す必要もありません。
 *
 * すべてを解除する操作は右端に留めます。chip の後ろへ流すと、条件が増えて折り返すたびに操作の
 * 位置が動き、同じ場所を狙って押せません。1 件しか効いていないときは出しません。その chip の
 * 解除と行き先が同じになるためです。
 *
 * **選択欄を 2 つ置き、CSS の段で出し分けます。** 広い段では表の上に常設し、狭い段では下端の
 * 操作から overlay で開きます。位置が動く出し分けを JS の幅判定で行うと、サーバでは判定できない
 * ため hydration の前後で配置が動きます。段の境界をこの画面では決めません。
 *
 * **検索欄は幅によらず同じ場所に置きます。** 打鍵で確定しない点はどちらの段でも変わらず、
 * overlay の中へ入れると、同じ条件を 2 か所から確定できる形になります。
 *
 * 作成への導線は絞り込みの外の右端へ置きます。一覧を絞る操作と一覧を増やす操作は対象が違い、
 * 同じ landmark に入れると「絞り込み」の中に絞り込みでない操作が混ざります。
 */
export const AdminProductListView = withScreenSpan(
  "features/admin/products/list/view",
  ({ conditions, categoryOptions, statusOptions, children }: AdminProductListViewProps) => {
    const activeFilters = toAdminActiveFilters(conditions, categoryOptions, statusOptions);

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <FilterBar className="min-w-0 flex-1" label="商品の検索と絞り込み">
            <FilterBarControls>
              <AdminProductKeywordField conditions={conditions} />
              {/* 狭い段の同じ条件は下端の操作から overlay で開く。両方を同時には出さない。 */}
              <div className="hidden flex-wrap items-center gap-2 md:flex">
                <AdminProductFilterSelect
                  conditions={conditions}
                  field="categoryCodes"
                  label="分類"
                  options={categoryOptions}
                />
                <AdminProductFilterSelect
                  conditions={conditions}
                  field="statusCodes"
                  label="状態"
                  options={statusOptions}
                />
              </div>
            </FilterBarControls>
            {activeFilters.length === 0 ? null : (
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
                {activeFilters.length > 1 ? (
                  <Button asChild className="shrink-0" size="sm" variant="ghost">
                    <Link href={ADMIN_PRODUCT_LIST_PATH}>条件をすべて解除</Link>
                  </Button>
                ) : null}
              </div>
            )}
          </FilterBar>
          <Button asChild className="shrink-0">
            <Link href={ADMIN_PRODUCT_NEW_PATH}>商品を作成</Link>
          </Button>
        </div>
        {children}
        <div className="md:hidden">
          <AdminProductFilterSheet
            categoryOptions={categoryOptions}
            conditions={conditions}
            statusOptions={statusOptions}
          />
        </div>
      </div>
    );
  },
);
