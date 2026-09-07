# 表現層の防御

この文書は、この表現層が**自分で持っている防御**を通しで説明する。持っているのは 2 つの面で、**ブラウザへ配る面**（配信ヘッダ・CSP・バンドルへ入る値）と、**後ろから来た値の扱い**（分類と置き場・上流由来の値への線引き・リッチテキスト）である。入口（`src/proxy.ts`）はその 2 つの面が交わる場所として扱う。

判断は ADR が持つ。ヘッダと CSP の本体は [ADR 0111](../adr/0111-csp-security-headers.md)、値の分類は [ADR 0112](../adr/0112-data-classification-cache-boundary.md)、env の境界は [ADR 0030](../adr/0030-environment-variable-management.md)、入口の責務は [ADR 0043](../adr/0043-middleware-policy.md) が正で、ここはそれらを**実装の在り処と落とし穴**から読み直す。CI 側の検査（秘密スキャン・SAST・依存監査・DAST の配線）は [ADR 0110](../adr/0110-security-operations.md) と [`.github/workflows/README.md`](../../.github/workflows/README.md) が持つので再掲しない。認証の往復そのものは [ADR 0079](../adr/0079-auth-frontend-seam.md) の持ち分で、ここに出てくるのは「入口がそれをどう扱うか」だけである。

## 全体の形

防御は 1 か所に集めず、**値が通る道のりの段ごと**に置いてある。どの段も他の段が見えないものを見ている（[ADR 0112](../adr/0112-data-classification-cache-boundary.md) 決定 4）ので、1 つを読んで「ここが守っている」と結論しない。

```text
ブラウザ ──(要求)──▶ proxy.ts ──▶ Route Handler / 画面 / Server Action ──▶ adapters/server ──▶ バックエンド
                     │  停止 / 送信元 / 楽観判定          │ 確定認可 / 本体の上限        │ 分類 / 資格情報 / 応答検証
                     ▼                                     ▼                              ▼
ブラウザ ◀──(応答)── next.config.ts headers() ◀── 描画（taint）◀── 取得の口（型・関門）◀── zod 検証
                     配信ヘッダ / CSP
```

要求に依らないものは**配信の側**（`next.config.ts`）、要求に依るものは**入口**（`src/proxy.ts`）、値に依るものは**取得の口**（`adapters/server/http`）に置く。この 3 つの分担を先に押さえると、どこに何が無いかも読める。

## 配信ヘッダと CSP

### どこで宣言しているか

**要求に依らないヘッダは全部 `next.config.ts` の `headers()` が付ける。** 対象は `source: "/:path*"` で、中身は [`src/config/security-headers/security-headers.ts`](../../src/config/security-headers/security-headers.ts) の `buildSecurityHeaders()` が組み立てる。CSP・`X-Frame-Options`・`X-Content-Type-Options`・`Referrer-Policy`・`Permissions-Policy`・`Cross-Origin-*`・HSTS がここに載る。

値のうち環境で変わるものは、**検証済みの ENV から導く**。ヘッダの文字列へ配信元を直接書く場所は無い。

| 入力 | 出所 | 効く先 |
| --- | --- | --- |
| `mediaOrigin` | `MEDIA_ORIGIN` | `img-src` |
| `authIssuer` | `AUTH_ISSUER` | `form-action`（ログインの form が IdP へリダイレクトされる先） |
| `servesOverTls` | `AUTH_REDIRECT_URI` の scheme（`isServedOverTls()`） | HSTS と `upgrade-insecure-requests` を出すか |
| `development` | `next dev` かどうか（phase） | `script-src` に `'unsafe-eval'` を足すか |
| `gtmContainerId` | `NEXT_PUBLIC_ANALYTICS_GTM_CONTAINER_ID` | Google の配信元を `script-src` / `connect-src` / `img-src` に足し、`Cross-Origin-Embedder-Policy` を**出さない** |

最後の行が示すとおり、**同梱するタグマネージャの有無でヘッダの形が変わる**。容器 ID が空の配備では `Cross-Origin-Embedder-Policy: require-corp` が出て cross-origin isolation が立ち、空でない配備では出ない。どちらが正しいかは配備が決めることで、判断は `security-headers.ts` が 1 か所で持つ。

**要求に依るヘッダは `src/proxy.ts` が持つ。** 資格情報を載せた要求への `Cache-Control: private, no-store` と、宣言した別 origin への `Access-Control-*` の 2 種類である（後述「入口」）。`headers()` で足すと全応答に載ってしまい、`proxy.ts` で足すと前捌きを通らない静的応答から漏れる、という**向きの違い**で置き場が決まっている。

