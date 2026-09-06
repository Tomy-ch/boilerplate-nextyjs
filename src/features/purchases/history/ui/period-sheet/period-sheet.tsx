"use client";

import { useCallback, useState } from "react";

import { Button } from "@/components/design-system/action/button/button";
import { BUTTON_VARIANT } from "@/components/design-system/action/button/button.definition";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/design-system/overlay/sheet/sheet";
import { FilterIcon } from "@/components/icon";
import { ActionBar } from "@/components/patterns/action-bar/action-bar";
import { ACTION_BAR_POSITION } from "@/components/patterns/action-bar/action-bar.definition";

import { usePurchaseFilterDraft } from "../../filter-draft";
import {
  ALL_PERIOD,
  describePeriod,
  type PeriodSelection,
  toPurchaseHistoryHref,
} from "../../period";
import { describeMissing } from "../../period-draft";
import { PurchasePeriodFields } from "../period-fields/period-fields";

/** 期間を持たない一覧の URL。全期間へ戻したときの行き先。 */
const ALL_PERIOD_HREF = toPurchaseHistoryHref(ALL_PERIOD);

/** `PurchasePeriodSheet` の props。 */
export type PurchasePeriodSheetProps = {
  /** いま一覧に効いている期間。開く操作の文言に出すために受け取る。 */
  period: PeriodSelection;
};

/**
 * 帯を常設できない幅での期間の絞り込み。overlay の中で期間を組み、まとめて確定する。
 *
 * @remarks
 * **開く操作を画面下端に固定します。** 一覧を読み進めた先でも絞り込みへ戻れるようにするためで、
 * 上端に置くと、古い購入を探して読み進めるほど条件を変える手段が遠ざかります
 * （[0051](../../../../../../docs/adr/0051-styling-system.md) §2）。
 *
 * **期間を組んでいる間、一覧は overlay の裏に隠れます。** 選んだ結果が見えないので、確定の操作を
 * overlay の下端へ置きます。
 *
 * **確定では閉じません。閉じるのは、確定した期間が一覧へ届いたときです。** 閉じる操作と遷移を
 * 同じ操作で撃つと、overlay が積んだ履歴を戻す動きが、まだ URL へ届いていない遷移を打ち消します
 * （[use-overlay-history](../../../../../components/design-system/overlay/use-overlay-history.ts)）。
 * 待っているあいだ overlay は開いたままなので、`aria-busy` で支援技術へ伝えます。
 *
 * **確定も全期間へ戻す操作も、履歴を積まずに差し替えます。** 開いた時点で overlay が 1 つ積んで
 * いるので、そのうえで積むと戻る操作が 1 度空振りします。
 *
 * **開くときに下書きを捨てません。** 下書きは画面で 1 つで、一覧に効いている期間が変われば
 * そちらへ揃います。ここで戻すと、閉じる前に組みかけていた期間が消えます。
 *
 * **効いている期間を開く操作の文言そのものにします。** 閉じているあいだ入力欄は見えないので、
 * ここが唯一の表示になります。件数の印だけでは「何かで絞られている」までしか伝わらず、
 * 何で絞られているかを見るために開くことになります。
 */
export function PurchasePeriodSheet({ period }: PurchasePeriodSheetProps) {
  const [open, setOpen] = useState(false);
  const { draft, applied: draftPeriod, pending, change, applyInPlace, reset } =
    usePurchaseFilterDraft();
  const applied = describePeriod(period);
  const missing = describeMissing(draft);
  const appliedHref = toPurchaseHistoryHref(period);
  const draftHref = draftPeriod === null ? null : toPurchaseHistoryHref(draftPeriod);
  const [knownHref, setKnownHref] = useState(appliedHref);

  // 一覧に効いている期間が変わったら閉じる。確定で閉じるのではなく、確定した結果が届いたことで
  // 閉じる。
  if (knownHref !== appliedHref) {
    setKnownHref(appliedHref);
    setOpen(false);
  }

  const confirm = useCallback(() => {
    // 期間が変わらないなら届くものが無いので、その場で閉じる。
    if (draftHref === appliedHref) {
      setOpen(false);

      return;
    }

    applyInPlace();
  }, [appliedHref, applyInPlace, draftHref]);

  const clear = useCallback(() => {
    reset();

    // 既に全期間なら URL が変わらず、届く変化が無いので、その場で閉じる。
    if (appliedHref === ALL_PERIOD_HREF) {
      setOpen(false);
    }
  }, [appliedHref, reset]);

  return (
    <Sheet onOpenChange={setOpen} open={open}>
      <ActionBar position={ACTION_BAR_POSITION.FIXED}>
        <SheetTrigger asChild>
          <Button className="w-full" variant={BUTTON_VARIANT.OUTLINE}>
            <FilterIcon aria-hidden="true" />
            {applied === null ? "期間で絞り込む" : `期間: ${applied}`}
          </Button>
        </SheetTrigger>
      </ActionBar>
      <SheetContent aria-busy={pending} className="flex flex-col" side="bottom">
        <SheetHeader>
          <SheetTitle>期間で絞り込む</SheetTitle>
          <SheetDescription>期間を選んでから、下の操作で一覧に反映します。</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-4">
          <PurchasePeriodFields draft={draft} onChange={change} />
          {missing === null ? null : (
            <p className="pt-3 text-muted-foreground text-sm">{missing}</p>
          )}
        </div>
        <SheetFooter>
          <Button disabled={draftPeriod === null} onClick={confirm} type="button">
            この期間で見る
          </Button>
          <Button
            disabled={period.kind === "all" && draft.kind === "all"}
            onClick={clear}
            type="button"
            variant={BUTTON_VARIANT.OUTLINE}
          >
            全期間に戻す
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
