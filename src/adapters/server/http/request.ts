import "server-only";

import { type ZodType, z } from "zod";

import { assertRequestTargetWithinBudget } from "@/adapters/http/url-budget";
import { createAppError } from "@/errors/app-error";
import { ErrorKind } from "@/errors/error-kind";
import { withErrorDetails } from "@/errors/error-meta";

import { type CircuitBreaker, createCircuitBreaker } from "./circuit-breaker";
import { assertNoCredentialHeader, assertSpecWithinScope } from "./data-scope";
import { DEFAULT_PROFILE, type ResilienceProfile } from "./resilience-profile";
import { createRetryBudget, type RetryBudget } from "./retry-budget";
import {
  backoffDelayMs,
  isRetryableMethod,
  isRetryableOutcome,
  retryAfterDelayMs,
  toErrorKind,
} from "./retry-policy";

/**
 * 本文の符号化。JSON と form のどちらか一方だけを指定できる。
 *
 * @remarks
 * 型で排他にしているのは、両方を渡した実装が「どちらが送られるか」を読む側に推測させるためです。
 * 送る形は 1 つに決まっていなければなりません。
 */
type RequestPayload =
  | {
      /** 送信する本文。JSON として送る。 */
      body?: unknown;
      form?: never;
      multipart?: never;
    }
  | {
      body?: never;
      /**
       * 送信する本文。form として符号化して送る。
       *
       * @remarks
       * OAuth / OIDC の token endpoint は `application/x-www-form-urlencoded` を要求します
       * （RFC 6749 §4.1.3）。JSON を受け付けない相手が実在するため、符号化の選択をこの境界が持ちます。
       */
      form?: Readonly<Record<string, string>>;
      multipart?: never;
    }
  | {
      body?: never;
      form?: never;
      /**
       * 送信する本文。`multipart/form-data` として送る。
       *
       * @remarks
       * ファイルを受け取る口が multipart しか持たない場合に使います。JSON と違い、
       * 値がバイト列のままで運べます。
       */
      multipart?: FormData;
    };

/** 呼び出し 1 件の指定のうち、分類によらず共通のもの。 */
type BaseRequestSpec<T> = RequestPayload & {
  /**
   * 呼び出し先。base URL からの相対パス、または絶対 URL。
   *
   * @remarks
   * 絶対 URL は base URL へ繋がず、そのまま叩きます（{@link buildUrl}）。Discovery が返す
   * エンドポイントがこの形で届きます。
   */
  path: string;
  /** HTTP メソッド。既定は GET。 */
  method?: string;
  /**
   * クエリ文字列。
   *
   * @remarks
   * 配列を渡すと同じキーを繰り返して並べます。1 つの条件に複数の値を許す契約は、値を区切り
   * 文字で連結した 1 つの値ではなく繰り返しで受け取るためです。空配列は未指定として扱います。
   */
  searchParams?: Record<string, string | readonly string[] | undefined>;
  /**
   * この呼び出しに固有のヘッダ。
   *
   * @remarks
   * 認証ヘッダはここで組みません（`getBearerToken` が持ちます）。ここに置くのは、呼び出しごとに
   * 値の変わる契約上のヘッダだけです。
   */
  headers?: Readonly<Record<string, string>>;
  /**
   * 応答の検証スキーマ。
   *
   * 契約に載っている形であることを、内層へ渡す前にここで確かめる。バックエンドの応答には
   * server 側の runtime 検証が無く、契約破れを止める最後の地点がこの境界になる。
   */
  schema: ZodType<T>;
  /**
   * 冪等な呼び出しであることの宣言。
   *
   * POST / PATCH を再試行してよいのは、同じ要求が 2 度届いても結果が変わらないことを
   * 呼び出し側が保証したときだけ（Idempotency-Key の付与など）。
   */
  idempotent?: boolean;
};

/**
 * 主体を名乗らずに取れるものの指定。
 *
 * @remarks
 * 共有キャッシュへ入れられるのはこちらだけです。
 */
type PublicRequestSpec<T> = BaseRequestSpec<T> & {
  /** Next.js のキャッシュ指定。指定しなければキャッシュしない。 */
  cache?: RequestCache;
  /** キャッシュの再検証に使うタグ。 */
  tags?: readonly string[];
};

