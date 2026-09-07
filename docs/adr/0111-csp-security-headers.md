# CSP・セキュリティヘッダ(実行時)

実行時のブラウザ側防御 —— **Content-Security-Policy(CSP)のポリシー本体 / enforce seam / レスポンスセキュリティヘッダの既定セットと配置先(`next.config.ts` の `headers()` vs `src/proxy.ts` vs PaaS/CDN)** を定める。[0110](0110-security-operations.md) が CI / ビルド時点で払える防御(サプライチェーン・SAST・秘密スキャン)を収録するのに対し、本 ADR は **実行時(リクエスト応答時)にしか払えない防御** の本体を 1 本に束ね、局所推論の起点を集約する。

## Status

Accepted

## 背景

後付けの CSP は既存の inline script / style との衝突で最も導入コストが高く、初期に方針を固めておく価値が高い。[0043](0043-middleware-policy.md) は「Proxy でヘッダ操作が可能」とのみ述べ、ポリシー本体・配置方針を持たない。

CSP 適合の検査は **CI 時点で払える**ため [0110](0110-security-operations.md) §3.5 が持ち、本 ADR はポリシー内容・seam・配置という **実行時本体**だけを所有する。両者は両輪であり、片側だけでは閉じない。

本リポジトリは **Next.js 16 / React 19**。`node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md` が定める前提は次のとおり。

- **nonce ベース CSP は `src/proxy.ts` で per-request に nonce を生成**し、Next.js が SSR 時に framework script・ページ JS・生成 inline・`<Script nonce>` へ自動付与する
- **nonce を使うと全ページが dynamic rendering を要求**する。静的最適化・ISR・CDN キャッシュが無効になり、**Partial Prerendering(Cache Components)とは非互換**である
- **nonce を使わない CSP は `next.config.ts` の `headers()`** で静的に付与できる。Next.js 自身の inline script(RSC payload の `self.__next_f.push`)を許すには `'unsafe-inline'` が要る。静的を保ったまま厳格化する道は hash ベース(実験的 SRI)である
- 静的なセキュリティヘッダは **`next.config.ts` の `headers()`** で宣言的に付与でき、レンダリングモードに依存しない

## 決定

### 1. 標準準拠と非ロックインの位置づけ([0010](0010-standards-and-non-lockin.md) 適用)

- CSP・各セキュリティヘッダは **W3C / IETF の Web プラットフォーム標準**(CSP Level 3 / RFC 6797 HSTS / Referrer-Policy / Permissions-Policy / Cross-Origin-* isolation)であり、**ブラウザが enforce する**。seam(ヘッダを吐く場所)は Next.js のデファクト(`next.config.ts` `headers()` / `proxy.ts` のヘッダ操作)に乗る([0010](0010-standards-and-non-lockin.md) §1・[0043](0043-middleware-policy.md))が、**防御の実体は Next.js に依存しない**。
- **vendor-independent 正当性材料**(0010 §2 の必須記載): CSP = XSS・clickjacking・コードインジェクションへの **多層防御**(`script-src` で任意スクリプト実行を、`frame-ancestors` / `X-Frame-Options` で clickjacking を、`object-src 'none'` / `base-uri 'self'` で注入面を絞る)/ HSTS = 中間者・ダウングレード攻撃の緩和 / `X-Content-Type-Options: nosniff` = MIME スニッフィング由来の XSS 緩和 / `Referrer-Policy` = リファラ経由の情報漏洩の最小化 / `Cross-Origin-Opener-Policy` + `Cross-Origin-Embedder-Policy` + `Cross-Origin-Resource-Policy` = 別 origin との文脈共有を閉じ、Spectre 系のサイドチャネルから隔離する。**運用テスト(0010 §2)**: 「Next.js を正当化から抜いても、これらのヘッダは正当か?」→ **Yes**(任意の HTTP サーバ・CDN 上で等価に有効)。

### 2. 既定で敷く静的ヘッダ(レンダリングモード非依存・`next.config.ts` `headers()`)

以下は **リクエスト内容に依存しない静的ヘッダ**であり、`next.config.ts` の `headers()` で全経路に付与する。組み立ては `src/config/security-headers/security-headers.ts` が持ち、値が ENV から来るものはそこで検証済みの値から導く。静的生成・SSR いずれとも両立し、[0040](0040-routing-rendering-strategy.md)「特定レンダリングモードを強制しない」を侵さない。

