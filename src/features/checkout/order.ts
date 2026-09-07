import type { Cart, CartLine } from "@/model/cart/cart";
import { hasBlockingIssue } from "@/model/cart/issue-notice";
import type { PurchaseOrderLine } from "@/model/purchase/purchase";

/** その明細が値の変わった明細か。買えなくなる事情は持たない。 */
function hasPriceChange(line: CartLine): boolean {
  return line.issues.length > 0 && !hasBlockingIssue(line);
}

/**
 * カートのうち、この購入に載せる明細を取り出す。
 *
 * @remarks
 * **買えない事情のある明細だけを外します。** 値が変わっただけの明細は載せます。外すと、利用者が
 * 買うつもりだったものが黙って落ちるためです。ただし値が変わったことは、確定の前に画面が
 * 確かめます。
 *
 * 買えるかどうかの判定はバックエンドが済ませています。ここが決めるのは、その結果を
 * 「今回の購入に載せる / 載せない」へ写す一段だけです。
 */
export function orderLinesOf(cart: Cart): readonly PurchaseOrderLine[] {
  return cart.lines
    .filter((line) => !hasBlockingIssue(line))
    .map(({ productId, quantity }) => ({ productId, quantity }));
}

/**
 * この購入に載らない明細があるか。
 *
 * @remarks
 * 何件外れたかは数えません。外れた明細はそれぞれ理由とともに画面へ出るため、数だけを別に
 * 持つと同じことを 2 通りで言うことになります。
 */
export function hasExcludedLines(cart: Cart): boolean {
  return cart.lines.some(hasBlockingIssue);
}

/**
 * 値の変わった明細があるか。
 *
 * @remarks
 * **確定の前に確かめる根拠になります。** カートへ入れたときと違う金額で請求されることを、押す前に
 * 利用者が知っていなければなりません。
 *
 * 上がったか下がったかで分けません。どちらも「見ていた金額と違う」ことに変わりはなく、確かめる
 * かどうかの判断は同じです。
 */
export function hasPriceChangedLines(cart: Cart): boolean {
  return cart.lines.some(hasPriceChange);
}

/**
 * 値の変わった明細の名前。
 *
 * @remarks
 * 確認の文面に並べます。どの商品の話かが判らなければ、進めてよいかを判断できません。名前を
 * 引けない明細は買えない事情も持つため、ここには現れません。
 */
export function priceChangedNames(cart: Cart): readonly string[] {
  return cart.lines
    .filter(hasPriceChange)
    .map((line) => line.name)
    .filter((name): name is string => name !== null);
}

/**
 * 値が変わったことを承知した明細。
 *
 * @remarks
 * 承知したことをバックエンドへ伝える手段は、**その明細を今の数量で設定し直すこと**です。設定は
 * 提示済みの価格を今の価格へ置き直すため、次の取得では事情が消え、小計にも含まれます。
 */
export function priceChangedLines(cart: Cart): readonly PurchaseOrderLine[] {
  return cart.lines
    .filter(hasPriceChange)
    .map(({ productId, quantity }) => ({ productId, quantity }));
}
