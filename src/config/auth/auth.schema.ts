import { z } from "zod";

/** auth purpose 専用の ENV validator を定義する。 */

const httpUrl = z.url().refine(
  (value) => {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  },
  { error: "http または https の URL を指定してください" },
);

/** OIDC issuer を検証する。 */
export function authIssuerValidator() {
  return httpUrl;
}

/**
 * 認可の開始先を検証する。
 *
 * @remarks
 * `dev` は IdP を立てずに保護された画面まで到達させるための値です。**この変数だけでは効きません**
 * —— 実際に効かせるかの判定は `adapters/server/auth/resolver.ts` の
 * `usesDevelopmentAuthorization()` が環境と併せて行い、その理由もそちらが持ちます。
 *
 * 省略できます。既定の `idp` は環境によらず正しい値で、`dev` を置くのは開発専用の口を開けて
 * いる環境だけです。全環境へ必須にすると、実環境の設定に「開発用ではない」と書くだけの行が
 * 増えます。
 */
export function authModeValidator() {
  return z.enum(["idp", "dev"]).default("idp");
}

/** OIDC public client ID を検証する。 */
export function authClientIdValidator() {
  return z.string().min(1);
}

/** IdP に登録する callback URL を検証する。 */
export function authRedirectUriValidator() {
  return httpUrl;
}

/**
 * 自分が https で配信されているか。
 *
 * @remarks
 * 判定に callback URL を使います。あれは IdP がブラウザを戻す先、すなわち**自分の origin** であり、
 * 環境の種類を別の変数で持たずに scheme を知れる唯一の既存の値です。cookie の `secure` と
 * 配信ヘッダ（HSTS / `upgrade-insecure-requests`）が同じ答えを要るため、綴りをここに 1 つ置きます。
 *
 * @param redirectUri - 検証済みの `AUTH_REDIRECT_URI`
 */
export function isServedOverTls(redirectUri: string): boolean {
  return new URL(redirectUri).protocol === "https:";
}

/** 認可リクエストの scope を検証する。 */
export function authScopesValidator() {
  return z.string().trim().min(1);
}

/**
 * リポジトリに同梱している秘密値。
 *
 * @remarks
 * 開発と CI を `git clone` 直後に動かすための値であり、**公開リポジトリに平文で載っています**。
 * 誰でも読めるため、これで封緘した session cookie は誰でも偽造できます。
 */
const SHIPPED_SECRETS: ReadonlySet<string> = new Set([
  "local-development-session-secret-change-before-production",
  "ci-session-secret-must-never-be-used-in-production",
]);

/**
 * BFF session を保護する秘密値を検証する。
 *
 * @remarks
 * 同梱値をそのまま受け付けません。設定し忘れは「値が無い」ではなく「既知の値が入っている」形で
 * 現れるため、長さだけを見る検証では通り抜けます。判定を起動時に置くのは、cookie を 1 枚でも
 * 発行する前に止めるためです。
 *
 * 開発と CI では、その環境の env ファイルが同梱値を渡すので通ります。判定に環境を渡すのは
 * 呼び出し側の責務です。
 *
 * @param allowShipped - 同梱値を許すか。local / ci だけ true
 */
export function authSessionSecretValidator(allowShipped: boolean) {
  return z
    .string()
    .min(32)
    .refine((value) => allowShipped || !SHIPPED_SECRETS.has(value), {
      error: "AUTH_SESSION_SECRET が同梱の値のままです。環境ごとの秘密値を設定してください",
    });
}

/** 認可の開始先。 */
export type AuthMode = z.infer<ReturnType<typeof authModeValidator>>;

export type AuthEnvironment = {
  AUTH_MODE: AuthMode;
  AUTH_ISSUER: z.infer<ReturnType<typeof authIssuerValidator>>;
  AUTH_CLIENT_ID: z.infer<ReturnType<typeof authClientIdValidator>>;
  AUTH_REDIRECT_URI: z.infer<ReturnType<typeof authRedirectUriValidator>>;
  AUTH_SCOPES: z.infer<ReturnType<typeof authScopesValidator>>;
  AUTH_SESSION_SECRET: string;
};