### nonce を使うと何が起きるか

CSP の `script-src` は `'self' 'unsafe-inline'` である。**nonce は使っていない。** Next.js 自身が RSC payload を inline script（`self.__next_f.push`）として吐くため、nonce も hash も無い構成で inline を許すにはこれしか無い。

nonce を使う道（[ADR 0111](../adr/0111-csp-security-headers.md) §4 の seam B）を採ると、`src/proxy.ts` が要求ごとに nonce を生成し、Next.js が全 script に付ける。その瞬間に**全 route が dynamic rendering になる**。静的な殻は配れず、CDN キャッシュも ISR も効かず、このリポジトリが有効にしている Cache Components（[rendering.md](rendering.md)「このリポジトリは有効にしている」）と両立しない。「CSP を厳しくしたい」という要件は、配信モデルごと入れ替える判断を伴う。

`Content-Security-Policy-Report-Only` も経由していない。段階導入の代わりに、違反は次項の検査が実ブラウザで見つける。

### 宣言と実際の配信を突き合わせる検査

宣言（`next.config.ts`）と、ブラウザが受け取るもの、ブラウザが enforce した結果は**3 つの別の事実**で、それぞれ別の検査が見る。

| 事実 | 検査 | 在り処 |
| --- | --- | --- |
| 組み立てが宣言どおりか | 単体テスト | [`security-headers.test.ts`](../../src/config/security-headers/security-headers.test.ts)。容器 ID の有無・TLS の有無の両方の配備を固定する |
| 応答に載っているか | DAST（OWASP ZAP baseline） | `dast.yaml`（`make dast`）。既知の欠落は [`.github/zap/rules.tsv`](../../.github/zap/rules.tsv) に理由と撤回条件つきで並び、**一覧に無い所見は赤** |
| ブラウザが enforce しているか | E2E の見張り | [`e2e/lib/test.ts`](../../e2e/lib/test.ts) が `securitypolicyviolation` を document で受け、**全 spec・全描画エンジン**で違反を数える |
| enforce が効いている証拠 | E2E の spec | [`e2e/journeys/csp.spec.ts`](../../e2e/journeys/csp.spec.ts) が宣言に無い配信元の script を差し、違反が報告されることを確かめる |

**CSP の違反は console の見張りには掛からない。** ブラウザ自身が書く行は引数を持たず、見張りが「JavaScript が書いた行」だけを数える規則で外れる。だから `securitypolicyviolation` を別経路で受けている（[`e2e/README.md`](../../e2e/README.md)「何を異常と数えるか」）。`Report-Only` へ緩めると DAST は通るが `csp.spec.ts` が落ちる —— ヘッダを読む検査と enforce を見る検査が別に在るのはこのためである。

`next.config.ts` と `src/config/security-headers/` を触った変更は `scripts/deferred-checks/recommend.ts` が `run-e2e` を名指しする。ヘッダの変更を単体テストだけで通した気にならないように、実ブラウザの検査へ誘導している。

**CI はタグマネージャの容器 ID を空にして走る。** したがって Google の配信元を足す側の CSP と、`Cross-Origin-Embedder-Policy` が降りた状態は、実ブラウザでは検査されていない。単体テストが組み立てを固定しているだけである（[ADR 0110](../adr/0110-security-operations.md) §3.5）。

### 配信ヘッダの隣にあるもの

- `poweredByHeader: false` —— フレームワークと版を名乗らない
- `images.remotePatterns` —— `MEDIA_ORIGIN` の 1 host だけ。ワイルドカードを使わないのは、許した host が画像最適化の取りに行ける相手そのものだからである
- `experimental.taint: true` —— 描画時の漏洩防御。後述「データの分類と置き場」

## データの分類と置き場

### 分類は取得の口が持つ

値を包む型（`UserScopedData<T>` のようなもの）は無い。分類は**取得の口**が宣言し、[`src/adapters/server/http/request.ts`](../../src/adapters/server/http/request.ts) の `createHttpClient()` が `scope` を必ず受け取る。

| 分類 | 何か | 口が持てるもの |
| --- | --- | --- |
| `public` | 主体を名乗らずに取れるもの | `cache` / `tags`。資格情報の口（`getBearerToken` / `bearerToken`）は**型として存在しない** |
| `user-scoped` | 主体に紐づくもの | 資格情報の口。`cache` / `tags` は**型として存在しない** |
| secret | 署名鍵・トークン | この経路を通らない。`config/*.server.ts` に閉じる |

