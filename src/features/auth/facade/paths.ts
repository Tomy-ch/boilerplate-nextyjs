import { toSafeReturnUrl } from "@/model/return-url";

/** ログイン画面。認証をやり直させる先。 */
export const LOGIN_PATH = "/login";

/**
 * 認証を促す行き先を組む。
 *
 * @remarks
 * 戻り先を必ず検証してから載せます。受け取った値をそのまま置くと、自サイトの導線で外部の
 * URL へ送れます（open redirect）。検証は `model` が持ち、ここはその結果を URL へ組むだけです。
 *
 * `proxy.ts` は同じ行き先を自前で組みます。前捌きは 11 カーネルの外にあり `features` を
 * 参照できないためで、これは重複ではなく層の境界です。
 *
 * @param returnTo - 認証後に戻す先。同一 origin の相対パスでなければ `/` へ倒れる
 */
export function loginPath(returnTo: string): string {
  return `${LOGIN_PATH}?returnUrl=${encodeURIComponent(toSafeReturnUrl(returnTo))}`;
}
