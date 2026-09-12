import type { ReactNode } from "react";

import { Badge } from "@/components/design-system/display/badge/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/design-system/display/card/card";
import {
  KeyValueItem,
  KeyValueLabel,
  KeyValueList,
  KeyValueValue,
} from "@/components/design-system/display/key-value-list/key-value-list";
import { formatDateTime } from "@/model/datetime";
import type { Purchase } from "@/model/purchase/purchase";

import { toStatusEmphasis } from "../status-emphasis/status-emphasis";

/** `PurchaseReceiptCard` の props。 */
export type PurchaseReceiptCardProps = {
  /** 表示する購入。 */
  purchase: Purchase;
  /**
   * この購入に対してできること。
   *
   * @remarks
   * 何を置けるかは画面によって違うので、器の側は受け取った物を控えの末尾へ置くだけです。
   * **余白も紙面での扱いも渡す側が持ちます。** 器が包むと、置くものが何も無いときに空の器だけが
   * 余白を占めます。購入完了の画面は渡しません。買った直後に控えを見せる場なので、そこから状態を
   * 動かす操作は置きません。
   */
  actions?: ReactNode;
};

/**
 * 取得に使う ID を出さず、購入コードだけを識別子として見せる控え。
 *
 * @remarks
 * ID は利用者が問い合わせに持ち出せる値ではないため、画面には出しません。
 *
 * 折り返しを許すのは、契約が返すのが UUID で、狭い幅では 1 行に収まらないためです。詰めて隠すと、
 * 問い合わせのときに全文を読み取れません。
 *
 * 状況だけ badge にするのは、一覧の行と同じ色で同じ状態を示すためです。一覧で赤かった購入が
 * 詳細では地の文になっていると、同じことを言っているのかが読み取れません。
 *
 * 購入完了と購入詳細の両方がこれを出すため `facade` に置いています（README 参照）。
 */
export function PurchaseReceiptCard({ purchase, actions }: PurchaseReceiptCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>ご注文の控え</CardTitle>
      </CardHeader>
      <CardContent>
        <KeyValueList>
          <KeyValueItem>
            <KeyValueLabel>注文番号</KeyValueLabel>
            <KeyValueValue className="break-all font-mono">{purchase.code}</KeyValueValue>
          </KeyValueItem>
          <KeyValueItem>
            <KeyValueLabel>注文日時</KeyValueLabel>
            <KeyValueValue>{formatDateTime(purchase.orderedAt)}</KeyValueValue>
          </KeyValueItem>
          <KeyValueItem>
            <KeyValueLabel>状況</KeyValueLabel>
            <KeyValueValue>
              <Badge variant={toStatusEmphasis(purchase.statusCode)}>{purchase.statusName}</Badge>
            </KeyValueValue>
          </KeyValueItem>
        </KeyValueList>
        {actions}
      </CardContent>
    </Card>
  );
}