「PII を共有キャッシュへ入れるな」は注意書きではなく**引数の不在**になっている。不在は両側にあり、public の口には資格情報を載せる引数そのものが無い。だから分類を読めば「その口が資格情報を載せうるか」が言い当てられる。

**`allowAnonymous` は分類を動かさない。** 資格情報が取れたときは常に載せ、取れなかった回だけ匿名で送る宣言であって、口は user-scoped のままである。無効な資格情報を伏せて匿名として通すと、失効に気づかないまま別の主体として扱われる。

### 段ごとの関所

同じ事故を、値が通る段ごとに別の手段が止める。**どの段も、他の段が見えないものを見ている。**

| 段 | 止めるもの | 手段 | 在り処 |
| --- | --- | --- | --- |
| 取得の口 | user-scoped の口に `cache` / `tags` を渡す | 型 | `request.ts` の `UserScopedClientDeps` |
| 取得時 | 型を迂回して組んだ spec のキャッシュ指定、呼び出しごとに持ち込んだ `Authorization` / `Cookie` | 要求時に throw | [`data-scope.ts`](../../src/adapters/server/http/data-scope.ts) の `assertSpecWithinScope()` / `assertNoCredentialHeader()` |
| キャッシュ投入前 | `use cache` を持つモジュールが user-scoped の口を import する | ESLint | `project-rules/no-user-scoped-in-cached-module`。分類の綴りが残っていることは `scripts/scope-spelling.gate.test.ts` が見張る |
| 描画 | cached scope からの `cookies()` 読み出し | framework | `next-request-in-use-cache`。資格情報が cookie 由来であることに乗っている |
| client 送信前 | server の object と秘密値を Client Component へ渡す | taint | [`adapters/server/taint/taint.ts`](../../src/adapters/server/taint/taint.ts) |
| 配信 | 主体に紐づく応答が共有キャッシュへ載る | 応答ヘッダ | `src/proxy.ts` の `Cache-Control: private, no-store` |

**描画の段は 1 つの前提に乗っている** —— 資格情報が使用地点で `cookies()` から解決されること。解決済みの値を掴んで持ち回ると、cached scope の中で `cookies()` が読まれず、framework の防御は**何も言わずに**外れる。`request.ts` の `getBearerToken` に渡せるのが import した口だけ（ESLint `project-rules/no-captured-bearer-token`）なのは、この前提を検査可能にするためである。session を確立する 1 往復だけは cookie がまだ無く、`bearerToken` という別の綴りで解決済みの値を渡す。綴りを分けてあるのは、防御が外れる箇所を数えられるようにするためであって、渡してよい場所が増えたのではない。

**資格情報は接続先の外へ出ない。** `request.ts` の `authorizationHeader()` は、要求 URL の origin が `baseUrl` と違えば `Authorization` を付けない。絶対 URL は Discovery のような外の応答から来ることがあり、呼び出し側の慣習だけでは止まらない。

### taint が見ているもの・見ていないもの

taint は**参照でしか追わない**。`{ ...record }` のコピーや、項目を抜き出した文字列には及ばない。だから主防御ではなく、取得範囲と Client DTO の最小化を抜けた誤送信を実行時に捕まえる補助である。

登録している場所は 2 つで、どちらも**値が生まれる場所**である。

- session の記録 —— [`adapters/server/auth/session.ts`](../../src/adapters/server/auth/session.ts) の `readSessionRecord()` が復元した直後に `taintObjectReference()` を掛ける。Access Token と ID Token を含む記録そのものを Client Component へ渡すと、渡した時点で描画が落ちる
- session の署名鍵 —— [`adapters/server/auth/resolver.ts`](../../src/adapters/server/auth/resolver.ts) の `getSessionResolver()` が `taintUniqueValue()` で値そのものを登録する。`config` カーネルは `react` を持ち込めない（`imports-allowed: []`）ので、読む側が登録する。登録の寿命は値を持つ singleton（`AuthConfig`）が握る

内側の層へ渡してよいのは `verifySession()` が返す**身元だけ**である。トークンは `getAccessToken()` という別の口にあり、両方とも `adapters/server` の外へ記録を出さない。

### secret はどこに閉じるか

secret は取得の経路を通らず、`config/<purpose>/<purpose>.server.ts` に閉じる。守りは 3 つある。