| ヘッダ | 値 | 備考 |
| --- | --- | --- |
| `X-Frame-Options` | `DENY` | CSP `frame-ancestors 'none'` と二重掛け。埋め込みが要る fork は緩める |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | 認証の往復がクエリに `code` / `id_token_hint` を載せる([0079](0079-auth-frontend-seam.md))。別 origin へは origin だけを送る |
| `X-Content-Type-Options` | `nosniff` | |
| `Permissions-Policy` | `accelerometer` / `camera` / `geolocation` / `gyroscope` / `magnetometer` / `microphone` / `payment` / `usb` を `()` | deny-by-default 寄りの最小許可。使う fork が開ける。`payment` を閉じるのは決済 UI をフロントに置かない前提([0076](0076-payment-ui-seam.md)) |
| `Cross-Origin-Opener-Policy` | `same-origin` | 別 origin の window から `opener` 経由で触れなくする。認証はリダイレクトで往復するため popup を要しない |
| `Cross-Origin-Embedder-Policy` | `require-corp` | 別 origin の副資源を `Cross-Origin-Resource-Policy` の無いまま読み込めなくする。**画像は `next/image` の最適化経路(同一 origin)を通るため影響を受けない。** 別 origin の iframe / script を差す fork は、この値から降りる判断を伴う |
| `Cross-Origin-Resource-Policy` | `same-origin` | 自分の応答を別 origin の文書へ埋め込ませない。効くのは `no-cors` の読み込み（`<img>` / `<script>` / nested navigation）だけで、§5 の CORS で開いた `fetch` には掛からない |
| `Strict-Transport-Security` | `max-age=31536000` | **https で配信しているときだけ出す**(下記)。1 年は preload list の下限と同じ値。`includeSubDomains` / `preload` の付与と PaaS/CDN 側での終端は **fork 先判断**(§5) |

