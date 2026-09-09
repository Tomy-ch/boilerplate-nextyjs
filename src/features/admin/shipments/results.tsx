import { getShippablePurchases, getShippedPurchases } from "@/adapters/server/api/purchases";

import type { DeliveryAction, ShipmentAction } from "./form-state";
import { ShipmentQueueView } from "./view";

/**
 * 配達の確認を待っている注文を 1 度に読む件数。
 *
 * @remarks
 * ページ送りを持ちません。持たせるなら増分取得の口が要り、配達の確認はここに並ぶ数だけ押せば
 * 片付きます。上限に達しているときは、確認を進めれば残りが現れます。
 */
const DELIVERY_PAGE_SIZE = 50;

/** `ShipmentQueueResults` の props。 */
export type ShipmentQueueResultsProps = {
  /** 発送の送信先。 */
  shipAction: ShipmentAction;
  /** 配達の確認の送信先。 */
  deliverAction: DeliveryAction;
};

/**
 * 発送待ちと発送済みの取得。
 *
 * @remarks
 * 取得だけを持ちます。見た目を持たないのは、待機の境界がこの取得に掛かるためで、境界の内側が
 * 取得と描画の両方を抱えると、描画の都合で境界の位置が動きます。
 *
 * **2 つを並行で取ります。** 互いに依存しないので、順に待つと遅いほうの後ろに速いほうが並ぶ
 * だけです。片方だけの失敗を許さないのは、どちらも同じ担当者が続けて使うもので、片方だけが
 * 出ている画面は「何かが壊れている」以上のことを伝えないためです。
 */
export async function ShipmentQueueResults({
  shipAction,
  deliverAction,
}: ShipmentQueueResultsProps) {
  const [groups, shipped] = await Promise.all([
    getShippablePurchases(),
    getShippedPurchases(DELIVERY_PAGE_SIZE),
  ]);

  return (
    <ShipmentQueueView
      deliverAction={deliverAction}
      groups={groups}
      shipAction={shipAction}
      shipped={shipped}
    />
  );
}
