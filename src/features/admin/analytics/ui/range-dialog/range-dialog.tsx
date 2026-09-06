"use client";

import { useId } from "react";

import { cn } from "@/components/cn";
import { Button } from "@/components/design-system/action/button/button";
import { Input } from "@/components/design-system/form/input/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/design-system/overlay/dialog/dialog";
import { FormField } from "@/components/patterns/form-field/form-field";

import { ADMIN_ANALYTICS_PATH } from "../../../paths";
import { PERIOD_KEY } from "../../period";
import {
  PERIOD_CHOICE_CLASS,
  PERIOD_CHOICE_IDLE_CLASS,
  PERIOD_CHOICE_SELECTED_CLASS,
} from "../period-switch/period-switch.definition";

/** `RangeDialog` の props。 */
export type RangeDialogProps = {
  /** いまこの期間で見ているか。 */
  selected: boolean;
  /** URL に載っていた開始日。 */
  from?: string;
  /** URL に載っていた終了日。 */
  to?: string;
};

const LABEL = "期間を指定";

/**
 * 集計する期間の両端を、面を覆って選ぶ。
 *
 * @remarks
 * **overlay にしているのは、両端が決まるまで行き先が決まらないからです。** 隣の 2 つは押した
 * 瞬間に遷移でき、日付を持たない分だけ幅も要りません。同じ並びに 2 つの入力欄と操作を常設すると、
 * 日付を使わない利用者にも常にその領域を見せることになります
 * （[0053](../../../../../../docs/adr/0053-ui-component-interaction-seam.md)「一度に見せる量は段階で絞る」）。
 *
 * **中身は native の GET フォームです。** 送信すると入力した値がそのまま URL のクエリになり、
 * その URL が集計の条件になります。送信を横取りする handler も、入力を持つ state もありません。
 * client にあるのは overlay の開閉と `id` の生成だけです。
 *
 * **選んでいた日付を初期値に戻します。** 開き直したときに入れ直しをさせないためで、値の出所は
 * URL です。overlay を閉じても覚えている場所がここには無く、覚えているのはアドレス欄です。
 *
 * **日付の前後は `min` / `max` でも示します。** ただしこの制約が見ているのは URL に載っていた値で、
 * いま書き換えている途中の値ではありません。入れ替わった組を送れてしまうので、送った先で
 * 誤りとして返ってきます（[0062](../../../../../../docs/adr/0062-form-input-validation.md)）。
 *
 * @see Storybook `Features/Admin/Analytics/RangeDialog`
 */
export function RangeDialog({ selected, from, to }: RangeDialogProps) {
  const fromId = useId();
  const toId = useId();

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          aria-current={selected ? "page" : undefined}
          className={cn(
            PERIOD_CHOICE_CLASS,
            "cursor-pointer",
            selected ? PERIOD_CHOICE_SELECTED_CLASS : PERIOD_CHOICE_IDLE_CLASS,
          )}
          type="button"
        >
          {LABEL}
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{LABEL}</DialogTitle>
          <DialogDescription>
            両端の日を含めて集計します。日付は日本時間の暦日として扱われます。
          </DialogDescription>
        </DialogHeader>
        <form action={ADMIN_ANALYTICS_PATH} className="flex flex-col gap-4" method="get">
          <input name={PERIOD_KEY.PERIOD} type="hidden" value="range" />
          <FormField controlId={fromId} label="開始日" required>
            {(control) => (
              <Input
                {...control}
                defaultValue={from}
                max={to}
                name={PERIOD_KEY.FROM}
                required
                type="date"
              />
            )}
          </FormField>
          <FormField controlId={toId} label="終了日" required>
            {(control) => (
              <Input
                {...control}
                defaultValue={to}
                min={from}
                name={PERIOD_KEY.TO}
                required
                type="date"
              />
            )}
          </FormField>
          <DialogFooter>
            <Button type="submit">この期間で見る</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
