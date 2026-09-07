/** 応答ヘッダ 1 件。`next.config.ts` の `headers()` が受け取る形。 */
export type ResponseHeader = {
  readonly key: string;
  readonly value: string;
};

/** 配信ヘッダを組み立てる材料。検証済みの ENV と、配信の条件。 */
export type SecurityHeaderInputs = {
  /** 画像の配信元（`MEDIA_ORIGIN`）。`img-src` に載せる。 */
  readonly mediaOrigin: string;
  /** 認可要求の送り先（`AUTH_ISSUER`）。`form-action` に載せる。 */
  readonly authIssuer: string;
  /** 自分が https で配信されているか。HSTS と `upgrade-insecure-requests` を出す条件。 */
  readonly servesOverTls: boolean;
  /** 開発サーバーか。React が eval を要求する。 */
  readonly development: boolean;
  /**
   * タグマネージャの容器 ID（`NEXT_PUBLIC_ANALYTICS_GTM_CONTAINER_ID`）。
   *
   * @remarks
   * **解釈せずに渡します。** 空が「読み込まない」を意味することの判定はここが持ちます —— 呼び出し
   * 側で真偽値へ潰すと、同じ意味づけが渡す側と受ける側の 2 か所に現れます。他の項目
   * （`mediaOrigin` / `authIssuer`）も検証済みの生値のまま受けています。
   */
  readonly gtmContainerId: string;
};

/**
 * タグマネージャとその先のタグが使う配信元。
 *
 * @remarks
 * **容器 ID を宣言した配備にだけ載せます**（空の意味は `config/analytics/analytics.schema.ts`）。
 * 外した配備で開けたままにすると、読み込まないもののために攻撃面だけが残ります。
 *
 * `googletagmanager.com` は容器そのものと、そこから読み込まれる Google 製タグの配信元です。
 * `google-analytics.com` は計測の送り先で、こちらは `connect-src` と `img-src` にだけ要ります
 * —— 送信は `fetch` / `sendBeacon` か、それが使えない環境では 1×1 の画像で行われるためです。
 */
const TAG_MANAGER_SCRIPT_ORIGIN = "https://www.googletagmanager.com";

/**
 * 計測の送り先。
 *
 * @remarks
 * **ワイルドカードだけを挙げます。** `*.google-analytics.com` は `www.google-analytics.com` も
 * 含むので、代表的なホストを別に並べても増えるのは行数だけです。地域別のホスト
 * （`region1.google-analytics.com` 等）へ振り分けられるため、いずれにせよワイルドカードが要ります。
 */
const TAG_MANAGER_COLLECT_ORIGINS = [
  "https://*.google-analytics.com",
  "https://*.analytics.google.com",
] as const;

/**
 * 外部への遷移で `Referer` に載せてよい範囲。
 *
 * @remarks
 * 同一 origin へは URL 全体、別 origin へは origin だけを送り、降格（https → http）では何も
 * 送りません（[0111](../../../docs/adr/0111-csp-security-headers.md) §2 /
 * [0079](../../../docs/adr/0079-auth-frontend-seam.md)）。
 */
const REFERRER_POLICY = "strict-origin-when-cross-origin";

/** 使わない強力な機能を明示して閉じる。使うならテンプレートから作った側が開ける。`payment` を閉じる理由は [0076](../../../docs/adr/0076-payment-ui-seam.md)。 */
const PERMISSIONS_POLICY = [
  "accelerometer=()",
  "camera=()",
  "geolocation=()",
  "gyroscope=()",
  "magnetometer=()",
  "microphone=()",
  "payment=()",
  "usb=()",
].join(", ");

/**
 * https で配信されている間、ブラウザに http を使わせない期間。
 *
 * @remarks
 * 1 年は preload list の下限と同じ値です。`includeSubDomains` と `preload` は配信構成の判断
 * なので付けません（[0111](../../../docs/adr/0111-csp-security-headers.md)）。
 */
const STRICT_TRANSPORT_SECURITY = "max-age=31536000";

