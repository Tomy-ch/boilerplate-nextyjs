import "server-only";

import { createRemoteJWKSet, customFetch, EncryptJWT, jwtDecrypt, jwtVerify } from "jose";
import { z } from "zod";

import { createAppError } from "@/errors/app-error";
import { ErrorKind } from "@/errors/error-kind";
import { SESSION_ROLE, type Session, type SessionRole } from "@/model/session";

import { createHttpClient } from "../http/request";
import { fetchOidcEndpoints, type OidcEndpoints } from "./oidc-discovery";
import { toCodeChallenge } from "./pkce";
import { createRandomToken } from "./random-token";
import { deriveSealKey, SEAL_HEADER } from "./seal-key";
import { TRANSACTION_MAX_AGE_SECONDS } from "./session-cookie";
import type {
  AuthorizationRequest,
  AuthorizationTransaction,
  SessionRecord,
  SessionResolver,
} from "./session-resolver";

/** ID Token の署名に許す方式。IdP が非対称鍵で署名する前提を、検証側からも固定する。 */
const ID_TOKEN_ALGORITHMS = ["RS256", "ES256"];

/**
 * IdP でのログアウトを終えた利用者を戻す先。
 *
 * @remarks
 * origin は callback と同じもの（`redirectUri`）から導きます。この 2 つは同じアプリの口であり、
 * 別々に設定へ置くと、片方だけ書き換えた設定が起動時には正しく見えます。
 *
 * **IdP 側にも同じ値の登録が要ります。** 未登録の戻り先を渡すと、IdP は戻さずに自分の画面で
 * 止める（あるいは要求ごと拒む）ため、ログアウトはできても利用者がアプリへ帰れません。
 */
const POST_LOGOUT_PATH = "/";

/** token endpoint の応答のうち、この境界が使う項目。 */
const TokenResponse = z.object({
  access_token: z.string(),
  id_token: z.string(),
  expires_in: z.number().optional(),
});

/** 封緘した一時状態の中身。 */
const SealedTransaction = z.object({
  state: z.string(),
  codeVerifier: z.string(),
  nonce: z.string(),
  returnUrl: z.string(),
});

/** 封緘した cookie の中身。 */
const SealedPayload = z.object({
  sub: z.string(),
  role: z.enum([SESSION_ROLE.admin, SESSION_ROLE.user]),
  accessToken: z.string(),
  idToken: z.string(),
  exp: z.number(),
});

/** 既定 Resolver の依存。時刻と fetch を受け取り、実時間と実通信に縛られずに検証できるようにする。 */
export type DefaultSessionResolverDeps = {
  /** OIDC の issuer。 */
  readonly issuer: string;
  /** public client の client ID。 */
  readonly clientId: string;
  /** IdP に登録済みの callback URL。 */
  readonly redirectUri: string;
  /** 認可要求に渡す space 区切りの scope。 */
  readonly scopes: string;
  /** cookie の封緘に使う秘密値。 */
  readonly sessionSecret: string;
  /** 1 つの要求 URL に許すバイト数の上限。 */
  readonly maxUrlBytes: number;
  /** 取得に使う実装。既定は環境の `fetch`。 */
  readonly fetchImpl?: typeof fetch;
  /**
   * 確立しようとしている session の役割を決める口。
   *
   * @remarks
   * **役割の正本は IdP ではありません。** ID Token の claim から読むと、IdP を差し替えるたびに
   * 役割の出所が変わります。誰であるかは IdP が、何をしてよいかはバックエンドが持ちます
   * （[0070](../../../../docs/adr/0070-backend-role-separation.md)）。
   *
   * 渡さなければ、権限を持たない側に倒します。判定材料が無いときに与えると、確定認可が拒否する
   * まで権限のある画面が見えてしまいます。
   */
  readonly resolveRole?: (accessToken: string) => Promise<SessionRole>;
  /** 現在時刻。既定は `Date.now`。 */
  readonly now?: () => number;
};

/**
 * Authorization Code + PKCE と JWE 封緘による既定の Resolver を作る。
 *
 * @remarks
 * boilerplate が同梱する 1 つの実装です（[0079](../../../../docs/adr/0079-auth-frontend-seam.md) §6）。
 * 差し替えの単位は `SessionResolver` の面であって、この関数の中身ではありません。
 *
 * Discovery の結果は生成した Resolver が抱えます。**取得に失敗したときは抱え込みません。**
 * 失敗した結果を保持すると、IdP の一時的な不調で最初の 1 回が失敗しただけで、以後この Resolver を
 * 使うすべての操作が同じ失敗を返し続けます。
 */
