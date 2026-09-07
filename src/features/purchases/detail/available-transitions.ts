import { PURCHASE_STATUS } from "@/model/purchase/purchase-status";

/**
 * この画面で本人ができること。
 *
 * @remarks
 * 管理側の遷移（発送・配達完了）は含みません。役割の確認を伴い、対象の見つけ方も違うためです。
 */
export const PURCHASE_TRANSITION = {
  PAY: "pay",
  CANCEL: "cancel",
} as const satisfies Readonly<Record<string, string>>;

/** {@link PURCHASE_TRANSITION} の値。 */
export type PurchaseTransition = (typeof PURCHASE_TRANSITION)[keyof typeof PURCHASE_TRANSITION];

/**
 * ステータスごとにできること。
 *
 * @remarks
 * 契約が `PATCH /v1/purchases/{purchaseCode}/pay` と `.../cancel` に宣言している遷移可能な状態を、
 * ステータスの側から引き直したものです。**並びは画面に出す順**で、進む操作を先に置きます。
 *
 * **処理中は支払えません。** 処理中は「支払いを終え、発送に向けた処理を進めている」状態で、
 * 支払日時が既に記録されています。ここへ支払いを送ると記録済みの日時が現在時刻へ潰れるため、
 * 契約は二重支払いとして拒みます。
 *
 * 終端（完了 / キャンセル / 配達済み）と発送済みは、できることがないので現れません。
 */
const AVAILABLE_TRANSITIONS: Readonly<Record<number, readonly PurchaseTransition[]>> = {
  [PURCHASE_STATUS.UNPROCESSED]: [PURCHASE_TRANSITION.PAY, PURCHASE_TRANSITION.CANCEL],
  [PURCHASE_STATUS.ACCEPTED]: [PURCHASE_TRANSITION.PAY, PURCHASE_TRANSITION.CANCEL],
  [PURCHASE_STATUS.CONFIRMING]: [PURCHASE_TRANSITION.PAY, PURCHASE_TRANSITION.CANCEL],
  [PURCHASE_STATUS.PROCESSING]: [PURCHASE_TRANSITION.CANCEL],
  [PURCHASE_STATUS.PAID]: [PURCHASE_TRANSITION.CANCEL],
};

/**
 * その購入に対して本人がいまできることを、画面に出す順で返す。
 *
 * @remarks
 * **この画面の持ち物です。** バックエンドが持つ状態遷移の規則を写したものなので、カーネルへは
 * 上げません。管理側の操作が同じ判定を必要としたときに、そこで初めて共有先を決めます。
 *
 * **知らない業務キーには何も返しません。** マスタが増えたときに、可否を確かめていない状態へ
 * 不可逆な操作を出すことになります。
 *
 * 判定の正がバックエンドにあること（送った結果が拒まれる余地）は
 * [機能要件](../../../../docs/spec/route/shop/purchases/[code]/page.function.md)「状態を進める」。
 */
export function availablePurchaseTransitions(statusCode: number): readonly PurchaseTransition[] {
  return AVAILABLE_TRANSITIONS[statusCode] ?? [];
}