1. **`import "server-only"`** —— client の束へ入った時点で build が落ちる。`*.server.ts` と名乗って番人を欠いたモジュールは `scripts/server-only.gate.test.ts` が見つける。層の依存表は import の向きしか見ておらず、server と client の区別を持たないので、この番人は別の軸で要る
2. **同梱の秘密値を実環境で拒む** —— [`config/auth/auth.schema.ts`](../../src/config/auth/auth.schema.ts) の `authSessionSecretValidator()` は、公開リポジトリに平文で載っている 2 つの値を `local` / `ci` 以外で受け付けない。設定し忘れは「値が無い」ではなく「既知の値が入っている」形で現れるため、長さだけを見る検証では通る。判定は起動時で、cookie を 1 枚も発行する前に止まる
3. **taint** —— 上記

`APP_ENV` が未指定のときは、同梱値を許す判定も `null` を返して**許さない側へ倒れる**。既定値へ落とす経路はどこにも無い（`load-environment.ts` の `findApplicationEnvironment()`）。

## `NEXT_PUBLIC_` の境界

### 何がバンドルへ入るか

`NEXT_PUBLIC_` の変数は、ビルド時に**参照箇所ごとのリテラルへ置換**される。ブラウザへ届くのは値そのものであり、実行時に差し替える手段は無い。いま入っているのは 3 つである。

| 変数 | 読む場所 | ブラウザで何に使うか |
| --- | --- | --- |
| `NEXT_PUBLIC_HTTP_MAX_URL_BYTES` | [`config/http/http.client.ts`](../../src/config/http/http.client.ts) | 要求 URL の上限。server 側と同じ変数を読むので閾値は env の 1 行 |
| `NEXT_PUBLIC_HTTP_MAX_UPLOAD_BYTES` | 同上 | 送る前に弾く。**受け口が同じ大きさをもう一度確かめる** —— ブラウザ側の判定は送信者が差し替えられる |
| `NEXT_PUBLIC_ANALYTICS_GTM_CONTAINER_ID` | [`config/analytics/analytics.client.ts`](../../src/config/analytics/analytics.client.ts) | 空なら同意ゲートの裏の要素そのものを描かない。容器 ID はタグを読む URL に現れる公開値で、秘密は容器の編集権限の側にある |

client config は `NEXT_PUBLIC_` の**静的ドット参照だけ**を持ち、そこでは検証しない。ブラウザは検証の実行点ではなく、置換されるのは検証を通った値そのものだからである。

### 何が入らないか

server config（`*.server.ts`）は runtime object であり、`server-only` の番人を持つ。`process.env` の直読は biome の `noProcessEnv` で禁じ、`config` カーネルと起動境界だけを override で外している。したがって「`process.env.SECRET` を Client Component から読む」書き方は lint で止まり、「server config を import する」書き方は build で止まる。

### ビルドが見つけるもの・見つけないもの

**見つける**:

- 全 ENV の検証 —— `next.config.ts` が `validateEnvironment()` を呼び、`NEXT_PUBLIC_` か否かを問わず全量を検証する。欠落も不正も build failure になる。ブラウザに未検証の値が置換されることは無い
- `server-only` の越境 —— client の束から server モジュールを引いた時点で落ちる
- client の束の重さ —— `scripts/client-schema-weight.gate.test.ts` が、検証ライブラリごと client へ載る import の形を見つける

**見つけない**:

- **server config の値を props で Client Component へ渡す書き方。** 値が `string` になった時点で `server-only` は効かず、taint も登録した値（署名鍵）にしか効かない。RSC payload として HTML へ直列化され、そのままブラウザへ出る。これは規約（[`docs/rules.md`](../rules.md)「設定と環境」）と、内側の層が config を import できない依存表で止めているのであって、build が見つけるものではない
- **派生値。** `` `Bearer ${token}` `` のような文字列は taint に登録していない

`serverActions.bodySizeLimit` は `NEXT_PUBLIC_HTTP_MAX_UPLOAD_BYTES` に封筒のぶん（32 KiB）を足した値である。**この上限は全 Server Action に効く。** Next.js は action ごとの上限を持たないので、ファイルのために上げた値がテキストしか受け取らない口にも効く。

## 入口 —— `src/proxy.ts` が持つもの・持たないもの

[`src/proxy.ts`](../../src/proxy.ts) は prefetch を含む全経路で走る前捌きで、順序は固定である。

1. **停止** —— `APP_MAINTENANCE_MODE` が立っていれば、`GET` / `HEAD` を停止画面へ rewrite し、それ以外を `503` で断る。停止画面自身と `/api/health` だけは通す。認可より先に置くのは、止めるのが全 route に対する 1 つの判断だからである
2. **送信元** —— `Origin` を `model/cross-origin` の `judgeOrigin()` で判定し、宣言（`HTTP_ALLOWED_ORIGINS`）に無い別 origin からの**状態を変えるメソッド**を handler へ届く前に `403` で止める
3. **CORS か楽観判定か** —— 宣言した別 origin から `/api/` へ来た要求には CORS ヘッダを付け（preflight には `204`）、それ以外は役割の楽観判定へ進む
4. **始末** —— 同意に紐づく計測 id の発行と撤去、資格情報を載せた要求への `Cache-Control: private, no-store`

