"use client";

import Link from "next/link";
import { useActionState } from "react";

import { FormFeedback } from "@/components/app-starter/form-feedback/form-feedback";
import { Button } from "@/components/design-system/action/button/button";
import { ErrorKind } from "@/errors/error-kind";
import { idleActionState } from "@/model/action-state";
import type { Product } from "@/model/product/product";

import { ADMIN_PRODUCT_LIST_PATH, adminProductStockPath } from "../../paths";
import { ProductSubmitButton } from "../ui/submit-button/submit-button";
import { useActionResultFreshness } from "../use-action-result-freshness";
import { STOCK_FORM_NAMES } from "./form-names";
import type { AdjustProductStockAction, StockFormState } from "./form-state";
import { StockAmountFields } from "./ui/amount-fields/amount-fields";
import { StockCurrentAmount } from "./ui/current-stock/current-stock";

/** `AdminProductStockView` の props。 */
export type AdminProductStockViewProps = {
  /** 在庫を動かす対象。読み込んだ時点の在庫数を含む。 */
  product: Product;
  /** 在庫を動かす送信先。 */
  adjustAction: AdjustProductStockAction;
};

/**
 * 打っている途中の値を持たず、送信の結果だけを見る在庫補充の器。
 *
 * @remarks
 * 向きも量も欄の側（[`StockAmountFields`](./ui/amount-fields/amount-fields.tsx)）が持ち、送信には
 * 欄の `name` で載ります。
 *
 * 画面が何を約束するか（在庫だけを動かす / 誤りの出し方 / `409` にだけ読み込み直す導線を添える）は
 * [機能要件](../../../../../docs/spec/route/admin/products/[id]/stock/page.function.md)と[画面要件](../../../../../docs/spec/route/admin/products/[id]/stock/page.screen.md)。
 */
export function AdminProductStockView({ adjustAction, product }: AdminProductStockViewProps) {
  const [state, formAction] = useActionState<StockFormState, FormData>(
    adjustAction,
    idleActionState(),
  );
  const { dismiss, dismissed } = useActionResultFreshness(state);

  const failed = !dismissed && state.status === "error";
  const conflicted = failed && state.kind === ErrorKind.CONFLICT;

  return (
    <form action={formAction} className="grid gap-6" onInput={dismiss}>
      <input name={STOCK_FORM_NAMES.productId} type="hidden" value={product.id} />

      {failed && state.formError !== null ? (
        <FormFeedback
          description={state.formError}
          title="在庫を更新できませんでした"
          variant="destructive"
        >
          {conflicted ? (
            <Button asChild size="sm" variant="outline">
              <Link href={adminProductStockPath(product.id)}>読み込み直す</Link>
            </Button>
          ) : null}
        </FormFeedback>
      ) : null}

      <StockCurrentAmount
        productName={product.name}
        quantity={product.quantity}
        reloadHref={adminProductStockPath(product.id)}
      />

      <StockAmountFields
        current={product.quantity}
        {...(failed && state.fieldErrors?.quantity?.[0] !== undefined
          ? { message: state.fieldErrors.quantity[0] }
          : {})}
      />

      <div className="flex flex-wrap items-center gap-3">
        <ProductSubmitButton blocked={false} label="在庫を更新" pendingLabel="更新しています…" />
        <Button asChild variant="ghost">
          <Link href={ADMIN_PRODUCT_LIST_PATH}>キャンセル</Link>
        </Button>
      </div>
    </form>
  );
}