/**
 * Content-Security-Policy を組み立てる。
 *
 * @remarks
 * 内容の根拠は [0111](../../../docs/adr/0111-csp-security-headers.md) §3 が持ちます。ここに書くのは、
 * 値が ENV から来る箇所と、条件で変わる箇所の理由だけです。
 *
 * - `img-src` の配信元は ENV から組み立てます。ここへ直接書くと、環境変数と設定の 2 か所が別々に
 *   動きます。`blob:` はアップロード前の preview（`URL.createObjectURL`）が使います
 * - `form-action` に IdP の origin を含めます。ログインは form の送信で始まり、その応答が IdP へ
 *   リダイレクトします。Chromium は form の送信先だけでなく、その先のリダイレクト先にも
 *   `form-action` を適用するため、`'self'` だけだと認可要求が止まります
 * - `'unsafe-eval'` は開発サーバーだけに付けます。React が server 側のエラースタックを組み直すのに
 *   eval を使うためで、本番の React も Next.js も eval を使いません
 * - `upgrade-insecure-requests` は https で配信しているときだけ出します。http の開発環境で出すと、
 *   `http://localhost` の副資源まで https へ書き換えられて取得できなくなります
 */
function buildContentSecurityPolicy({
  mediaOrigin,
  authIssuer,
  servesOverTls,
  development,
  gtmContainerId,
}: SecurityHeaderInputs): string {
  const loadsTagManager = gtmContainerId !== "";
  const tagManagerScript = loadsTagManager ? [TAG_MANAGER_SCRIPT_ORIGIN] : [];
  const tagManagerCollect = loadsTagManager
    ? [TAG_MANAGER_SCRIPT_ORIGIN, ...TAG_MANAGER_COLLECT_ORIGINS]
    : [];

  const directives: readonly (readonly [string, readonly string[]])[] = [
    ["default-src", ["'self'"]],
    [
      "script-src",
      ["'self'", "'unsafe-inline'", ...(development ? ["'unsafe-eval'"] : []), ...tagManagerScript],
    ],
    ["style-src", ["'self'", "'unsafe-inline'"]],
    ["img-src", ["'self'", "blob:", new URL(mediaOrigin).origin, ...tagManagerCollect]],
    ["font-src", ["'self'"]],
    ["connect-src", ["'self'", ...tagManagerCollect]],
    ["object-src", ["'none'"]],
    ["base-uri", ["'self'"]],
    ["form-action", ["'self'", new URL(authIssuer).origin]],
    ["frame-ancestors", ["'none'"]],
    ...(servesOverTls ? [["upgrade-insecure-requests", []] as const] : []),
  ];

  return directives.map(([name, sources]) => [name, ...sources].join(" ")).join("; ");
}

/**
 * 全経路に付ける配信ヘッダ。
 *
 * @remarks
 * どれも要求の内容に依存しません。`next.config.ts` の `headers()` に置くのはそのためで、
 * `src/proxy.ts` で足すと前捌きを通る経路にしか載らず、静的に配れる応答が漏れます
 * （[0111](../../../docs/adr/0111-csp-security-headers.md) §5）。要求に依るヘッダ（資格情報を
 * 載せた要求への `Cache-Control`）は `src/proxy.ts` が持ちます。
 *
 * **`Cross-Origin-Embedder-Policy` は、タグマネージャを読み込む配備（`gtmContainerId` が空でない）
 * では出しません。読み込まない配備では出したままにします。** 理由と、それによって失うものは
 * [0111](../../../docs/adr/0111-csp-security-headers.md) §5 が持ちます。
 *
 * @param inputs - 検証済みの ENV と配信の条件
 * @returns `headers()` の `headers` にそのまま渡せる一覧
 */
export function buildSecurityHeaders(inputs: SecurityHeaderInputs): ResponseHeader[] {
  return [
    { key: "Content-Security-Policy", value: buildContentSecurityPolicy(inputs) },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: REFERRER_POLICY },
    { key: "Permissions-Policy", value: PERMISSIONS_POLICY },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    ...(inputs.gtmContainerId === ""
      ? [{ key: "Cross-Origin-Embedder-Policy", value: "require-corp" }]
      : []),
    { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
    ...(inputs.servesOverTls
      ? [{ key: "Strict-Transport-Security", value: STRICT_TRANSPORT_SECURITY }]
      : []),
  ];
}
