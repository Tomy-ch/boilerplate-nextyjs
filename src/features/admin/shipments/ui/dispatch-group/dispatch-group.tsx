"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { FormFeedback } from "@/components/app-starter/form-feedback/form-feedback";
import { Button } from "@/components/design-system/action/button/button";
import { BUTTON_VARIANT } from "@/components/design-system/action/button/button.definition";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/design-system/display/card/card";
import { idleActionState } from "@/model/action-state";
import { formatDateTime } from "@/model/datetime";
import { formatMoney } from "@/model/money";
import type { PurchaseDispatchGroup } from "@/model/purchase/purchase";

import { SHIPMENT_FORM_NAMES } from "../../form-names";
import type { ShipmentAction, ShipmentState } from "../../form-state";

/** `DispatchGroupCard` の props。 */
export type DispatchGroupCardProps = {
  /** まとめて発送してよい組。 */
  group: PurchaseDispatchGroup;
  /** 発送の送信先。 */
  shipAction: ShipmentAction;
};

/**
 * 送信中は押せなくする操作。
 *
 * @remarks
 * `useFormStatus` は `form` の子でしか送信状態を読めないため、別の部品に切り出しています。
 * 二重送信を止めるのと、押した操作が進んでいることを示すのを兼ねます。
 */
function ShipSubmit({
  label,
  pendingLabel,
  variant = BUTTON_VARIANT.DEFAULT,
}: {
  label: string;
  pendingLabel: string;
  variant?: typeof BUTTON_VARIANT.DEFAULT | typeof BUTTON_VARIANT.OUTLINE;
}) {
  const { pending } = useFormStatus();

  return (
    <Button pending={pending} pendingLabel={pendingLabel} size="sm" type="submit" variant={variant}>
      {label}
    </Button>
  );
}

/** 結果の文言。通った件数と、いまの状況では通らなかった件数を伝える。 */
function shipmentSummary(shipped: number, refused: number): string {
  return refused === 0
    ? `${shipped} 件を発送しました。`
    : `${shipped} 件を発送しました。${refused} 件はいまの状況では発送できませんでした。`;
}

/**
 * まとめて発送してよい 1 組。
 *
 * @remarks
 * **組そのものに識別子がありません。** 算出結果であって保存されたものではないため、見出しに置く
 * のは組をまとめている軸、すなわち購入者です。
 *
 * 契約の発送は購入 1 件ずつなので、まとめる側は同じ送信に注文を並べて送るだけです
 * （{@link SHIPMENT_FORM_NAMES}）。
 *
 * 何をどう見せるか（宛先の明示・1 件しかない便でまとめる操作を出さない・結果を便ごとに出す）は
 * [画面要件](../../../../../../docs/spec/route/admin/shipments/page.screen.md)。
 */
export function DispatchGroupCard({ group, shipAction }: DispatchGroupCardProps) {
  const [state, formAction] = useActionState<ShipmentState, FormData>(
    shipAction,
    idleActionState(),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-baseline gap-2 text-base">
          宛先
          <span className="break-all font-mono font-normal text-muted-foreground text-sm">
            {group.userId}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ul className="flex flex-col divide-y">
          {group.purchases.map((purchase) => (
            <li
              className="flex flex-wrap items-center justify-between gap-3 py-3"
              key={purchase.code}
            >
              <div className="flex min-w-0 flex-col">
                <span className="break-all font-mono text-sm">{purchase.code}</span>
                <span className="text-muted-foreground text-sm">
                  {formatDateTime(purchase.orderedAt)} / {formatMoney(purchase.totalAmount)}
                </span>
              </div>
              <form action={formAction}>
                <input
                  name={SHIPMENT_FORM_NAMES.purchaseCode}
                  type="hidden"
                  value={purchase.code}
                />
                <ShipSubmit
                  label="発送する"
                  pendingLabel="発送しています…"
                  variant={BUTTON_VARIANT.OUTLINE}
                />
              </form>
            </li>
          ))}
        </ul>

        {group.purchases.length > 1 ? (
          <form action={formAction}>
            {group.purchases.map((purchase) => (
              <input
                key={purchase.code}
                name={SHIPMENT_FORM_NAMES.purchaseCode}
                type="hidden"
                value={purchase.code}
              />
            ))}
            <ShipSubmit label="この便をまとめて発送" pendingLabel="発送しています…" />
          </form>
        ) : null}

        {state.status === "success" ? (
          <FormFeedback
            description={shipmentSummary(state.value.shipped, state.value.refused)}
            title="発送を受け付けました"
          />
        ) : null}

        {state.status === "error" && state.formError !== null ? (
          <FormFeedback
            description={state.formError}
            title="発送できませんでした"
            variant="destructive"
          />
        ) : null}
      </CardContent>
    </Card>
  );
}
