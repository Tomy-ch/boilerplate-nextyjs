"use client";

import { useRouter } from "next/navigation";
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

import type { AdminProductFilterOption } from "../../filter-option";
import { type AdminProductListConditions, toConditionHref } from "../../query";
import { AdminProductFilterControl } from "../filter-control/filter-control";

/** `AdminProductFilterSheet` の props。 */
export type AdminProductFilterSheetProps = {
  /** いま効いている条件。 */
  conditions: AdminProductListConditions;
  /** 選べる分類。「すべて」は含まない。 */
  categoryOptions: readonly AdminProductFilterOption[];
  /** 選べる状態。「すべて」は含まない。 */
  statusOptions: readonly AdminProductFilterOption[];
};

/** いま効いている条件の数。選ばれた値 1 つを 1 件と数える。 */
function countActive(conditions: AdminProductListConditions): number {
  return conditions.categoryCodes.length + conditions.statusCodes.length;
}

/**
 * 表を畳めない幅での絞り込み。overlay の中で条件を組み、まとめて確定する。
 *
 * @remarks
 * **条件を組んでいる間、表は overlay の裏に隠れます。** 常に見えている幅と違って選んだ結果が
 * 見えないので、選んだ時点では反映せず、確定の操作を overlay の下端へ置きます。
 *
 * **開くたびに、いま効いている条件から組み直します。** 下書きを持ち越すのは同じ overlay を
 * 開いたままにしているあいだだけで、閉じれば手元には何も残りません。閉じている間は条件が
 * 画面のどこにも見えないため、前に開いたときの選びかけを覚えていると、次に開いた人には
 * それが効いている条件に見えます。
 *
 * 開く操作を画面下端に固定するのは、表を読み進めた先でも絞り込みへ戻れるようにするためです。
 * 検索語をここへ入れないのは、入力欄が幅によらず画面の上に出ているためで、同じ条件を 2 か所から
 * 確定できる形にしません。
 *
 * @see Storybook `Features/Admin/Products/List/FilterSheet`
 */
export function AdminProductFilterSheet({
  conditions,
  categoryOptions,
  statusOptions,
}: AdminProductFilterSheetProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(conditions);

  const show = useCallback(
    (next: boolean) => {
      setOpen(next);

      if (next) {
        setDraft(conditions);
      }
    },
    [conditions],
  );

  const selectCategory = useCallback((categoryCodes: readonly string[]) => {
    setDraft((current) => ({ ...current, categoryCodes }));
  }, []);

  const selectStatus = useCallback((statusCodes: readonly string[]) => {
    setDraft((current) => ({ ...current, statusCodes }));
  }, []);

  const confirm = useCallback(() => {
    setOpen(false);
    router.push(toConditionHref(draft));
  }, [draft, router]);

  const clear = useCallback(() => {
    setDraft((current) => ({ ...current, categoryCodes: [], statusCodes: [] }));
  }, []);

  return (
    <Sheet onOpenChange={show} open={open}>
      <ActionBar position={ACTION_BAR_POSITION.FIXED}>
        <SheetTrigger asChild>
          <FilterBarTrigger className="w-full" count={countActive(conditions)} />
        </SheetTrigger>
      </ActionBar>
      <SheetContent className="flex flex-col" side="bottom">
        <SheetHeader>
          <SheetTitle>絞り込み</SheetTitle>
          <SheetDescription>条件を選んでから、下の操作で一覧に反映します。</SheetDescription>
        </SheetHeader>
        {/* 上下の余白は focus outline のはみ出し分（offset 2px + 線 2px）。送り領域は余白ゼロだと
            その 4px を切り落とす。 */}
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-1">
          <AdminProductFilterControl
            className="justify-between"
            label="分類"
            onSelect={selectCategory}
            options={categoryOptions}
            value={draft.categoryCodes}
          />
          <AdminProductFilterControl
            className="justify-between"
            label="状態"
            onSelect={selectStatus}
            options={statusOptions}
            value={draft.statusCodes}
          />
        </div>
        <SheetFooter>
          <Button onClick={confirm} type="button">
            この条件で見る
          </Button>
          <Button onClick={clear} type="button" variant="outline">
            条件をすべて外す
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
