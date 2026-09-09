import Link from "next/link";

import { Button } from "@/components/design-system/action/button/button";
import { BUTTON_VARIANT } from "@/components/design-system/action/button/button.definition";
import { ActionBar } from "@/components/patterns/action-bar/action-bar";
import { ACTION_BAR_POSITION } from "@/components/patterns/action-bar/action-bar.definition";
import {
  APP_SHELL_HEADER_HEIGHT,
  APP_SHELL_STICKY_GAP,
} from "@/components/shell/app-shell/app-shell.definition";
import type { Cart } from "@/model/cart/cart";
import type { ReferenceAmount } from "@/model/money";
import type { UserProfile } from "@/model/user/user";
import { withScreenSpan } from "@/observability/render-span";
import { PRODUCTS_PATH } from "../paths";
import { OrderLines } from "./ui/order-lines/order-lines";
import { OrderSummary } from "./ui/order-summary/order-summary";
import { PlaceOrderStateProvider } from "./ui/place-order-state/place-order-state";
import { ShippingCard } from "./ui/shipping-card/shipping-card";

/** `CheckoutConfirmView` の props。 */
export type CheckoutConfirmViewProps = {
  /** 確定しようとしているカート。 */
  cart: Cart;
  /** 届け先として使う登録情報。 */
  profile: UserProfile;
  /** 小計の参考換算額。読めなければ null。 */
  reference: ReferenceAmount | null;
  /** この画面の確定 1 回ぶんを表す鍵。 */
  idempotencyKey: string;
};

/**
 * 購入確認の表示。
 *
 * @remarks
 * 届け先と内容を左に積み、集計と確定を右へ置きます。内容が伸びても確定の操作が画面の中に
 * 残るためで、脇に置けない幅では画面の下端に固定した帯が同じ役割を持ちます
 * （`docs/rules.md`「レイアウトと帯」の「脇に常設する領域は `lg` 以上でだけ出す」と
 * 「常に届く操作は `lg` 未満で画面下端に固定する」）。
 *
 * 同じ集計を 2 か所に置いていますが、**出るのはどちらか一方だけ**です。器の出し分けは CSS で
 * 行い、hydration を待ちません。待つと、読み始めた後に画面の下へ器が現れて内容が動きます。
 *
 * **区画として名乗るのは脇に置く側だけ**です。両方が同じ名前で名乗ると、CSS で片方が消えていても
 * 検査の上では同名の区画が 2 つ並びます。下端の帯は器であって区画ではなく、中身の集計が自分で
 * 何であるかを示します。
 *
 * 本文の下端には帯のぶんの余白を空けます。空けないと、最後の行が帯に隠れます。
 *
 * **確定の送信状態は器が 1 つだけ持ちます**（`ui/place-order-state`）。集計が 2 か所に居るぶん
 * 送信の姿も 2 つ mount されるため、状態を姿ごとに持つと、送っている最中に幅が境界を跨いだとき
 * 表に出る側が「何も送っていない」姿になります。
 */
export const CheckoutConfirmView = withScreenSpan(
  "features/checkout/confirm/view",
  ({ cart, profile, reference, idempotencyKey }: CheckoutConfirmViewProps) => {
    if (cart.lines.length === 0) {
      return (
        <div className="flex flex-col items-start gap-4 py-8">
          <p className="text-muted-foreground">
            カートに商品が入っていないため、確定できる注文がありません。
          </p>
          <Button asChild variant={BUTTON_VARIANT.OUTLINE}>
            <Link href={PRODUCTS_PATH}>商品を探す</Link>
          </Button>
        </div>
      );
    }

    return (
      <PlaceOrderStateProvider idempotencyKey={idempotencyKey}>
        <div className="flex flex-col gap-8 pb-40 lg:flex-row lg:items-start lg:pb-0">
          <div className="flex min-w-0 flex-1 flex-col gap-6">
            <ShippingCard profile={profile} />
            <OrderLines lines={cart.lines} />
          </div>

          <aside
            aria-label="お支払い金額"
            className="hidden w-full rounded-lg border p-4 lg:sticky lg:block lg:w-80"
            style={{ top: APP_SHELL_HEADER_HEIGHT + APP_SHELL_STICKY_GAP }}
          >
            <OrderSummary cart={cart} reference={reference} size="compact" />
          </aside>
        </div>

        <ActionBar
          className="flex-col items-stretch gap-2 lg:hidden"
          position={ACTION_BAR_POSITION.FIXED}
        >
          <OrderSummary cart={cart} reference={reference} size="compact" />
        </ActionBar>
      </PlaceOrderStateProvider>
    );
  },
);
