import { z } from "zod";

/**
 * 利用者の識別子を確定させるスキーマ。
 *
 * @remarks
 * 外へは出しません。確定させる口は {@link toUserId} だけで、二重に入口を設けると境界の外でも
 * 通せてしまいます。
 */
const userIdSchema = z.string().brand<"user">();

/**
 * 利用者を指す識別子。
 *
 * @remarks
 * 素の `string` を代入できない形にしてあります。商品・利用者・購入の識別子はいずれも UUID の
 * 文字列で、取り違えても型では止まらないためです。
 */
export type UserId = z.infer<typeof userIdSchema>;

/**
 * 文字列を利用者の識別子として確定させる。
 *
 * @remarks
 * **呼んでよいのは境界だけ**です。外から来た値を確定させる場所（`adapters` の検証の出口・
 * フォームの受け取り）で 1 度だけ通し、内側では確定した型を持ち回ります。
 */
export function toUserId(value: string): UserId {
  return userIdSchema.parse(value);
}

/**
 * 画面が扱う利用者自身の情報。
 *
 * @remarks
 * 契約の wire 型ではなく、表示のための型です。両者を分けるのは、契約の制約が表示の都合とは
 * 別の理由で動くためです。
 *
 * 削除日時は持ちません。自分の情報を引けている時点で退会していないため、画面が分岐する余地が
 * ありません。
 */
export type UserProfile = {
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  readonly phone: string;
  readonly postalCode: string;
  /** 都道府県。契約が名前の文字列で持つため、識別子ではなく名前を送り返す。 */
  readonly prefecture: string;
  readonly city: string;
  readonly street: string;
  /** 建物名・部屋番号。入力は任意で、無ければ null。 */
  readonly building: string | null;
};

/**
 * 選べる都道府県。
 *
 * @remarks
 * `code` は落とします。JIS X 0401 の番号は並び順を決めるための値で、契約が `code` 昇順で返すと
 * 定めているため、受け取った順序がそのまま表示の順序になります。
 */
export type Prefecture = {
  readonly id: string;
  readonly name: string;
};

/**
 * 郵便番号から引いた住所の候補 1 件。
 *
 * @remarks
 * 都道府県の識別子は落とします。プロフィールが持つのは名前の文字列で、識別子を送り返す口が
 * ありません。
 */
export type AddressCandidate = {
  readonly prefecture: string;
  readonly city: string;
  /** 町域。番地から先は利用者が続けて入力する。 */
  readonly town: string;
};

/**
 * 郵便番号を引いた結果。
 *
 * @remarks
 * 候補が無いことには 2 つの意味があり、契約はそれを `isFallback` で区別します。該当する住所が
 * 無かっただけなら手で埋めれば済みますが、lookup 機構そのものが動いていないなら、郵便番号を
 * 直して引き直しても永久に埋まりません。画面が言うべきことが変わるため、ここまで区別を運びます。
 */
export type AddressLookup = {
  readonly candidates: readonly AddressCandidate[];
  /** lookup 機構が機能しなかったか。該当なしは false。 */
  readonly isFallback: boolean;
};

/** 購入集計のステータス別内訳 1 件。 */
type PurchaseStatusBreakdown = {
  readonly statusId: string;
  readonly statusName: string;
  readonly count: number;
  /** 当該ステータスの合計。最小単位の整数で持ち、表示の直前に主単位へ戻す。 */
  readonly totalAmount: number;
};

/**
 * 自分の購入の集計。
 *
 * @remarks
 * 総数と合計は**キャンセル済みを除いた**値です。契約がそう定めており、内訳にもキャンセルの
 * 行は現れません。
 *
 * 内訳に並ぶのは対象に出現したステータスだけで、対象が 1 件も無ければ空になります。
 */
export type PurchaseSummary = {
  readonly totalCount: number;
  /** 合計。最小単位の整数で持ち、表示の直前に主単位へ戻す。 */
  readonly totalAmount: number;
  readonly breakdown: readonly PurchaseStatusBreakdown[];
};

/**
 * 管理の一覧に並べる利用者 1 件。
 *
 * @remarks
 * {@link UserProfile} と別の型にしているのは、見る主体が違うためです。**他人を対象に取る**ため、
 * あちらが持たない識別子（更新と退会が対象を指すのに要る）と退会日時（あちらが持たない理由は
 * {@link UserProfile}）の両方を持ち、退会済みの行も並びます。
 *
 * 住所を持ちません。一覧が答えるのは「誰がいるか」であり、どこに住んでいるかではないためです。
 */
export type ManagedUser = {
  readonly id: UserId;
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  readonly phone: string;
  /**
   * 退会した日時。退会していなければ null。
   *
   * 契約が ISO の文字列で返すため、そのまま持つ。日時として扱う用途がここには無く、
   * 一覧が要るのは「退会しているか」だけである。
   */
  readonly deletedAt: string | null;
};