/**
 * 主体に紐づくものの指定。
 *
 * @remarks
 * **キャッシュの指定を型として持ちません。**「PII を共有キャッシュへ入れるな」を注意書きでは
 * なく引数の不在にするのが、この分類の目的です（0112 決定 1）。それでもキャッシュしたい値の
 * 扱いは `docs/rules.md`「データ分類と機微情報」の「サーバへ保存されるキャッシュから user-scoped な
 * 取得の口を引かない」が持ちます。
 */
type UserScopedRequestSpec<T> = BaseRequestSpec<T> & { cache?: never; tags?: never };

type RequestSpec<T> = PublicRequestSpec<T> | UserScopedRequestSpec<T>;

/**
 * 主体を名乗らずに取れるものを運ぶ client。
 *
 * @remarks
 * 要求を 1 件送り、契約の形へ通した応答を返します。失敗はすべて分類済みのエラーになり、
 * 生の status は表に出ません。
 */
export type PublicHttpClient = {
  request<T>(spec: PublicRequestSpec<T>): Promise<T>;
};

/** {@link PublicHttpClient} の user-scoped 版。キャッシュの指定を受け取らない。 */
export type UserScopedHttpClient = {
  request<T>(spec: UserScopedRequestSpec<T>): Promise<T>;
};

/** 分類によらず要る、接続先ごとの実行環境。 */
type BaseClientDeps = {
  baseUrl: string;
  /**
   * 1 つの要求 URL に許すバイト数の上限。既定を持たない。
   *
   * @remarks
   * 何を数え、閾値をどこが持つかは [adapters](../../README.md) の「URL の予算」節が持ちます。
   */
  maxUrlBytes: number;
  profile?: ResilienceProfile;
  fetchImpl?: typeof fetch;
  /**
   * 経過時間を測る時計。既定は `performance.now`。
   *
   * @remarks
   * **壁時計を使いません。** 締切と遮断が見ているのは「どれだけ経ったか」であり、壁時計は
   * NTP の補正で前後へ飛びます。飛んだ幅がそのまま引き算に入るため、まだ余裕のある要求が
   * 期限切れとして捨てられたり、閉じたはずの遮断が即座に開いたりします。単調に進む時計だけが
   * この引き算に耐えます。
   */
  now?: () => number;
  /**
   * 壁時計。既定は `Date.now`。
   *
   * @remarks
   * `Retry-After` が日時で来たときの差にだけ使います。相手が名指しているのは実世界の時刻なので
   * （RFC 9110 §10.2.3）、ここだけは経過時間の時計では答えられません。
   */
  wallClockNow?: () => number;
  random?: () => number;
  sleep?: (ms: number) => Promise<void>;
};

/**
 * 資格情報の解決方法。どちらか一方だけを指定できる。
 *
 * @remarks
 * 型で排他にしているのは、両方を渡した実装が「どちらの資格情報で出ていくか」を読む側に推測
 * させるためです。
 */
type UserScopedCredential =
  | {
      /**
       * 認証済みの呼び出しに付ける Bearer の取得口。渡さなければ認証なしで送る。
       *
       * @remarks
       * ヘッダの組み立てをこの境界が持つのは、呼び出し側が個別に `Authorization` を
       * 作らないようにするためです。接続先ごとに認証が要るかどうかが決まるので、
       * 指定はクライアントの生成時に 1 度だけ行います。
       *
       * **要求のたびに `cookies()` から解決する口を渡します**（0112 決定 5）。解決済みの値を掴む
       * と、cached scope の中で `cookies()` が読まれなくなり、framework 側の防御
       * （`next-request-in-use-cache`）が何も言わずに外れます。
       *
       * @returns 認証できないときは null
       */
      getBearerToken?: () => Promise<string | null>;
      bearerToken?: never;
    }
  | {
      getBearerToken?: never;
      /**
       * 解決済みの Bearer。
       *
       * @remarks
       * **session を確立する途中の 1 往復だけの口です。** その時点では cookie がまだ無く、
       * 通常の取得口（cookie から Bearer を組む）は存在しません。綴りを分けてあるのは、
       * 上の防御が外れる箇所を数えられるようにするためです（0112 決定 5 の例外）。
       */
      bearerToken: string;
    };

/**
 * 主体を名乗らずに取れるものだけを運ぶ口。
 *
 * @remarks
 * **資格情報の口を持ちません。** 認証が要る接続先は {@link UserScopedClientDeps} を選びます。
 */
type PublicClientDeps = BaseClientDeps & {
  scope: "public";
  getBearerToken?: never;
  bearerToken?: never;
  allowAnonymous?: never;
};

