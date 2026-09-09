"use client";

import { FormFeedback } from "@/components/app-starter/form-feedback/form-feedback";
import { Button } from "@/components/design-system/action/button/button";

import { usePlaceOrderState } from "../place-order-state/place-order-state";

/** `PlaceOrderSubmit` の props。 */
export type PlaceOrderSubmitProps = {
  /** 見えている文言。 */
  label: string;
  /** 確定できる明細があるか。無ければ押せない。 */
  orderable: boolean;
  /** 器の幅いっぱいに広げるか。集計の中では主操作として広げ、確かめの footer では文言の幅に収める。 */
  fullWidth?: boolean;
};

const PENDING_LABEL = "注文を確定しています";

/**
 * 購入を確定する送信部。
 *
 * @remarks
 * 待っているかは画面が 1 つだけ持つ送信の状態から採ります（`../place-order-state`）。`useFormStatus`
 * は自分の属する `form` しか見ないため、同じ集計を 2 か所へ描くこの画面では待ち方が姿ごとに割れます。
 *
 * 送信中の見せ方と、そのあいだ押せなくすることは `Button` が持ちます。ここが渡すのは、待って
 * いることを支援技術へ伝える文言だけです。
 *
 * この画面では鍵が同じなので二度押しても購入は増えませんが、**それを理由に押せるまま残しません**
 * （押せなくする理由は `Button` の `pending`）。
 */
export function PlaceOrderSubmit({ label, orderable, fullWidth = false }: PlaceOrderSubmitProps) {
  const { isPending } = usePlaceOrderState();

  return (
    <Button
      className={fullWidth ? "w-full" : undefined}
      disabled={!orderable}
      pending={isPending}
      pendingLabel={PENDING_LABEL}
      type="submit"
    >
      {label}
    </Button>
  );
}

/**
 * 確定が通らなかったことを、その操作の隣に出す。
 *
 * @remarks
 * 成立したときは何も出しません。成立したら完了画面へ送るため、成功した状態がこの画面に現れる
 * ことがありません。
 */
export function PlaceOrderError() {
  const { state } = usePlaceOrderState();

  if (state.status !== "error" || state.formError === null) {
    return null;
  }

  return (
    <FormFeedback
      description={state.formError}
      title="注文を確定できませんでした"
      variant="destructive"
    />
  );
}