### 持つもの

| 責務 | 実装 | 備考 |
| --- | --- | --- |
| 楽観的な認可 | `readOptimisticSession()` で cookie を復号し、`model/authz` の `allowedRolesFor()` に照らす | 未認証はログインへ（復帰先は `toSafeReturnUrl()` を通す）、役割不足は `/` へ。**ログインへ戻さない**のは、やり直しても同じ結果になるため |
| 保護する経路の宣言 | `model/authz` の `ROUTE_POLICIES` | **保護されている側を列挙する。** 公開側を列挙すると、足した画面が既定で公開になる。確定認可も同じ宣言を引く |
| 送信元の検証 | `judgeOrigin()` + `isStateChanging()` | 同一 origin の判定は **host だけ**（`X-Forwarded-Host` → `Host` の順）。TLS を終端する proxy の後ろでは scheme が食い違うため比べない。宣言した別 origin は origin の完全一致 |
| CORS | `openCors()` | `/api/` だけ。`Access-Control-Allow-Credentials: true` を返すので `*` は使えず、`Vary: Origin` を添える。preflight は求められたメソッドとヘッダをそのまま許す —— origin を許した時点で相手を信頼しており、一覧を別に持つと宣言が 2 つに割れる |
| 資格情報を載せた応答の `Cache-Control` | `finalize()` | session cookie を載せた要求、**または cookie を書き換えた応答**。後者を外すと、匿名で同意済みの訪問者へ計測 id を配る応答が CDN に固まり、以後の全員へ同じ id を配る |

### 持たないもの

- **確定認可。** データ源に最も近い所（`adapters/server/auth/session.ts` の `verifySession()`）が持ち、画面・Server Action・Route Handler がそれぞれ呼ぶ。前捌きは cookie を読むだけで、データ源を参照しない。Proxy が唯一の検査だと、Proxy を通らない経路（`matcher` の除外、Server Action の直接呼び出し）がそのまま穴になる
- **要求に依らないヘッダ。** `next.config.ts` の持ち分（前述）
- **レート制限・DDoS 緩和・WAF。** infra / edge の責務として名前付きで切ってある（[ADR 0077](../adr/0077-bff-abuse-protection-boundary.md)）。本体に残す最小の防御は、認証を要求しない Route Handler が本体を読む前に掛ける**型と大きさ**で、[`adapters/server/http/json-request.ts`](../../src/adapters/server/http/json-request.ts) の `readJsonBody()` が持つ。content-type が JSON を名乗らなければ `415`、宣言された長さが上限を超えれば読まずに `413`、宣言が無いか偽っていれば読んだ後の実測で `413`。**読む前に打ち切ることまではしない** —— 際限なく流し込まれる本体を止めるのは配信経路の役割である
- **開発専用の口の開閉。** `route.dev.ts` / `page.dev.tsx` は `pageExtensions` で build から外れ、残った成果物では [`adapters/server/auth/development-access.ts`](../../src/adapters/server/auth/development-access.ts) の `isDevelopmentAccessAllowed()` が `APP_ENV` と宛先（`Host` / `X-Forwarded-Host` が手元の名前であること）を見る。閉じているときは `404` で、存在を知らせない（[ADR 0113](../adr/0113-development-access-surface.md)）

### `matcher` が選ぶ範囲

`_next/static` / `_next/image` / `favicon.ico` と metadata ファイル（`icon` / `apple-icon` / `opengraph-image` / `sitemap.xml` / `robots.txt`）は前捌きを通らない。**通らない経路には `Cache-Control: private` も届かない。** 画像最適化に載るのが公開画像だけであることが、この除外の前提である。`/api` は除外していない —— Route Handler も保護の対象になり得る。

除外の綴りは末尾まで固定する。`icon` を接頭辞で外すと、その綴りで始まる画面を後から足したとき、その画面だけが前捌きを素通りする。

## 後ろから来た値の扱い

**この層は、上流（バックエンド・IdP・第三者）から来た値を網羅的に無害化しない。** 始末するのは**自分が作った値**だけである（[ADR 0070](../adr/0070-backend-role-separation.md) 境界値の所有）。

