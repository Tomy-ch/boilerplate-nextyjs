/** 購入を確かめて確定する画面。この feature が所有するルート。 */
export const CHECKOUT_PATH = "/checkout";

/** 購入が成立したことを伝える画面。 */
const CHECKOUT_COMPLETE_PATH = "/checkout/complete";

/** 成立した購入を指す検索条件の名前。 */
export const PURCHASE_PARAM = "purchase";

/**
 * この画面から出る先。
 *
 * @remarks
 * 行き先の画面はどれも別のスライスが持ちますが、パスはここで宣言します。スライスを跨いで
 * 参照し合うと、片方を消したときにもう片方が壊れます。
 */

/** カートの中身を直す画面。 */
export const CART_PATH = "/cart";

/** 届け先の元になる登録情報を変える画面。 */
export const PROFILE_EDIT_PATH = "/mypage/edit";

/** 買い物を続ける先。 */
export const PRODUCTS_PATH = "/products";

/** 購入の控えを後から確かめる画面。 */
export const MYPAGE_PATH = "/mypage";

/**
 * 成立した購入の完了画面を指す。
 *
 * @remarks
 * 購入を URL に載せるのは、確定の送信と完了の表示を別の遷移に分けるためです。送信した画面の
 * ままで完了を出すと、再読み込みで完了が消え、戻る操作が確定前の画面へ帰ります。
 *
 * @param purchaseCode - 購入コード。利用者へ注文番号として見せている値
 */
export function purchaseCompletePath(purchaseCode: string): string {
  return `${CHECKOUT_COMPLETE_PATH}?${PURCHASE_PARAM}=${encodeURIComponent(purchaseCode)}`;
}