**https で配信しているかの判定は `isServedOverTls()`(`src/config/auth/auth.schema.ts`)が持つ。** callback URL(`AUTH_REDIRECT_URI`)の scheme を読む —— あれは IdP がブラウザを戻す先、すなわち自分の origin であり、環境の種類を別の変数で持たずに scheme を知れる唯一の既存の値である。cookie の `secure`(`docs/rules.md` #44)と同じ述語を使い、綴りを 2 つにしない。

### 3. CSP ポリシー本体(ディレクティブ基線)

CSP の **ディレクティブ基線**を本 ADR の決定として固定する(Next.js 公式の例に準拠。vendor-independent な最小権限の具体化)。

```text
default-src 'self';
script-src 'self' 'unsafe-inline';            ← 開発サーバーだけ 'unsafe-eval' を足す
style-src 'self' 'unsafe-inline';
img-src 'self' blob: <MEDIA_ORIGIN の origin>;
font-src 'self';
connect-src 'self';
object-src 'none';
base-uri 'self';
form-action 'self' <AUTH_ISSUER の origin>;
frame-ancestors 'none';
upgrade-insecure-requests                      ← https で配信しているときだけ
```

- **`img-src` の配信元は検証済み ENV(`MEDIA_ORIGIN`)から組み立てる。** ここへ直接書くと、環境変数と設定の 2 か所が別々に動き、片方だけ直した状態を作れる。`blob:` はアップロード前の preview(`URL.createObjectURL`)が使う。`data:` は使う箇所が無いので載せない —— `placeholder="blur"` を採る fork が足す
- **`form-action` に IdP の origin を含める。** ログインは form の送信で始まり、その応答が IdP へリダイレクトする。Chromium は form の送信先だけでなく、その先のリダイレクト先にも `form-action` を適用するため、`'self'` だけだと認可要求が止まる
- **`'unsafe-eval'` は開発サーバーだけ。** React が server 側のエラースタックをブラウザで組み直すのに eval を使う。本番の React も Next.js も eval を使わない
- **`upgrade-insecure-requests` は https で配信しているときだけ。** http の開発環境で出すと `http://localhost` の副資源まで https へ書き換えられる
- **`connect-src 'self'`**: ブラウザからの送信先は BFF(`/api/*`)に限る。観測性のシグナルも中継 seam を通る([0081](0081-observability-logging.md))。OTLP を直接叩かせない
- **外部オリジン**(タグマネージャ・分析 SDK 等)は、[0131](0131-cookie-consent.md) §2 の同意ゲートと連動して `script-src` / `connect-src` / `img-src` に載る。**同梱するタグマネージャのぶんは本体が宣言し、それ以外を足すのは fork の拡張点**とする。サードパーティスクリプト規約は `docs/rules.md` #50
- **`Cross-Origin-Embedder-Policy` は降ろす。** `require-corp` は副資源に `Cross-Origin-Resource-Policy` か CORS を要求するが、タグマネージャが注入するタグの配信元はそれを返さない。**cross-origin isolation を失うことを受け入れた結果**であり、`SharedArrayBuffer` 等の isolation を前提とする機能はこの構成では使えない。isolation が要る fork は容器 ID を空にして本ヘッダを戻す
- **`Content-Security-Policy-Report-Only` は経由しない。** 違反は CI が実ブラウザで検知する(§6)ので、可視化のためだけの段階導入は要らない。外部オリジンを足す fork が衝突を見たいときの手段として残す

### 4. enforce seam = seam A(静的・`next.config.ts`)

CSP は「別ドメイン(infra / backend)の責務」ではなく **表示層が吐く実行時防御** なので、**名前付きの拡張点を 2 系統敷き、seam A を既定にする**。

- **seam A(既定・静的)= `next.config.ts` `headers()` に非 nonce CSP。** inline は `'unsafe-inline'` で許す。**レンダリングモードを固定しない**([0040](0040-routing-rendering-strategy.md))。
- **seam B(opt-in・strict)= `src/proxy.ts` で per-request nonce。** `strict-dynamic` + nonce の strict CSP を敷けるが、**全ページを dynamic rendering に固定**し、静的最適化・ISR・CDN キャッシュ・Cache Components を犠牲にする。厳格な脅威モデル(`'unsafe-inline'` 禁止のコンプライアンス要件)を持つ fork が **明示的に opt-in** する拡張点として名前を与える。
- **seam A を確定した理由**: [0041](0041-cache-components-decision.md) が Cache Components を v1 で採用しており、nonce はこれと両立しない。nonce を既定にすると [0040](0040-routing-rendering-strategy.md)「モードを強制しない」・[0043](0043-middleware-policy.md)「Proxy は薄い last resort」の双方に反する。boilerplate は**開いておく**側に倒し、strict 化は fork の選択に委ねる。
- **`script-src` の `'unsafe-inline'` は弱い許可であり、strict CSP ではない。** 静的を保ったまま厳格化する道は nonce ではなく hash ベース(Next.js の実験的 SRI)である。実験的機能は採らない([0004](0004-library-management.md))。**撤回条件**: SRI が stable になり、Next.js 自身の inline script(RSC payload)を hash で許せるようになった時点で、seam A のまま `'unsafe-inline'` を外す。
- **`style-src` は `style-src-elem` / `style-src-attr` に割らない。** 属性側は Radix の popper(`position` / `transform` / `--radix-popper-*`)と `next/image`(`color: transparent`)が要素の `style` 属性へ書くため、`'unsafe-inline'` から降りられない。要素側だけ厳格にする案は、動的な内容の `<style>` 要素(`components` の chart が系列色を CSS 変数として配る)と TipTap の runtime 注入(`injectCSS`)が hash で許せず、Safari が割った指定を持たず `style-src` へフォールバックするため、費用に対して得るものが薄い。リッチテキストの sanitizer は `style` 属性を通さない(`src/model/rich-text`)ので、**「リッチテキストのために `'unsafe-inline'`」は成立しない**。**撤回条件**: chart が変数を要素の `style` 属性へ移し、TipTap を `injectCSS: false` にし、[0102](0102-browser-support.md) の支持ブラウザが割った指定を揃えて持った時点で、要素側を `'self'` へ絞る。
- seam B を採る場合も [0043](0043-middleware-policy.md) の制約を守る: `proxy.ts` は薄く保ち、nonce 生成とヘッダ設定に限る。`matcher` で prefetch・静的アセット(`_next/static` 等)を除外する。

### 5. ヘッダ配置先の分担(`next.config.ts` vs `proxy.ts` vs PaaS)

| ヘッダ種別 | 既定の配置先 | 備考 |
| --- | --- | --- |
| 静的ヘッダ(§2) | `next.config.ts` `headers()` | リクエスト非依存。宣言的・実行時コストなし |
| 非 nonce CSP(seam A) | `next.config.ts` `headers()` | 静的・CDN 両立(既定) |
| nonce CSP(seam B) | `src/proxy.ts` | per-request。opt-in。dynamic 固定 |
| **資格情報を載せた要求への `Cache-Control`** | **`src/proxy.ts`** | **要求に依る**(下記) |
| **許可した別 origin への `Access-Control-*`** | **`src/proxy.ts`** | 要求の `Origin` に依る。宣言は `HTTP_ALLOWED_ORIGINS`(下記) |
| **origin 検証(許可外 origin からの書き込みを 403)** | **`src/proxy.ts`** | 同じ宣言を読む。`docs/rules.md` #47 |
| HSTS の終端強制 | **PaaS/CDN も可(境界 seam)** | edge で一括付与する構成もある。二重掛けの整合は fork が確認 |

- **要求に依らないヘッダを `proxy.ts` で足さない。** 前捌きを通る経路にしか載らず、静的に配れる応答が漏れる。
- **資格情報を載せた要求への応答は `Cache-Control: private, no-store`。** [0112](0112-data-classification-cache-boundary.md) 段 5(配信)の実体で、主体に紐づく応答が CDN / プロキシの共有キャッシュへ載り別の主体へ配られる事故を、応答ヘッダで止める。**判定は要求の側で行う** —— session cookie を載せた要求は、その応答が何であれ主体に紐づく。画面や Route Handler ごとに書かせず、宣言を持たない handler にも届く。代償はログイン済み利用者への静的画面が CDN で共有されないことで、これは 0112 の優先順位(機密性 > キャッシュ効率)どおりである。framework が動的な応答に付ける `no-store` はアプリ内側の判断で、静的に固まった応答には付かない —— 主体に紐づく画面が誤って固まった回に効くのは、この段だけである。**届く範囲は `proxy.ts` の `matcher` が選ぶ経路に限る** —— 除外している `_next/static` / `_next/image` / `favicon.ico` は cookie を載せた要求でも framework 自身の `Cache-Control`（画像最適化は `public, max-age=...`）のまま配られる。同梱の画像最適化経路には公開画像しか載せていないため成立している前提であり、主体固有の画像を `next/image` に載せる fork は、この除外を見直すか配信元で `private` を返す。
- **別 origin へ開く口は 1 つの宣言で持つ。** `HTTP_ALLOWED_ORIGINS`(`config/http`)に挙げた origin だけに、`src/proxy.ts` が BFF(`/api/*`)の応答へ `Access-Control-Allow-Origin` / `Access-Control-Allow-Credentials` / `Vary: Origin` を返し、preflight に 204 で答える。credentials を許すのは BFF の口が session cookie で主体を判定するためで、`*` は使えない。**既定は空 = 同一 origin だけ**であり、ブラウザから叩く先は BFF に限る(§3 `connect-src 'self'`)ので、この構成では宣言する相手が居ない。別 origin の SPA / 管理画面が BFF を叩く fork が、その origin を宣言する。
- **同じ宣言が書き込みの送信元を決める。** `Origin` を持つ要求のうち、自分自身(host が `X-Forwarded-Host` / `Host` と一致)でも宣言した origin でもないものからの状態を変えるメソッド(`GET` / `HEAD` / `OPTIONS` 以外)は、handler へ届く前に 403 で止める。**自分自身の判定は host だけで行い、scheme を比べない** —— TLS を終端するリバースプロキシの後ろでは、自分が見る要求は http でも `Origin` は https で届く。host は `X-Forwarded-Host` を先に読み、無ければ `Host` を使う(Next.js が Server Action の送信元を確かめるのと同じ順)。一方、宣言した別 origin は **origin の完全一致**で、scheme・host・port のどれか 1 つでも違えば別物として扱う。読むだけの要求は止めない —— CORS ヘッダを付けないので、ブラウザ側で応答を読めない。「読ませる相手」と「書かせる相手」を別々の宣言にすると、片方だけ開けた状態を作れる。Server Action は Next.js 自身が `Origin` と `Host` を突合しており、リバースプロキシで Host が書き換わる配備だけが `serverActions.allowedOrigins` を要する。判定は `src/model/cross-origin.ts` が持つ。
- **PaaS/CDN での付与は「境界 seam」**として認める(HSTS・一部の静的ヘッダは配送層で終端する構成が現実的)。boilerplate 本体は `next.config.ts` を SSOT とするが、**PaaS 側と重複・矛盾しない**ことを fork がデプロイ時に確認する(同一ヘッダの二重付与を避ける)。

### 6. CI 適合スライスは 0110 が持つ(本 ADR は実行時本体)

- **配信ヘッダの有無・妥当性は DAST(OWASP ZAP baseline)が見る**([0110](0110-security-operations.md) §3.5)。読むのは成果物ではなく応答であり、`next.config.ts` が宣言したものと ブラウザが実際に受け取るものは別の事実である。
- **違反の検知は E2E の見張りが持つ**(`e2e/lib/test.ts`)。CSP の違反はブラウザ自身が console へ書くため通常の console の見張りには掛からず、`securitypolicyviolation` イベントで受けて数える。全 spec・3 つの描画エンジンに効く。enforce されていることは、宣言に無い配信元の script を差して違反が報告されることで示す(`e2e/journeys/csp.spec.ts`)。`Report-Only` へ緩めるとヘッダを読むだけの検査は通るが、この spec は通らない。
- `next.config.ts` と `src/config/security-headers/` の変更は `run-e2e` を名指しする(`scripts/deferred-checks/recommend.ts`)。

## 禁止事項

- ❌ nonce ベース CSP(`proxy.ts`)を boilerplate の **既定**にすること(全経路を dynamic に固定し [0040](0040-routing-rendering-strategy.md)「モード非強制」と [0041](0041-cache-components-decision.md) に反する。strict 化は fork の opt-in = seam B)
- ❌ CSP・セキュリティヘッダを「Next.js が推奨するから」だけで正当化すること([0010](0010-standards-and-non-lockin.md) §2)
- ❌ seam の形(nonce の載せ方・ヘッダ配置)を独自発明・中立化すること([0010](0010-standards-and-non-lockin.md) §1。Next.js デファクト = `headers()` / `proxy.ts` に乗る)
- ❌ `proxy.ts` に nonce 生成・ヘッダ設定以外の業務ロジックを書くこと([0043](0043-middleware-policy.md) 薄い境界)
- ❌ 要求に依らないヘッダを `proxy.ts` に置くこと(静的に配れる応答から漏れる)
- ❌ CSP を「別ドメインの責務」として沈黙で省略すること(表示層の実行時防御。seam A/B を名前付きで敷く)
- ❌ `script-src` / `style-src` に `'unsafe-inline'` を残したまま「strict CSP を敷いた」と称すること(弱い許可の明示。strict を謳うなら nonce か SRI へ)
- ❌ 配信元(`MEDIA_ORIGIN` / `AUTH_ISSUER`)を CSP へ直接書くこと(検証済み ENV から組み立てる)
- ❌ 主体に紐づく応答の `Cache-Control` を画面や handler ごとに書くこと(`proxy.ts` が要求の側で一律に付ける)
- ❌ `Access-Control-Allow-Origin: *` や、CORS の許可と書き込みの許可を別々の宣言で持つこと(§5)
- ❌ Route Handler ごとに CORS ヘッダや origin 検証を書くこと(`proxy.ts` が宣言から一律に付ける)

## 補足

- **CSRF / Server Actions の origin 検証**(`serverActions.allowedOrigins` / SameSite cookie 前提)は **`docs/rules.md` #47(主 Rationale [0070](0070-backend-role-separation.md))** に置き、本 ADR には**同居させない**。本 ADR は CSP・レスポンスヘッダの実行時本体に射程を限る。
- 本 ADR は [0140](0140-documentation-operations.md) のタクソノミーで **decision** 分類に属する。日常強制される rule(サードパーティスクリプト #50・XSS/サニタイズ #48 等)は `docs/rules.md` 側に置き、本 ADR を Rationale として逆参照する。

## 関連 ADR

- [0010-standards-and-non-lockin.md](0010-standards-and-non-lockin.md) — 標準準拠(seam は Next.js デファクトに乗る)+ 非ロックイン正当化(vendor-independent 材料の必須記載)。本 ADR の判断軸
- [0110-security-operations.md](0110-security-operations.md) — CI/ビルド時点の防御(shift-left)。CSP 適合の CI ゲート(§3.5)を持つ
- [0112-data-classification-cache-boundary.md](0112-data-classification-cache-boundary.md) — データ分類とキャッシュ境界。段 5(配信)の実体を本 ADR §5 が持つ
- [0043-middleware-policy.md](0043-middleware-policy.md) — `proxy.ts` = 薄い last resort。seam B と `Cache-Control` の実装制約
- [0040-routing-rendering-strategy.md](0040-routing-rendering-strategy.md) — レンダリングモード非強制。nonce CSP を既定にしない根拠
- [0041-cache-components-decision.md](0041-cache-components-decision.md) — Cache Components は v1 採用。nonce と非互換のため seam A を確定する根拠
- [0076-payment-ui-seam.md](0076-payment-ui-seam.md) — 決済 UI はフロントに置かない。`Permissions-Policy` の `payment` と `Cross-Origin-Embedder-Policy` の前提
- [0131-cookie-consent.md](0131-cookie-consent.md) — 同意ゲート(外部スクリプトの CSP allowlist と連動)
- [0070-backend-role-separation.md](0070-backend-role-separation.md) — #47 CSRF/origin 検証の主 Rationale(本 ADR には同居させない)