線引きの理由は、網羅しようとすると供給側の都合が表示側の構造へ染み出し、しかも完全にはならないことにある。「上流の値がこう来たら危ない」という指摘に対して表現層が答えられるのは、その値を**自分がどこへ置くか**であって、値の中身を洗うことではない。防ぎたいものは供給側か境界で閉じる。

実装の形で言うと、次のようになる。

| 場面 | やっていること | やっていないこと |
| --- | --- | --- |
| バックエンドの応答 | `adapters` 境界で生成 zod による**形の検証**（契約破れの検知）と、自前 view 型への詰め替え | 文字列の中身の無害化。応答に含まれる文言・パス・識別子はそのまま持ち回る |
| ブラウザ発の span の中継 | [`adapters/server/telemetry/browser-traces.ts`](../../src/adapters/server/telemetry/browser-traces.ts) の `redactAttributes()` が**属性の名前**で伏せる。名前の表は `logging` が持ち、ログと同じ表を使う | **値の中身は見ない。** 上流や第三者が組んだ URL の中まで洗い出さない。名前で持ち回っている限り効き、そうでないものは元の設計が誤っている |
| エラーの文言 | [`errors/redact.ts`](../../src/errors/redact.ts) の `redactMessage()` は**呼び出し元が名指しした値**（自分が持っているトークン等）だけを置き換える | バックエンド由来の例外文やスタックの走査 |
| エラーの `details` | wire へ出して安全な識別子だけを載せる（[`docs/rules.md`](../rules.md)「データ分類と機微情報」） | 入力値・理由文の伝搬 |
| 構造化データの埋め込み | [`components/design-system/display/json-ld`](../../src/components/design-system/display/json-ld/json-ld.tsx) が JSON の `<` を `\u003c` へ逃がす | —— |

最後の行は「上流の値を無害化している」ように見えるが、そうではない。**script の本文を組み立てているのは自分**であり、逃がしているのは自分が作った直列化の形である。値の出所がバックエンドである以上その中身を前提にできない、というのは「`</script>` が入っていても自分の出力が壊れない」ことの理由であって、値を清めているのではない。

同じ理由で、この層が**確かめてから持ち回る**のは自分が組む値である。復帰先は `model/return-url` の `toSafeReturnUrl()` が URL パーサに解かせた結果で同一 origin の相対パスだけを通し、以降は brand 型が検証済みであることを示す。`searchParams` は `model/search-params` が「届く形」を決め、何が正しい値かは読む側のスキーマが決める。cookie は用途ごとの属性を server 境界で明示する。どれも**値を作る側**の始末である。

**例外に見えるのがリッチテキストである。** 上流から来た HTML を、この層が sanitize してから描く。矛盾ではない —— sanitizer が持っているのは「上流の何が危ないか」の一覧（blocklist）ではなく、「**この層が描いてよいもの**」の一覧（allowlist）である。次節のとおり、それは表示側の仕様であって上流への対応ではない。

## リッチテキストの sanitize

### 経路

[`src/model/rich-text/`](../../src/model/rich-text/) は、未検査の HTML 文字列を「表示してよい範囲だけに絞った木」へ変換する port である。構築経路は `SanitizedRichText.from()` の 1 つに絞ってあり、この型を持つ値は sanitize を通ったことを型が保証する。

```text
HTML 文字列
  → hast-util-from-html（parse5、fragment として parse）
  → hast-util-sanitize（RICH_TEXT_SANITIZE_SCHEMA）
  → dropProtocolRelativeUrls()（後段）
  → SanitizedRichText（root: hast の Root）
  → RichTextContent が hast-util-to-jsx-runtime で React 要素へ
```

HTML 文字列へ戻す経路は無く、`RichTextContent` は `dangerouslySetInnerHTML` を props から**型で外している**。仕様準拠の parser で木にしてから木を検査するので、文字列置換の sanitizer が持つ parser の解釈差（sanitizer とブラウザで読み方が違う）を検査の前後で持ち込まない。

### schema が言っていること

[`rich-text.definition.ts`](../../src/model/rich-text/rich-text.definition.ts) の `RICH_TEXT_SANITIZE_SCHEMA` は、**schema の全項目を明示する**。`hast-util-sanitize` は未指定の項目を既定 schema で補完するため、明示しないと上流の既定が広がったときに通過範囲が黙って広がる。