/** 主体に紐づくものを運ぶ口。 */
type UserScopedClientDeps = BaseClientDeps &
  UserScopedCredential & {
    scope: "user-scoped";
    /**
     * 認証を伴わない呼び出しを認める接続先の宣言。
     *
     * @remarks
     * 契約が資格情報の無い呼び出しを受け付ける場合だけ立てます。立てても、取得できた資格情報は
     * 常に載せます。無効な資格情報を伏せて匿名として通すと、失効に気づかないまま別の主体として
     * 扱われるためです。
     *
     * **立てても分類は動きません。** 資格情報を載せうる口は、載せなかった回も含めて
     * user-scoped です（0112 決定 3）。
     */
    allowAnonymous?: boolean;
  };

const JSON_CONTENT_TYPE = "application/json";
const FORM_CONTENT_TYPE = "application/x-www-form-urlencoded";

const NO_CONTENT_STATUS = 204;

/**
 * 応答の本文を読む。
 *
 * @remarks
 * `204` は本文を持たないと HTTP が定めている（RFC 9110 §15.3.5）ため、読みに行きません。
 * 空の本文を JSON として解釈しようとすると構文エラーになり、成功した呼び出しが失敗として
 * 表に出ます。
 */
async function readBody(response: Response): Promise<unknown> {
  return response.status === NO_CONTENT_STATUS ? undefined : response.json();
}

/**
 * 契約が詳細識別子を宣言している唯一の status。
 *
 * @remarks
 * `ErrorResponseWithDetails` を宣言した口だけが `details` を返せ、いまその宣言を持つのは `422` だけです。
 * 契約が増えたらここも増えます。
 */
const UNPROCESSABLE_ENTITY_STATUS = 422;

/**
 * 失敗した応答のうち、詳細識別子だけを読む形。
 *
 * @remarks
 * `message` も `code` も読みません。詳細は[同区画の README](README.md)。
 */
const errorDetailsSchema = z.object({ details: z.array(z.string()).optional() });

/**
 * 失敗した応答から、接続先が名指しした項目名を読む。
 *
 * @remarks
 * 読めない本文は「詳細が無い」に畳み、元の失敗をすり替えません。
 *
 * @returns 名指しされた項目名。読めなければ空
 */
async function readErrorDetails(response: Response): Promise<readonly string[]> {
  if (response.status !== UNPROCESSABLE_ENTITY_STATUS) {
    return [];
  }

  try {
    const parsed = errorDetailsSchema.safeParse(await response.json());

    return parsed.success ? (parsed.data.details ?? []) : [];
  } catch {
    return [];
  }
}

/** 指定された本文を、送出できる形と Content-Type の組へ変換する。本文が無ければ undefined。 */
function encodePayload(
  spec: RequestPayload,
): { headers: Record<string, string>; body: BodyInit } | undefined {
  if (spec.multipart !== undefined) {
    // Content-Type を組みません。multipart は各部を区切る境界文字列を header に含める必要があり、
    // その値を決めるのは本文を直列化する runtime です。手で付けると本文の境界と食い違います。
    return { headers: {}, body: spec.multipart };
  }

  if (spec.form !== undefined) {
    return {
      headers: { "Content-Type": FORM_CONTENT_TYPE },
      body: new URLSearchParams(spec.form).toString(),
    };
  }

  if (spec.body !== undefined) {
    return { headers: { "Content-Type": JSON_CONTENT_TYPE }, body: JSON.stringify(spec.body) };
  }

  return undefined;
}

/** 絶対 URL かどうか。scheme から始まるものを絶対と見なす。 */
const ABSOLUTE_URL_PATTERN = /^https?:\/\//i;

/**
 * パスを 1 階層上へ畳む区間。
 *
 * @remarks
 * `.` と `..` は URL の正規化で消費され、**組み立てたはずの路と違う路を叩かせます。**
 * 呼び出し側は可変の区間を `encodeURIComponent` で包みますが、この 2 つは符号化しても
 * そのまま残るため（どちらも未予約文字だけでできています）、包んだだけでは止まりません。
 *
 * 先頭を `/` で始めるのは、検査に掛ける前に路が正規化されているためです（{@link assertNoDotSegment}）。
 */
const DOT_SEGMENT_PATTERN = /\/\.{1,2}(?:\/|$)/;

/**
 * 路を組み立てる前に、畳み込む区間が無いことを確かめる。
 *
 * @remarks
 * **通した路をそのまま返します。** 先頭の `/` を補う整形も兼ねると、検査を通さずに組み立てる
 * 書き方が作れなくなります。
 *
 * 弾いたものは `invalid-argument` です。接続先の不調ではなく、渡された値が路として成り立って
 * いないためで、再試行しても結果は変わりません。
 *
 * @throws 畳み込む区間を含むとき
 */
