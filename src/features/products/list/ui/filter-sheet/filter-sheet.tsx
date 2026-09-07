"use client";

import { useCallback, useState } from "react";

import { Button } from "@/components/design-system/action/button/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/design-system/overlay/sheet/sheet";
import { ActionBar } from "@/components/patterns/action-bar/action-bar";
import { ACTION_BAR_POSITION } from "@/components/patterns/action-bar/action-bar.definition";
import { FilterBarTrigger } from "@/components/patterns/filter-bar/filter-bar";

import {
  FILTER_KEY,
  type ProductListSelection,
  toProductListHref,
  toSelectedValues,
} from "../../../facade/list-url/list-url";
import { useProductFilterDraft } from "../../filter-draft";
import { PRICE_RANGE_MAX, PRICE_RANGE_MIN, toPriceRange } from "../../price-range";
import type { FilterOption } from "../../query";
import { STOCK_AVAILABILITY, toStockAvailability } from "../../stock-availability";
import { useFilteredCount } from "../../use-filtered-count";
import { ProductFilterFields } from "../filter-fields/filter-fields";

/** `ProductFilterSheet` の props。 */
export type ProductFilterSheetProps = {
  /** 選べる分類。 */
  categories: readonly FilterOption[];
  /** 一度に選べる分類の数。 */
  categoryLimit: number;
  /** いま効いている条件。 */
  selection: ProductListSelection;
};

/** いま効いている条件の数。入力欄 1 つを 1 件と数え、指定なしは数えない。 */
function countActive(selection: ProductListSelection): number {
  const [low, high] = toPriceRange(selection);

  return [
    low !== PRICE_RANGE_MIN || high !== PRICE_RANGE_MAX,
    toSelectedValues(selection, FILTER_KEY.CATEGORY).length > 0,
    toStockAvailability(selection) !== STOCK_AVAILABILITY.ALL,
  ].filter(Boolean).length;
}

/**
 * 脇に領域を持てない幅での絞り込み。overlay の中で条件を組み、まとめて確定する。
 *
 * @remarks
 * **条件を組んでいる間、一覧は overlay の裏に隠れます。** 脇に常設する側と違って選んだ結果が
 * 見えないので、選んだ時点では反映せず、確定の操作を overlay の下端へ置きます。反映を待たずに
 * 結果の大きさが分かるよう、開いている間の該当件数もそこへ出します。
 *
 * **確定では閉じません。閉じるのは、確定した条件が一覧へ届いたときです。** 閉じる操作と遷移を
 * 同じ操作で撃つと、overlay が積んだ履歴を戻す動きが、まだ URL へ届いていない遷移を打ち消します
 * （[use-overlay-history](../../../../../components/design-system/overlay/use-overlay-history.ts)）。
 * 待っているあいだ overlay は開いたままなので、`aria-busy` で支援技術へ伝えます。
 *
 * **確定は履歴を積まずに差し替えます。** 開いた時点で overlay が 1 つ積んでいるので、そのうえで
 * 積むと戻る操作が 1 度空振りします（`applyInPlace`）。
 *
 * **開くときに下書きを捨てません。** 下書きは画面で 1 つで、閉じている間もキーワードの入力欄が
 * その一部を見せています。ここで戻すと、打ち込んだ検索語まで一緒に消えます。一覧に効いている条件が
 * 変われば下書きはそちらへ揃うので、確定した後に古い選択が残ることはありません。
 *
 * 開く操作を画面下端に固定するのは、一覧を読み進めた先でも絞り込みへ戻れるようにするためです
 * （`docs/rules.md`「レイアウトと帯」の「常に届く操作は `lg` 未満で画面下端に固定する」）。
 */
export function ProductFilterSheet({
  categories,
  categoryLimit,
  selection,
}: ProductFilterSheetProps) {
  "use memo";

  const [open, setOpen] = useState(false);
  const { draft, pending, change, clear, applyInPlace } = useProductFilterDraft();
  const { count } = useFilteredCount(draft);
  const appliedHref = toProductListHref(selection);
  const [knownHref, setKnownHref] = useState(appliedHref);

  // 一覧に効いている条件が変わったら閉じる。確定で閉じるのではなく、確定した結果が届いたことで
  // 閉じる。
  if (knownHref !== appliedHref) {
    setKnownHref(appliedHref);
    setOpen(false);
  }

  const confirm = useCallback(() => {
    // 条件が変わらないなら届くものが無いので、その場で閉じる。
    if (toProductListHref(draft) === appliedHref) {
      setOpen(false);

      return;
    }

    applyInPlace();
  }, [appliedHref, applyInPlace, draft]);

  return (
    <Sheet onOpenChange={setOpen} open={open}>
      <ActionBar position={ACTION_BAR_POSITION.FIXED}>
        <SheetTrigger asChild>
          <FilterBarTrigger className="w-full" count={countActive(selection)} />
        </SheetTrigger>
      </ActionBar>
      <SheetContent aria-busy={pending} className="flex flex-col" side="bottom">
        <SheetHeader>
          <SheetTitle>絞り込み</SheetTitle>
          <SheetDescription>条件を選んでから、下の操作で一覧に反映します。</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-4">
          <ProductFilterFields
            categories={categories}
            categoryLimit={categoryLimit}
            draft={draft}
            onChange={change}
          />
        </div>
        <SheetFooter>
          <Button onClick={confirm} type="button">
            {count === undefined ? "この条件で見る" : `この条件で見る（該当件数 ${count} 件）`}
          </Button>
          <Button onClick={clear} type="button" variant="outline">
            条件をすべて外す
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
