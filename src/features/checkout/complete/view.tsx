import Link from "next/link";

import { Button } from "@/components/design-system/action/button/button";
import { BUTTON_VARIANT } from "@/components/design-system/action/button/button.definition";
import { CircleCheckIcon } from "@/components/icon";
import { PurchaseAmountSummary } from "@/features/purchases/facade/amount-summary/amount-summary";
import { PurchaseLineList } from "@/features/purchases/facade/lines/lines";
import { PurchaseReceiptCard } from "@/features/purchases/facade/receipt/receipt";
import type { ReferenceAmount } from "@/model/money";
import type { Purchase } from "@/model/purchase/purchase";
import { withScreenSpan } from "@/observability/render-span";
import { MYPAGE_PATH, PRODUCTS_PATH } from "../paths";

/** `CheckoutCompleteView` の props。 */
export type CheckoutCompleteViewProps = {
  /** 成立した購入。 */
  purchase: Purchase;
  /** 合計の参考換算額。読めなければ null。 */
  reference: ReferenceAmount | null;
};

/**
 * 購入完了の表示。
 *
 * @remarks
 * 成立したことを先に伝え、控えと内容を続けます。金額の内訳を脇へ貼り付けないのは、この画面に
 * 送信の操作が無く、読み進めるあいだ画面に残しておきたい操作が無いためです。
 *
 * 次の導線を 2 本置きます。買い物へ戻る道と、控えを後から確かめる道です。ここで行き止まりに
 * すると、利用者は戻る操作で確定前の画面へ帰ろうとします。
 */
export const CheckoutCompleteView = withScreenSpan(
  "features/checkout/complete/view",
  ({ purchase, reference }: CheckoutCompleteViewProps) => {
    return (
      <div className="flex flex-col gap-6">
        <p className="flex items-center gap-2 font-emphasis text-lg">
          <CircleCheckIcon aria-hidden="true" className="size-5 text-primary" />
          ご注文ありがとうございます。
        </p>

        <div className="grid items-start gap-6 lg:grid-cols-2">
          <PurchaseReceiptCard purchase={purchase} />
          <div className="rounded-lg border p-4">
            <PurchaseAmountSummary purchase={purchase} reference={reference} />
          </div>
        </div>

        <PurchaseLineList lines={purchase.lines} />

        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href={PRODUCTS_PATH}>買い物を続ける</Link>
          </Button>
          <Button asChild variant={BUTTON_VARIANT.OUTLINE}>
            <Link href={MYPAGE_PATH}>購入の控えを見る</Link>
          </Button>
        </div>
      </div>
    );
  },
);
