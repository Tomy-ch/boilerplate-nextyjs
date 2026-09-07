import "server-only";

import { isServedOverTls } from "@/config/auth/auth.schema";
import { getAuthConfig } from "@/config/auth/auth.server";

/**
 * cookie 名の接頭辞。
 *
 * @remarks
 * 用途を名前に含めるのは、ブラウザの一覧を見た人が何の cookie か辿れるようにするためです
 * （`docs/rules.md`「データ分類と機微情報」の「アプリ cookie は用途を接頭辞に含め、属性を用途ごとに
 * 明示する」）。`auth` は BFF が認証のために置くものを指します。
 */
const PREFIX = "auth";

/** 封緘した session を載せる cookie の名前。 */
export const SESSION_COOKIE_NAME = `${PREFIX}_session`;

/** 認可要求の往復で一時状態を載せる cookie の名前。 */
export const TRANSACTION_COOKIE_NAME = `${PREFIX}_tx`;

/**
 * 認可要求の一時状態が生きる秒数。
 *
 * @remarks
 * IdP の画面で利用者が入力を終えるまでの猶予です。長く取ると、離脱した認可要求の一時状態が
 * ブラウザに残り続けます。
 */
export const TRANSACTION_MAX_AGE_SECONDS = 600;

/**
 * cookie に共通で付ける属性。
 *
 * @remarks
 * 属性の既定は `docs/rules.md`「データ分類と機微情報」の「アプリ cookie は用途を接頭辞に含め、
 * 属性を用途ごとに明示する」が持ちます。ここに書くのは、この口に固有の判断だけです。
 *
 * `sameSite: "lax"` は他サイトからの POST に cookie を載せない一方、IdP からのリダイレクト
 * （トップレベルの GET ナビゲーション）では送出されます。`strict` にすると callback で
 * cookie が届かず、認証が成立しません。
 *
 * `secure` は自分が https で配信されているときだけ付けます。常に付けると `http://localhost` の
 * 開発で cookie が保存されず、逆に常に外すと本番で平文の経路に載ります。判定は
 * {@link isServedOverTls} が持ちます。
 */
export function baseCookieOptions(): {
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: "/";
} {
  return {
    httpOnly: true,
    secure: isServedOverTls(getAuthConfig().redirectUri),
    sameSite: "lax",
    path: "/",
  };
}
