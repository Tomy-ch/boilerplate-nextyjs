import { cn } from "@/components/cn";
import { CartLineIssues } from "@/features/cart/facade/line-issues/line-issues";
import type { CartLine } from "@/model/cart/cart";
import { hasBlockingIssue } from "@/model/cart/issue-notice";
import { withPartSpan } from "@/observability/render-span";

/** `OrderLineRow` の props。 */
export type OrderLineRowProps = {
  /** 再掲する明細。 */
  line: CartLine;
};

/** 商品を引けなかった明細に出す名前。 */
const UNKNOWN_NAME = "取得できない商品";

const EXCLUDED_NOTE = "この明細は今回の購入に含まれません。";
const PRICE_CHANGED_NOTE = "この金額で購入してよいかを、確定のときに確かめます。";

/**
 * 確定する内容の 1 行。
 *
 * @remarks
 * **操作を持ちません。** 数量を変えるのも取り除くのもカートの領分で、同じ操作を 2 つの画面に
 * 置くと、どちらで直したのかを利用者も実装も追えなくなります。
 *
 * **買えない明細と、値が変わっただけの明細を書き分けます。** 前者は今回の購入から外れ、後者は
 * 載ります（載る代わりに、確定のときに金額を確かめます）。どちらも落とさずに出すのは、カートで
 * 見た明細が確認の画面から黙って消えないようにするためです。理由の言い方はカートと同じものを
 * 使い、この画面が足すのは「外れる / 確かめる」の一文だけです。
 *
 * **弱めるのは商品名だけで、行ごと薄くはしません。** 行に透過をかけると、載らない理由の文字まで
 * 一緒に薄くなり、地とのコントラスト比が足りなくなります。読ませたいのはその理由なので、
 * 弱めるのは対象の名前に留めます。
 */
export const OrderLineRow = withPartSpan(
  "features/checkout/confirm/ui/order-line-row/order-line-row",
  ({ line }: OrderLineRowProps) => {
    const blocked = hasBlockingIssue(line);
    const note = blocked ? EXCLUDED_NOTE : PRICE_CHANGED_NOTE;

    return (
      <li className="flex flex-wrap items-start gap-x-4 gap-y-1 py-4">
        <div className="flex min-w-0 flex-1 basis-40 flex-col gap-1">
          <p className={cn("font-emphasis text-sm", blocked && "text-muted-foreground")}>
            {line.name ?? UNKNOWN_NAME}
          </p>
          {line.unitPrice === null ? null : (
            <p className="text-muted-foreground text-sm">{`$${line.unitPrice} / 個`}</p>
          )}
          <CartLineIssues
            availableQuantity={line.availableQuantity}
            issues={line.issues}
            note={note}
          />
        </div>
        <p className="text-sm tabular-nums">{`${line.quantity} 個`}</p>
      </li>
    );
  },
);