- 通すタグはブロック 9 つとインライン 6 つ。`h1` は本文の見出しが page の `h1` と競合するので通さない
- 属性は `a` の `href` だけ。`style` も `class` も通らない —— だから「リッチテキストのために `style-src 'unsafe-inline'`」は成立しない
- `href` のプロトコルは `http` / `https` / `mailto`。相対 URL は残る
- `script` / `style` は**内容ごと**取り除く。それ以外の allowlist 外のタグは中身を残して展開される —— テキストの子要素がそのまま本文へ混ざるタグだけを `strip` に挙げている
- コメントと doctype は落とす。`li` は `ul` / `ol` の中にあるときだけ残る

`hast-util-sanitize` のプロトコル検査は `:` を含む値のスキームだけを見るため、`//host` は相対参照として素通りする。実体は閲覧中のページと同じ protocol で解決される外部ホストへの絶対 URL なので、`dropProtocolRelativeUrls()` が後段で落とす。editor 側の `isRichTextHrefAllowed()` も同じ判定を持ち、入力できるのに保存後に落ちる不整合を作らない。

### editor との対

「editor が出せるタグ ⊆ sanitizer が通すタグ」を保つ。allowlist・editor の extension 集合・test は 1 組で、片方だけを変えない。`RichTextEditor` は starter kit ではなく extension を個別に入れており、その集合は allowlist から導出する。

### 上限は無い

**入力サイズ・ノード数・深さの上限は実装に無い。** `SanitizedRichText.from()` は与えられた文字列をそのまま parse し、木の大きさで打ち切る段も、超えたときに fail-closed で拒む段も持たない。

これが効く範囲は入口で決まる。form から Server Action で受ける HTML は `serverActions.bodySizeLimit` が本体ごと上限を課すので、そこを超える入力は sanitizer へ届かない。バックエンドから取得して描く HTML には、その手前に上限が無い。parse5 は不正な入れ子も閉じ忘れも例外にせず正規化するので、大きさ以外の異常で落ちることは無いが、大きさに比例した時間と memory はそのまま掛かる。

### 制約

`SanitizedRichText` は class instance であり serializable ではない。**Client Component の props へ直接渡せない。** `root` を取り出せば渡せるが、その時点で「sanitize 済みである」ことの型保証は失われる。Client Component の内側へ置くなら、Server Component で描いた結果を `children` として渡す。

木ベースの sanitize は冪等なので、`RichTextContent` は表示のたびに `SanitizedRichText.from()` を通してよく、二重適用で content が壊れることは無い。

## 間違えやすいところ

### 「CSP を敷いた」と「strict CSP を敷いた」は別である

`script-src` に `'unsafe-inline'` が残っている。これは Next.js 自身の inline script を許すための弱い許可で、DAST の既知欠落一覧（`.github/zap/rules.tsv` の `10055`）にも載っている。strict にする道は nonce（全 route が dynamic になる）か hash（Next.js の実験的 SRI）で、どちらも今の配信モデルを変える。「CSP がある」ことを根拠に inline script の注入を心配しなくてよい、とは言えない。

### `proxy.ts` にヘッダを足しても静的応答には載らない

前捌きを通る経路にしか効かない。要求に依らないヘッダを足したくなったら `security-headers.ts` へ行く。逆に `matcher` が除外している `_next/image` は、cookie を載せた要求でも framework の `Cache-Control`（`public, max-age=...`）のまま配られる。**主体固有の画像を `next/image` に載せた瞬間、その画像は CDN で共有される。**

### 送信元の検証は認証ではない

`Origin` を持たない要求は same-origin として通る。ブラウザ以外の client や同一 origin の `GET` には `Origin` が無いためで、これは CSRF（**被害者のブラウザが被害者の cookie を載せて**別サイトから送る）を止める検査であって、資格情報の検証ではない。認可は `verifySession()` が別に行う。`Origin: null`（sandbox された iframe やリダイレクト越し）は文字列の `"null"` で届き、`new URL()` が拒むので untrusted になる。

### CORS が開くのは `/api/` だけである

宣言した別 origin から画面の経路を `fetch` しても CORS ヘッダは付かず、preflight も素通しになる。読むだけの要求は 403 にしないので、「通ったのに読めない」という見え方になる。

### 楽観判定を通ったことは、認可されたことではない

`proxy.ts` は cookie を復号して役割を見るだけで、その役割が今も正しいかはデータ源の側でしか分からない。画面が描かれた後の Server Action は画面を経由せずに呼べるので、**入口ごとに** `verifySession()` を呼ぶ。片方だけ閉じても閉じたことにならない。

### `allowAnonymous: true` は public ではない

匿名でも呼べる口を public にしたくなるが、資格情報を載せうる口は載せなかった回も含めて user-scoped である。「匿名でも取れるものを共有キャッシュへ」入れたいなら、**口を分ける**のが条件になる。

