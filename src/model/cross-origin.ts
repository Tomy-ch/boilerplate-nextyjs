/** origin の判定に要る、要求の断片。 */
export type OriginRequest = {
  /** `Origin` ヘッダ。ブラウザ以外の client や同一 origin の GET では無い。 */
  readonly origin: string | null;
  /** 自分の host。リバースプロキシの後ろでは `X-Forwarded-Host`、無ければ `Host`。 */
  readonly host: string | null;
};

/** 要求の origin をどう扱うか。 */
export type OriginVerdict =
  /** `Origin` が無いか、自分自身から来た。 */
  | { readonly kind: "same-origin" }
  /** 宣言で許した別 origin から来た。CORS ヘッダを返す。 */
  | { readonly kind: "allowed"; readonly origin: string }
  /** 許していない別 origin から来た。 */
  | { readonly kind: "untrusted" };

/** 読むだけのメソッド。cross-site から来ても状態を変えない。 */
const SAFE_METHODS: ReadonlySet<string> = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * preflight の答えをブラウザが覚えてよい秒数。
 *
 * @remarks
 * 宣言を変えたあと、古い答えが残る最長の時間でもあります。Chromium の上限（2 時間）より
 * 短く、Firefox の上限（24 時間）の内側に取ります。
 */
const PREFLIGHT_MAX_AGE_SECONDS = 600;

/**
 * `Origin` ヘッダの値を origin として読む。読めなければ null。
 *
 * @remarks
 * `Origin: null`（sandbox された iframe やリダイレクト越しの要求）は文字列の `"null"` で届きます。
 * `new URL()` が拒むので、ここで null になり、どの origin とも一致しません。
 */
function parseOrigin(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

/**
 * 要求がどの origin から来たかを判定する。
 *
 * @remarks
 * 同一 origin の判定は **host だけ**で行います。scheme を比べないのは、TLS を終端する
 * リバースプロキシの後ろでは自分が見る要求が http でも `Origin` は https で届くためです。
 * host は `X-Forwarded-Host` を先に読み、無ければ `Host` を使います —— Next.js が Server Action の
 * 送信元を確かめるのと同じ順です。
 *
 * 許可する別 origin は **origin の完全一致**です。scheme・host・port のどれか 1 つでも違えば
 * 別物として扱います。
 *
 * @param request - 要求の断片
 * @param allowedOrigins - 宣言で許した別 origin（`HTTP_ALLOWED_ORIGINS`）
 */
export function judgeOrigin(
  request: OriginRequest,
  allowedOrigins: readonly string[],
): OriginVerdict {
  if (request.origin === null) {
    return { kind: "same-origin" };
  }

  const origin = parseOrigin(request.origin);

  if (origin === null) {
    return { kind: "untrusted" };
  }

  if (request.host !== null && origin.host === request.host) {
    return { kind: "same-origin" };
  }

  if (allowedOrigins.includes(origin.origin)) {
    return { kind: "allowed", origin: origin.origin };
  }

  return { kind: "untrusted" };
}

/** 状態を変えうるメソッドか。 */
export function isStateChanging(method: string): boolean {
  return !SAFE_METHODS.has(method.toUpperCase());
}

/**
 * 許可した別 origin への応答に付ける CORS ヘッダ。
 *
 * @remarks
 * `Access-Control-Allow-Credentials: true` を返すため、`Access-Control-Allow-Origin` に `*` は
 * 使えません。origin をそのまま返し、キャッシュが別の origin へ同じ応答を配らないよう
 * `Vary: Origin` を添えます。
 *
 * @param origin - 許可した別 origin（{@link judgeOrigin} が返したもの）
 */
export function corsHeadersFor(origin: string): Readonly<Record<string, string>> {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    Vary: "Origin",
  };
}

/**
 * 許可した別 origin からの preflight（`OPTIONS`）への応答に付けるヘッダ。
 *
 * @remarks
 * 求められたメソッドとヘッダをそのまま許します。origin を許した時点でその相手を信頼して
 * おり、メソッドやヘッダの一覧を別に持っても、宣言が 2 つに割れるだけです。
 *
 * @param origin - 許可した別 origin
 * @param requestedMethod - `Access-Control-Request-Method`
 * @param requestedHeaders - `Access-Control-Request-Headers`。無ければ載せない
 */
export function preflightHeadersFor(
  origin: string,
  requestedMethod: string | null,
  requestedHeaders: string | null,
): Readonly<Record<string, string>> {
  return {
    ...corsHeadersFor(origin),
    "Access-Control-Allow-Methods": requestedMethod ?? "GET",
    ...(requestedHeaders === null ? {} : { "Access-Control-Allow-Headers": requestedHeaders }),
    "Access-Control-Max-Age": String(PREFLIGHT_MAX_AGE_SECONDS),
  };
}