function assertNoDotSegment(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;

  if (DOT_SEGMENT_PATTERN.test(normalized)) {
    throw createAppError(ErrorKind.INVALID_ARGUMENT, {
      cause: new Error("路を畳む区間は接続先の路に含められません"),
    });
  }

  return normalized;
}

/**
 * 接続先とパスを繋ぐ。
 *
 * @remarks
 * **接続先が持つパスを残します。** `new URL(path, baseUrl)` は絶対パスを渡すと base の path を
 * 捨てるため、`https://idp.example.com/realms/foo` のようにパスを持つ接続先では、その部分が
 * 落ちた URL を叩くことになります。OIDC の issuer は路を持ち得るもので（Discovery 1.0 §4 は
 * issuer にパスを連結した位置を well-known の場所と定めています）、実物の IdP でも起こります。
 *
 * **絶対 URL はそのまま使います。** Discovery が返す各エンドポイントは絶対 URL であり、それを
 * 接続先へ繋ぎ直す意味がありません。組み立てていない路なので、畳み込みの検査も掛けません。
 */
function buildUrl(
  baseUrl: string,
  path: string,
  searchParams?: RequestSpec<unknown>["searchParams"],
): URL {
  const url = ABSOLUTE_URL_PATTERN.test(path)
    ? new URL(path)
    : new URL(`${baseUrl.replace(/\/$/, "")}${assertNoDotSegment(path)}`);

  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (value === undefined) {
      continue;
    }

    for (const single of typeof value === "string" ? [value] : value) {
      url.searchParams.append(key, single);
    }
  }

  return url;
}

/**
 * バックエンドへの接続を 1 か所に集約したクライアントを作る。
 *
 * @remarks
 * 生の `fetch` を上位層へ散らさないための境界です。timeout・再試行・遮断・応答の検証・
 * エラーの正規化をここだけが持つことで、呼び出し側は「失敗したときに何が起きるか」を
 * 呼び出しごとに設計せずに済みます。
 *
 * 時刻・乱数・待機・fetch は引数で受け取ります。これらを内部で直接掴むと、再試行や遮断の
 * 振る舞いを実時間を待たずに検証できなくなります。
 */