### taint はコピーに効かない

`readSessionRecord()` が汚すのは記録の参照そのものである。`{ ...record }` も `record.accessToken` も汚れていない。内側へ渡してよいのは `verifySession()` の返り値だけ、という約束が主で、taint はそれを抜けたときの補助である。「taint が有効なので大丈夫」は成り立たない。

### `bearerToken` に解決済みの値を渡すと、防御が黙って外れる

`getBearerToken` へ import した口ではなく、その場で組んだ関数や引数で持ち回った値を渡すと、cached scope の中で `cookies()` が読まれず、framework の `next-request-in-use-cache` は発火しない。エラーにならず、**主体の値が共有キャッシュへ入る**。ESLint が形を止めるが、規則を外せば止まらない。

### `NEXT_PUBLIC_` は起動時に差し替わらない

ビルド時にリテラルへ置換される。PaaS の環境変数を変えても再ビルドしなければ効かない。逆に、動的アクセス（`process.env[name]`）や分割代入は置換が効かず `undefined` になる。client 側で検証していないのは手抜きではなく、検証を通った値だけが置換されるからである。

### タグマネージャを有効にすると cross-origin isolation を失う

容器 ID を入れた配備では `Cross-Origin-Embedder-Policy` が出ない。`SharedArrayBuffer` のような isolation を前提とする機能はその構成では使えない。しかもこの側の CSP は CI の実ブラウザで検査されていない。

### `dangerouslySetInnerHTML` の例外は 2 か所ある

`JsonLd`（JSON を script の本文として埋める）と `ChartStyle`（系列色を CSS 変数として `<style>` へ配る）で、どちらも biome の `noDangerouslySetInnerHtml` を理由つきで外している。共通点は、**中身が自分の直列化か開発者の定数**であることで、利用者入力や API 応答をそこへ渡さない。3 つ目を足すなら同じ形でなければならず、リッチテキストの描画はここに含まれない。

### 開発専用の口は `APP_ENV` 未指定で閉じる

`isDevelopmentOnlyEndpointOpen()` は `APP_ENV` が `local` / `ci` のときだけ true で、未指定は既定へ落ちずに false になる。同梱の秘密値も同じ判定で拒まれるので、`APP_ENV` を付けずに起動すると、口が閉じるより前に起動そのものが止まる（env ファイルを選べないか、同梱の秘密値が拒まれる）。開発の入口（`pnpm dev` / `pnpm storybook`）は script が `local` を渡している。宛先（`Host`）の判定は防御線ではなく、設定を誤ったまま公開したときに普通の利用者が普通に踏む経路を止めるだけである。

### `SanitizedRichText` は Client Component へ渡せない

class instance は RSC の直列化を通らない。`root` を抜いて渡すと sanitize 済みの保証が型から消える。Client Component の内側に本文を置くなら、描いた結果を `children` で渡す。

### sanitizer に大きさの上限は無い

前節のとおり。上限を足すなら `SanitizedRichText.from()` の入口に置き、超えたら空にするのではなく**拒む**形にする —— 黙って空にすると、本文が消えた理由が誰にも見えない。

## 関連する ADR

- [0111](../adr/0111-csp-security-headers.md) — CSP と同伴ヘッダの本体。seam A（静的）を既定にし、nonce は opt-in とする判断
- [0112](../adr/0112-data-classification-cache-boundary.md) — 分類を取得の口に持たせる判断と、段ごとの関所
- [0030](../adr/0030-environment-variable-management.md) — env の検証点、`NEXT_PUBLIC_` の境界、`server-only` + taint の 2 段構え
- [0043](../adr/0043-middleware-policy.md) — `proxy.ts` は薄い last resort。楽観判定に限り、確定認可はデータ境界
- [0077](../adr/0077-bff-abuse-protection-boundary.md) — レート制限 / WAF を edge へ切り、本体には型と大きさの最小防御だけを残す判断
- [0079](../adr/0079-auth-frontend-seam.md) — 前捌きは防御線ではない。確定認可の側が持つ
- [0113](../adr/0113-development-access-surface.md) — 開発専用の口。制御面と安全を別の軸で決める
- [0080](../adr/0080-error-handling.md) — 秘匿情報を含むエラーの redact
- [0131](../adr/0131-cookie-consent.md) — 第三者 script を同意ゲートの裏に置く。CSP の外部オリジンと連動
- [0110](../adr/0110-security-operations.md) — CI 側の検査（秘密スキャン・SAST・依存監査・DAST）。ここでは再掲しない
