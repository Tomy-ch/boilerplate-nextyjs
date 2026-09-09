import { AmountWithReference } from "@/components/design-system/display/amount-with-reference/amount-with-reference";
import type { Cart } from "@/model/cart/cart";
import type { ReferenceAmount } from "@/model/money";
import { withPartSpan } from "@/observability/render-span";
import { hasExcludedLines, orderLinesOf, priceChangedNames } from "../../../order";
import { PlaceOrderForm } from "../place-order-form/place-order-form";
import { PriceChangeConfirm } from "../price-change-confirm/price-change-confirm";

/** `OrderSummary` の props。 */
export type OrderSummaryProps = {
  /** 確定しようとしているカート。 */
  cart: Cart;
  /** 小計の参考換算額。読めなければ null。 */
  reference: ReferenceAmount | null;
  /** 金額の大きさ。脇に貼り付ける器では控えめに出す。 */
  size?: "compact" | "prominent";
};

/**
 * 小計と確定の操作。
 *
 * @remarks
 * 器を持ちません。広い幅では本文の脇に貼り付き、狭い幅では画面の下端に固定されるため、位置は
 * 呼び出し元が決めます。
 *
 * **出せるのは小計までです。** 税と送料は購入を作った応答で初めて決まるため、確定する前に
 * 総額を出せません。判らないものを 0 として並べず、いつ決まるかを添えます。
 *
 * **値の変わった明細は小計に入っていません。** 合算はバックエンドが事情の無い明細だけで行うため
 * です。その明細も購入には載るので、金額が変わったことは確定の操作が押された時点で確かめます。
 *
 * **確定できないときは確かめの姿を出しません。** 載せる明細が 1 つも無い状態で「このまま進んで
 * よいか」を問うても、答えたところで進めません。
 */
export const OrderSummary = withPartSpan(
  "features/checkout/confirm/ui/order-summary/order-summary",
  ({ cart, reference, size }: OrderSummaryProps) => {
    const orderable = orderLinesOf(cart).length > 0;
    const changedNames = priceChangedNames(cart);

    return (
      <div className="flex flex-col gap-4">
        <AmountWithReference
          amount={cart.subtotalAmount}
          label="小計"
          reference={reference}
          size={size}
        />
        <div className="flex flex-col gap-1 text-muted-foreground text-xs">
          <p>税と送料は、注文を確定した時点で決まります。</p>
          {hasExcludedLines(cart) ? <p>買えない明細は今回の購入から外れます。</p> : null}
          {changedNames.length === 0 ? null : (
            <p>金額の変わった明細は小計に入っていません。確定のときに確かめます。</p>
          )}
        </div>
        {!orderable || changedNames.length === 0 ? (
          <PlaceOrderForm orderable={orderable} />
        ) : (
          <PriceChangeConfirm changedNames={changedNames} orderable={orderable} />
        )}
      </div>
    );
  },
);