export function createHttpClient(deps: PublicClientDeps): PublicHttpClient;
export function createHttpClient(deps: UserScopedClientDeps): UserScopedHttpClient;
export function createHttpClient({
  scope,
  baseUrl,
  maxUrlBytes,
  getBearerToken,
  bearerToken,
  allowAnonymous = false,
  profile = DEFAULT_PROFILE,
  // 既定を `fetch` そのものではなく呼び出し時の解決にする。クライアントは接続先ごとに
  // 1 つを長く使い回すため、生成時点の実装を握ると、後から差し込まれた実装（モックなど）に
  // 切り替わらない。
  fetchImpl = (input, init) => fetch(input, init),
  now = () => performance.now(),
  wallClockNow = Date.now,
  random = Math.random,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
}: PublicClientDeps | UserScopedClientDeps): PublicHttpClient | UserScopedHttpClient {
  const breaker: CircuitBreaker = createCircuitBreaker(profile.breaker, now);
  const budget: RetryBudget = createRetryBudget(profile.retryBudgetRatio);

  /**
   * 認証ヘッダを解決する。認証を要求する接続先で認証できなければ、送らずに投げる。
   *
   * @remarks
   * 再試行の外側で 1 度だけ呼びます。試行のたびに解決すると、認証できないことが接続の失敗と
   * 同じ扱いになり、通るはずのない要求を最大試行回数ぶん送ります。
   *
   * **接続先と生成元が違えば載せません。** 絶対 URL を渡された要求は接続先を離れるため、
   * 載せると資格情報がその宛先へ渡ります。宛先は Discovery のような外の応答から来ることが
   * あり、呼び出し側が相対パスしか渡さない慣習だけでは止まりません。
   */
  async function authorizationHeader(url: URL): Promise<Record<string, string>> {
    const carriesCredential = getBearerToken !== undefined || bearerToken !== undefined;

    if (!carriesCredential || url.origin !== new URL(baseUrl).origin) {
      return {};
    }

    const token = bearerToken ?? (await getBearerToken?.()) ?? null;

    if (token === null) {
      if (allowAnonymous) {
        return {};
      }

      throw createAppError(ErrorKind.UNAUTHENTICATED, {
        cause: new Error(`認証が要る接続先です: ${url}`),
      });
    }

    return { Authorization: `Bearer ${token}` };
  }

  async function attempt(
    url: URL,
    spec: RequestSpec<unknown>,
    signal: AbortSignal,
    authorization: Record<string, string>,
  ): Promise<Response> {
    const timeout = AbortSignal.timeout(profile.perAttemptTimeoutMs);
    const payload = encodePayload(spec);

    return fetchImpl(url.toString(), {
      method: spec.method ?? "GET",
      signal: AbortSignal.any([signal, timeout]),
      headers: { ...payload?.headers, ...spec.headers, ...authorization },
      body: payload?.body,
      cache: spec.cache,
      next: spec.tags === undefined ? undefined : { tags: [...spec.tags] },
    });
  }

  return {
    async request<T>(spec: RequestSpec<T>): Promise<T> {
      assertSpecWithinScope(scope, spec);
      assertNoCredentialHeader(spec.headers);

      const url = buildUrl(baseUrl, spec.path, spec.searchParams);

      // 遮断の判定より先に確かめる。予算を超えた要求は接続先の状態によらず通らないため、
      // 遮断中に投げる `unavailable` で覆うと、直せる入力の誤りが一時的な障害に見える。
      assertRequestTargetWithinBudget(`${url.pathname}${url.search}`, maxUrlBytes);

      if (!breaker.canAttempt()) {
        throw createAppError(ErrorKind.UNAVAILABLE, {
          cause: new Error(`接続先が遮断されています: ${spec.path}`),
        });
      }

      const authorization = await authorizationHeader(url);
      const deadline = now() + profile.overallTimeoutMs;
      const overall = AbortSignal.timeout(profile.overallTimeoutMs);
      const retryable = isRetryableMethod(spec.method ?? "GET", spec.idempotent ?? false);
      let lastError: Error = new Error(`応答がありません: ${spec.path}`);
      let lastKind: ErrorKind = ErrorKind.UNAVAILABLE;
      let lastDetails: readonly string[] = [];

      for (let count = 1; count <= profile.maxAttempts; count += 1) {
        let response: Response | undefined;

        try {
          response = await attempt(url, spec, overall, authorization);
        } catch (cause) {
          lastError = cause instanceof Error ? cause : new Error(String(cause));
          lastKind = overall.aborted ? ErrorKind.CANCELED : ErrorKind.UNAVAILABLE;
          // 分類と詳細が別々の試行のものにならないよう捨てる（0080 §2）。
          lastDetails = [];
        }

        if (response?.ok === true) {
          breaker.record(true);
          budget.record(true);

          return parse(spec.schema, await readBody(response), spec.path);
        }

        breaker.record(false);
        budget.record(false);

        if (response !== undefined) {
          lastKind = toErrorKind(response.status);
          lastError = new Error(`${spec.method ?? "GET"} ${spec.path} が失敗しました`);
          lastDetails = await readErrorDetails(response);
        }

        const canRetry =
          retryable &&
          count < profile.maxAttempts &&
          isRetryableOutcome({ status: response?.status }) &&
          budget.canRetry() &&
          !overall.aborted;

        if (!canRetry) {
          break;
        }

        const delay =
          retryAfterDelayMs(response?.headers.get("Retry-After") ?? null, wallClockNow()) ??
          backoffDelayMs(count, random);

        // 待った先が全体の期限を越えるなら、待たずに諦める。期限に間に合わない再試行は
        // 接続先へ負荷を足すだけで、呼び出し側には何も返せない。
        if (now() + delay >= deadline) {
          break;
        }

        await sleep(delay);
      }

      throw createAppError(lastKind, {
        cause: lastDetails.length === 0 ? lastError : withErrorDetails(lastError, lastDetails),
      });
    },
  };
}

/**
 * 応答を契約の形へ突き合わせる。
 *
 * @remarks
 * 検証に失敗した応答は契約破れであり、通信の失敗と区別して `internal` として扱います。
 * 送り直しても直らないため再試行の対象にもしません。
 */
function parse<T>(schema: ZodType<T>, payload: unknown, path: string): T {
  const result = schema.safeParse(payload);

  if (!result.success) {
    throw createAppError(ErrorKind.INTERNAL, {
      cause: new Error(`応答が契約と一致しません: ${path}`, { cause: result.error }),
    });
  }

  return result.data;
}
