import type { ReactNode } from "react";

import { FilterBar, FilterBarControls } from "@/components/patterns/filter-bar/filter-bar";
import { withScreenSpan } from "@/observability/render-span";
import type { UserScope } from "./query";
import { UserScopeSelect } from "./ui/scope-select/scope-select";

/** `AdminUserListView` の props。 */
export type AdminUserListViewProps = {
  /** いま効いている範囲。 */
  scope: UserScope;
  /** 一覧本体。取得の仕方で差し替えられるよう外から受け取る。 */
  children: ReactNode;
};

/**
 * 取得を持たず、絞り込みの器と一覧の置き場所だけを組む管理側の利用者一覧。
 *
 * @remarks
 * 一覧本体は `children` として受け取り、取り直す範囲は [`AdminUserResults`](./results.tsx) が
 * 持ちます。
 *
 * 絞り込みを `FilterBar` にまとめます。landmark になるため、支援技術から絞り込みへ直接移動
 * できます。
 *
 * **効いている条件の chip を置きません。** 絞り込みが 1 つしかなく、その欄は幅によらず常に
 * 見えているためです。欄に出ている値と chip が同じことを言います（商品一覧は狭い段で欄が
 * overlay へ入るので、そちらには要ります）。
 */
export const AdminUserListView = withScreenSpan(
  "features/admin/users/view",
  ({ children, scope }: AdminUserListViewProps) => {
    return (
      <div className="space-y-6">
        <FilterBar label="利用者の絞り込み">
          <FilterBarControls>
            <UserScopeSelect value={scope} />
          </FilterBarControls>
        </FilterBar>
        {children}
      </div>
    );
  },
);