export function createDefaultSessionResolver(deps: DefaultSessionResolverDeps): SessionResolver {
  const now = deps.now ?? Date.now;
  const client = createHttpClient({
    scope: "user-scoped",
    baseUrl: deps.issuer,
    maxUrlBytes: deps.maxUrlBytes,
    fetchImpl: deps.fetchImpl,
  });

  let endpoints: Promise<OidcEndpoints> | undefined;
  let jwks: ReturnType<typeof createRemoteJWKSet> | undefined;

  const resolveEndpoints = (): Promise<OidcEndpoints> => {
    // 失敗した Promise は捨てる。`??=` は undefined のときしか代入しないため、reject した
    // Promise を残すと次の呼び出しも同じ失敗を返し、プロセスを入れ替えるまで回復しない。
    endpoints ??= fetchOidcEndpoints(deps.issuer, deps.maxUrlBytes, deps.fetchImpl).catch(
      (cause: unknown) => {
        endpoints = undefined;

        throw cause;
      },
    );

    return endpoints;
  };

  const resolveJwks = async (): Promise<ReturnType<typeof createRemoteJWKSet>> => {
    const resolved = await resolveEndpoints();
    // 鍵の取得も渡された実装に通す。ここだけが環境の fetch を直に掴むと、IdP との通信が
    // 2 系統に分かれ、片方だけ差し替えた検証や経路設定が黙って素通りする。
    jwks ??= createRemoteJWKSet(new URL(resolved.jwksUri), {
      ...(deps.fetchImpl === undefined ? {} : { [customFetch]: deps.fetchImpl }),
    });

    return jwks;
  };

  return {
    async startAuthorization(returnUrl: string): Promise<AuthorizationRequest> {
      const { authorizationEndpoint } = await resolveEndpoints();
      const transaction: AuthorizationTransaction = {
        state: createRandomToken(),
        codeVerifier: createRandomToken(),
        nonce: createRandomToken(),
        returnUrl,
      };

      const url = new URL(authorizationEndpoint);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("client_id", deps.clientId);
      url.searchParams.set("redirect_uri", deps.redirectUri);
      url.searchParams.set("scope", deps.scopes);
      url.searchParams.set("state", transaction.state);
      url.searchParams.set("nonce", transaction.nonce);
      url.searchParams.set("code_challenge", await toCodeChallenge(transaction.codeVerifier));
      url.searchParams.set("code_challenge_method", "S256");

      return { authorizationUrl: url.toString(), transaction };
    },

    async completeAuthorization({ code, state, transaction }): Promise<SessionRecord> {
      if (state !== transaction.state) {
        throw createAppError(ErrorKind.UNAUTHENTICATED, {
          cause: new Error("認可応答の state が要求時のものと一致しません"),
        });
      }

      const { tokenEndpoint } = await resolveEndpoints();
      const tokens = await client.request({
        path: tokenEndpoint,
        method: "POST",
        form: {
          grant_type: "authorization_code",
          code,
          redirect_uri: deps.redirectUri,
          client_id: deps.clientId,
          code_verifier: transaction.codeVerifier,
        },
        schema: TokenResponse,
      });

      const verified = await jwtVerify(tokens.id_token, await resolveJwks(), {
        issuer: deps.issuer,
        audience: deps.clientId,
        algorithms: ID_TOKEN_ALGORITHMS,
        // 時刻の判定もこの Resolver が受け取った時計で行う。ここだけ実時計を見ると、
        // 有効期限まわりの検証が実時間に依存し、境界のケースを再現できない。
        currentDate: new Date(now()),
      }).catch((cause: unknown) => {
        // 署名・iss・aud・exp のどれで落ちても、呼び出し側から見れば「認証されていない」で同じ。
        // ここで分類しないと、この経路だけが検証ライブラリの例外型を外へ漏らす。
        throw createAppError(ErrorKind.UNAUTHENTICATED, { cause });
      });
      const payload = verified.payload;

      const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];

      // aud が多値のときは、どの client のために出されたトークンかを azp が名指しする。
      // 含まれてさえいれば通す形にすると、別の client 向けのトークンを持ち込まれても通る。
      if (audiences.length > 1 && payload["azp"] !== deps.clientId) {
        throw createAppError(ErrorKind.UNAUTHENTICATED, {
          cause: new Error("ID Token の azp が client と一致しません"),
        });
      }

      if (payload["nonce"] !== transaction.nonce) {
        throw createAppError(ErrorKind.UNAUTHENTICATED, {
          cause: new Error("ID Token の nonce が要求時のものと一致しません"),
        });
      }

      if (payload.sub === undefined) {
        throw createAppError(ErrorKind.UNAUTHENTICATED, {
          cause: new Error("ID Token に subject がありません"),
        });
      }

      const session: Session = {
        userId: payload.sub,
        role: await (deps.resolveRole?.(tokens.access_token) ?? SESSION_ROLE.user),
        expiresAt: toExpiry(tokens.expires_in, payload.exp, now()),
      };

      return { session, accessToken: tokens.access_token, idToken: tokens.id_token };
    },

    async seal(record: SessionRecord): Promise<string> {
      return new EncryptJWT({
        role: record.session.role,
        accessToken: record.accessToken,
        idToken: record.idToken,
      })
        .setProtectedHeader(SEAL_HEADER)
        .setSubject(record.session.userId)
        .setIssuedAt(Math.floor(now() / 1000))
        .setExpirationTime(record.session.expiresAt)
        .encrypt(await deriveSealKey(deps.sessionSecret));
    },

    async sealTransaction(transaction: AuthorizationTransaction): Promise<string> {
      // 相対指定（"600s"）は実時計を基準にするため使わない。この Resolver が受け取った時計で
      // 絶対時刻を組み、封緘と復元が同じ時間軸に乗るようにする。
      const issuedAt = Math.floor(now() / 1000);

      return new EncryptJWT({ ...transaction })
        .setProtectedHeader(SEAL_HEADER)
        .setIssuedAt(issuedAt)
        .setExpirationTime(issuedAt + TRANSACTION_MAX_AGE_SECONDS)
        .encrypt(await deriveSealKey(deps.sessionSecret));
    },

    async restoreTransaction(sealed: string): Promise<AuthorizationTransaction | null> {
      try {
        const { payload } = await jwtDecrypt(sealed, await deriveSealKey(deps.sessionSecret), {
          currentDate: new Date(now()),
        });

        return SealedTransaction.parse(payload);
      } catch {
        return null;
      }
    },

    async restore(sealed: string): Promise<SessionRecord | null> {
      try {
        const { payload } = await jwtDecrypt(sealed, await deriveSealKey(deps.sessionSecret), {
          currentDate: new Date(now()),
        });
        const parsed = SealedPayload.parse(payload);

        return {
          session: {
            userId: parsed.sub,
            role: parsed.role,
            expiresAt: new Date(parsed.exp * 1000),
          },
          accessToken: parsed.accessToken,
          idToken: parsed.idToken,
        };
      } catch {
        // 壊れた cookie・失効・鍵の入れ替えを区別せず未ログインへ倒す。呼び出し側が区別できると、
        // 「復号に失敗した」という事実そのものが攻撃者への手掛かりになる。
        return null;
      }
    },

    async endSession(record: SessionRecord): Promise<string | null> {
      const { endSessionEndpoint } = await resolveEndpoints();

      if (endSessionEndpoint === null) {
        return null;
      }

      const url = new URL(endSessionEndpoint);
      url.searchParams.set("id_token_hint", record.idToken);
      url.searchParams.set("client_id", deps.clientId);
      url.searchParams.set(
        "post_logout_redirect_uri",
        new URL(POST_LOGOUT_PATH, deps.redirectUri).toString(),
      );

      return url.toString();
    },
  };
}

/**
 * session の失効時刻を決める。
 *
 * @remarks
 * `expires_in` は token endpoint が返す「この access token が使える残り秒数」で、session を
 * それより長く生かしても Bearer が通らなくなるだけです。返さない IdP もあるため、その場合は
 * ID Token の `exp` へ落とします。
 */
function toExpiry(expiresIn: number | undefined, idTokenExp: number | undefined, at: number): Date {
  if (expiresIn !== undefined) {
    return new Date(at + expiresIn * 1000);
  }

  if (idTokenExp !== undefined) {
    return new Date(idTokenExp * 1000);
  }

  throw createAppError(ErrorKind.UNAUTHENTICATED, {
    cause: new Error("session の失効時刻を決められません"),
  });
}
