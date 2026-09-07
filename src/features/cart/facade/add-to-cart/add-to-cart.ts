"use server";

import { revalidatePath } from "next/cache";

import { getMyCart, setMyCartItem } from "@/adapters/server/api/cart";
import {
  type ActionState,
  actionStateFromError,
  failedActionState,
  succeededActionState,
} from "@/model/action-state";
import { toProductId } from "@/model/product/product";

/** 送信された内容を解けなかったときの文言。 */
const MALFORMED_MESSAGE = "操作を受け付けられませんでした。画面を読み込み直してください。";

/**
 * 商品をカートへ 1 つ入れる。
 *
 * @remarks
 * カートの外側にある画面から起こされる唯一のカート操作なので、区画として公開しています
 * （feature 同士は直接参照しません）。
 *
 * 既に入っている商品は行を増やさず数量を上げます。契約の設定（PUT）は絶対値を取るため、現在の
 * 数量を読んでから 1 を足した値を送ります。**読んでから送るまでの間に別の窓が同じ商品を操作した
 * 場合、後から届いた側の数量になります。** カートは購入の控えであり、最終的な数量は利用者が
 * カートの画面で確かめられます。
 *
 * 在庫を超えても拒みません。買えるかどうかはバックエンドが明細の事情として返します。
 */
export async function addToCartAction(
  _previous: ActionState<void>,
  formData: FormData,
): Promise<ActionState<void>> {
  const raw = formData.get("productId");

  if (typeof raw !== "string" || raw === "") {
    return failedActionState({ formError: MALFORMED_MESSAGE });
  }

  const productId = toProductId(raw);

  try {
    const { lines } = await getMyCart();
    const inCart = lines.find((line) => line.productId === productId)?.quantity ?? 0;

    await setMyCartItem(productId, inCart + 1);
  } catch (error) {
    return actionStateFromError(error);
  }

  // 明細は本体だけでなく、どの画面にも付く外枠（脇の領域と header の点数）にも出る。
  revalidatePath("/", "layout");

  return succeededActionState(undefined);
}
