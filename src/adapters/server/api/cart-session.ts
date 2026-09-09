import "server-only";

import { cookies } from "next/headers";

import { baseCookieOptions } from "../auth/session-cookie";

/**
 * ゲストのカートを指す識別子を載せる cookie の名前。
 *
 * @remarks
 * 用途を接頭辞に含めます（`docs/rules.md`「データ分類と機微情報」の「アプリ cookie は用途を接頭辞に
 * 含め、属性を用途ごとに明示する」）。認証の cookie と別に置くのは、未認証でも発行され、
 * 寿命も主体も session と一致しないためです。
 */
const CART_SESSION_COOKIE_NAME = "cart_session";

/**
 * ゲストのカートを指す識別子を取り出す。
 *
 * @remarks
 * 空の値は持っていないものとして扱います。cookie は残っているが中身が空という状態は起こりえて、
 * そのまま送るとバックエンドが形の違反として拒み、カートの取得ごと失敗します。
 *
 * @returns まだ発行されていなければ null
 */
export async function readCartSession(): Promise<string | null> {
  const value = (await cookies()).get(CART_SESSION_COOKIE_NAME)?.value;

  return value === undefined || value === "" ? null : value;
}

/**
 * ゲストのカートを指す識別子を cookie へ載せる。
 *
 * @remarks
 * ブラウザから読める形には置きません。この値だけがゲストのカートへ到達する手段であり、
 * 露出はそのまま他人のカートへの到達経路になります。
 *
 * cookie の寿命はカートの有効期限に合わせます。カートが先に消えると、残った cookie は何も
 * 指さない値になります。期限が判らない場合はブラウザを閉じるまでとし、こちらで年数を決めません。
 *
 * @param token - バックエンドが発行した識別子
 * @param expiresAt - カートの有効期限。判らなければ null
 */
export async function storeCartSession(token: string, expiresAt: Date | null): Promise<void> {
  const maxAge =
    expiresAt === null
      ? undefined
      : Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));

  (await cookies()).set(CART_SESSION_COOKIE_NAME, token, { ...baseCookieOptions(), maxAge });
}

/**
 * ゲストのカートを指す識別子を破棄する。
 *
 * @remarks
 * ログアウトの teardown に含めます。次に画面を開いた利用者へ、前の利用者のカートが
 * 見えないようにするためです。
 */
export async function clearCartSession(): Promise<void> {
  (await cookies()).delete(CART_SESSION_COOKIE_NAME);
}
