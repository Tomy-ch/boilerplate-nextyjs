"use client";

import Link from "next/link";
import { Button } from "@/components/design-system/action/button/button";
import { BUTTON_VARIANT } from "@/components/design-system/action/button/button.definition";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/design-system/overlay/alert-dialog/alert-dialog";
import { IDEMPOTENCY_KEY_FIELD } from "@/model/idempotency-key";
import { ACCEPT_PRICE_CHANGE_FIELD } from "../../../form-fields";
import { CART_PATH } from "../../../paths";
import { usePlaceOrderState } from "../place-order-state/place-order-state";
import { PlaceOrderError, PlaceOrderSubmit } from "../place-order-submit/place-order-submit";

/** `PriceChangeConfirm` の props。 */
export type PriceChangeConfirmProps = {
  /** 確定できる明細があるか。無ければ押せない。 */
  orderable: boolean;
  /** カートに入れたときから金額が変わった商品の名前。 */
  changedNames: readonly string[];
};

const OPEN_LABEL = "注文を確定する";
const ACCEPT_LABEL = "はい";
const BACK_LABEL = "確認へ戻る";
const FIX_CART_LABEL = "カートを修正する";

/**
 * 金額が変わっていることを確かめてから確定する操作。
 *
 * @remarks
 * **カートへ入れたときと違う金額で請求されることを、確定してから知らせるわけにいきません。**
 * 確かめの中の「はい」だけが承知の合図を載せ、それが無い送信は Server Action の側でも止まります。
 *
 * **鍵も送信の状態も画面が 1 つだけ持ちます**（`../place-order-state`）。確かめは閉じると木ごと
 * 外れるため、ここで持つと開き直すたびに取り直しになります。
 *
 * 確かめは `AlertDialogAction` ではなく form の submit で行います。`AlertDialogAction` は押した
 * 時点で dialog を閉じるため、送信中の表示も失敗の文言も利用者の見ていない場所に出ます。
 *
 * **出口を 3 つ置きます。** 進む（はい）・見直す（確認へ戻る）・直す（カートを修正する）で、
 * 閉じるだけの操作が無いと、確かめから元の画面へ戻る手段がありません。
 *
 * カートへ移る導線は置き換えで移ります。被せている間の履歴 1 件は現在地の複製で、戻り先として
 * 残すと戻る操作が 1 回空回りします。
 */
export function PriceChangeConfirm({ orderable, changedNames }: PriceChangeConfirmProps) {
  const { formAction, idempotencyKey } = usePlaceOrderState();

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button className="w-full" disabled={!orderable} type="button">
          {OPEN_LABEL}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <form action={formAction} className="flex flex-col gap-4">
          <input name={IDEMPOTENCY_KEY_FIELD} type="hidden" value={idempotencyKey} />
          <input name={ACCEPT_PRICE_CHANGE_FIELD} type="hidden" value="1" />
          <AlertDialogHeader>
            <AlertDialogTitle>金額が変わっています</AlertDialogTitle>
            <AlertDialogDescription>
              カートに入れたときから金額が変わった商品があります。このまま購入に進んでよろしいですか？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <ul className="list-disc pl-5 text-sm">
            {changedNames.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
          <AlertDialogFooter>
            <AlertDialogCancel>{BACK_LABEL}</AlertDialogCancel>
            <Button asChild variant={BUTTON_VARIANT.OUTLINE}>
              <Link href={CART_PATH} replace>
                {FIX_CART_LABEL}
              </Link>
            </Button>
            <PlaceOrderSubmit label={ACCEPT_LABEL} orderable={orderable} />
          </AlertDialogFooter>
          <PlaceOrderError />
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
