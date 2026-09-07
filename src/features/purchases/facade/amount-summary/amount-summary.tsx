import { AmountWithReference } from "@/components/design-system/display/amount-with-reference/amount-with-reference";
import { Separator } from "@/components/design-system/display/separator/separator";
import { formatMoney, type ReferenceAmount } from "@/model/money";
import type { Purchase } from "@/model/purchase/purchase";

/** `PurchaseAmountSummary` の props。 */
export type PurchaseAmountSummaryProps = {
  /** 表示する購入。 */
  purchase: Purchase;
  /** 合計の参考換算額。読めなければ null。 */
  reference: ReferenceAmount | null;
};

/**
 * 請求額の内訳。
 *
 * @remarks
 * **確定した金額です。** 小計・税・送料・合計はいずれもバックエンドが決めた値で、画面は足し直し
 * ません。
 *
 * 参考換算額を添えるのは合計にだけです。内訳のそれぞれに添えると、どれが請求された金額なのかが
 * 読み取れなくなります。切り替えの振る舞いは
 * [`AmountWithReference`](../../../../components/design-system/display/amount-with-reference/README.md)
 * が持ちます。
 *
 * 購入完了と購入詳細の両方がこれを出すため `facade` に置いています（README 参照）。
 */
export function PurchaseAmountSummary({ purchase, reference }: PurchaseAmountSummaryProps) {
  const rows = [
    { label: "小計", amount: purchase.subtotalAmount },
    { label: "税", amount: purchase.taxAmount },
    { label: "送料", amount: purchase.shippingFee },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        {rows.map((row) => (
          <p className="flex items-baseline justify-between gap-2 text-sm" key={row.label}>
            <span className="text-muted-foreground">{row.label}</span>
            <span className="tabular-nums">{formatMoney(row.amount)}</span>
          </p>
        ))}
      </div>
      <Separator />
      <AmountWithReference amount={purchase.totalAmount} label="合計" reference={reference} />
    </div>
  );
}
