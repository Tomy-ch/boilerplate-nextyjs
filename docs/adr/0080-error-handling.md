# エラーハンドリング

[0020](0020-adopted-architecture.md) / [0021](0021-frontend-responsibility.md) で枠を予約した **`errors` カーネル** の中身を確定する。**protocol-agnostic なエラー分類(sentinel)/ 境界での HTTP status 正規化 / App Router のエラー特殊ファイル階層 / `loading.tsx`・Suspense 境界 / swallow 禁止・cause chain / ログ出力タイミング** を定める。

## Status

Accepted

## 背景

App Router の `error.tsx` / `not-found.tsx` / `global-error.tsx` の責務・Error Boundary 階層・バックエンドエラーの正規化・ログ出力タイミングは、決めずに置くと feature ごとに別の形で書かれる。本 ADR がこれらを確定する。

エラー分類を **transport に依存しない sentinel** として定義し、**プロトコルへの写像は境界(edge)でのみ**行い、**swallow 禁止 / cause chain 優先 / redact** を規約化する —— 分類が HTTP を知ると `model` が HTTP を知ることになり、写像が散ると同じ status が場所ごとに別の分類へ落ちる。本 ADR はこの構造を表示層へ敷く。

## 決定

### 1. `errors` カーネル: protocol-agnostic な sentinel 分類

- `errors` カーネルに **transport 非依存のエラー分類(sentinel)** を定義する。HTTP status やレスポンス形式はここに持たない
- 分類は全層から参照可([0021](0021-frontend-responsibility.md) errors。`model` が依存してよい唯一のカーネル)
- HTTP に関連する分類(表示層で扱うもの)。sentinel の一次キーは **HTTP status**(曖昧さがない)とし、安定エラーコードは分類ごとに `errors` カタログが持つ(下記「エラーコード語彙」参照):

| sentinel(分類) | 安定エラーコード | HTTP status | 系統 |
| --- | --- | --- | --- |
| InvalidArgument | `BAD_REQUEST` | 400 | ユーザ起因 |
| Unauthenticated | `UNAUTHENTICATED` | 401 | ユーザ起因 |
| PermissionDenied | `FORBIDDEN` | 403 | ユーザ起因 |
| NotFound | `NOT_FOUND` | 404 | ユーザ起因 |
| Conflict | `RESOURCE_CONFLICT` | 409 | ユーザ起因 |
| PayloadTooLarge | `PAYLOAD_TOO_LARGE` | 413 | ユーザ起因 |
| UriTooLong | `URI_TOO_LONG` | 414 | ユーザ起因 |
| UnsupportedMediaType | `UNSUPPORTED_MEDIA_TYPE` | 415 | ユーザ起因 |
| Validation | `VALIDATION_FAILED` | 422 | ユーザ起因 |
| TooManyRequests | `TOO_MANY_REQUESTS` | 429 | ユーザ起因 |
| Canceled | `CANCELED` | 499 | ユーザ起因 |
| Unavailable | `SERVICE_UNAVAILABLE` | 503 | システム起因(リトライ含意) |
| Unimplemented | `NOT_IMPLEMENTED` | 501 | システム起因 |
| Internal | `INTERNAL` | 500 | システム起因 |

- **worker 向けの分類(再試行可能 / 恒久 / 致命)は採らない**。メッセージング worker 固有の軸であり、表示層は HTTP taxonomy のみを持つ
- **エラーコード語彙はこの repo が持つ**: 上表のコードは分類ごとに `errors` カタログが生成する**この repo の語彙**であり、**wire へ出ることは無い**(route が返す失敗は文言だけを載せる)。境界も接続先の `code` を読まない(下記 2)。**契約は `ErrorResponse.code` の値域を宣言していない**(`type: string`)ため、生成物から突き合わせる手段も無い。したがってバックエンドの綴りへ機械的に寄せることはせず、**分類の意味に対して正しい名前を選ぶ**(401 は認証が成立していないので `UNAUTHENTICATED`、403 は認可の拒否なので `FORBIDDEN`)。エラーコードは wire contract の値ではないため、[0028](0028-naming-convention.md) の「命名の権威をバックエンドに置かない」がそのまま効く。人がログを突き合わせるときの対応は HTTP status で取れる —— 一次キーが status であることが、綴りの一致より確実な対応づけになる。フロント内部で追加の分類ラベルが要る場合も、この語彙と競合させない
- **`Canceled`(status 499・非標準)を独立分類として採る**。fetch の中断([0071](0071-bff-api-integration.md) の dual timeout / `AbortSignal`)は失敗ではなく打ち切りであり、システム起因の失敗へ畳むと再試行の対象になる
- **`UriTooLong`(414)を `PayloadTooLarge`(413)と分けて持つ**。要求の本体が大きいのと、条件を載せた URL が長いのとでは、利用者が減らすべきものが違う。畳むと「送信するデータが大きすぎます」しか出せず、条件を減らせばよいことが伝わらない

### 2. 境界での HTTP status 正規化(1 回のみ)

- バックエンド応答の生 HTTP status → sentinel 分類 + 安定エラーコード + ユーザ向けメッセージ への変換は、**`adapters` 境界で 1 回だけ**行う([0071](0071-bff-api-integration.md) の「生 status を errors へ正規化」の詳細 = 本 ADR)
- **生 HTTP status・生エラーを内層 / UI へ漏らさない**([0071](0071-bff-api-integration.md) と一致)。未知エラーは `Internal`(500)へ矯正する
- ユーザ向けメッセージは日本語(AGENTS.md Language Rules)。メッセージ本文は分類ごとにカタログが持つ(本 ADR は分類とコードの対応表を定める)
- **失敗した応答の本文から読むのは `details` だけ。** 契約が詳細識別子を宣言した status（`ErrorResponseWithDetails`
  を宣言した口）に限って本文を読み、`ErrorMeta.details` へ載せる。項目名を表示名へ写すのは feature / form の側。
  **`message` は読まない** —— 接続先が選んだ文言をそのまま出すことになり、こちらが選んでいない文字列が利用者へ
  出る（文言は分類ごとにカタログが持つ）。**`code` も読まない** —— `ErrorResponse.code` に値域の宣言が無いため、
  綴りで分岐しても契約を再生成して食い違いを検出できない。分類の一次キーは HTTP status のままとする
- **失敗応答の追加情報として境界が持つのは `requestId` と `details` の 2 つ**とする。`traceId` / `correlationId`、
  `fieldErrors` のようなオブジェクト配列、その他の形は採らない。接続先がそれらを採る場合は、`adapters` の応答変換と
  `ErrorMeta` を契約に合わせて変える —— 内層は `ErrorMeta` しか見ないので、変える場所はそこに閉じる
- **本文を読めなかったことで、元の失敗をすり替えない。** 本文が JSON でない・契約と違う形であることは経路上
  起こり得るが、いずれも「詳細が無い」に畳む。応答を得られなかった試行は、前の試行が名指しした項目を
  引き継がない（分類と詳細が別々の試行のものになる）
- **クライアント経路も同じ境界で分類する。** 同一オリジンの BFF を叩く `adapters/client` も生 status を
  そのまま投げ直さず、この対応表へ写す。特に `Unauthenticated`(401)を `Internal` へ畳まないこと ——
  畳むと呼び出し側は「再試行できる失敗」としか扱えず、資格情報が切れているのに読み直す操作しか
  出せない画面になる(再試行は 401 / 403 / 404 では誤り。`components/app-starter/auth-state-feedback`)
- **補助的な値の degrade は、画面ごとに決めさせず境界で 1 度畳む。** 表示のためだけにあり、
  読めなくても画面が成り立つ値(参考換算額のような添え物)は、`adapters` に「読めなければ `null`」を
  返す口を置き、投げる口も残す。画面ごとに try / catch を書かせると、同じ判断が画面の数だけ増え、
  片方だけが落ちる画面が生まれる。**逆に、落として良いかどうかが画面で割れる値は畳まない** ——
  畳めるのは「どの画面も同じ扱いをする」ことが言い切れるときだけである

### 3. App Router のエラー特殊ファイル階層

- `error.tsx`(セグメント境界の recovery UI)/ `global-error.tsx`(root layout のエラー)/ `not-found.tsx`(404)は、**正規化済みのエラーコード / メッセージを表示するだけ**の薄い境界とする。生エラー・スタックを画面へ漏らさない
- **production の redact 挙動に注意**(Next.js 公式 `error.js` file convention): production では **Server Component から throw されたエラーの `message` は redact され**、client の error boundary(`error.tsx`)には**汎用メッセージ + `error.digest`(サーバログ突合用の自動生成ハッシュ)のみ**が伝播する(Client Component 由来の throw は原文メッセージが渡る)。したがって「正規化済みメッセージの表示」を **throw 経路に頼らない**こと。ユーザ向けメッセージは次のいずれかで解決する:
  - (a) **期待エラー(主にユーザ起因 4xx 系)**: throw せず **Server Action の戻り値(ActionState / `useActionState`)として値で渡す**(公式ガイド「expected errors は return value でモデル化」。[0040](0040-routing-rendering-strategy.md) の Server Actions 採用と整合)
  - (b) **予期しないエラー(システム起因 5xx 系)**: `error.tsx` は汎用文言 + `digest` の表示にとどめ、`digest` と境界ログ(下記 6)の突合で原因を解決する

  いずれも本 ADR の分類(上記 1 の系統列)・境界正規化(上記 2)と両立する。どの feature がどちらを使うかは feature ごとに決める
- 配置は **`src/app/` 配下の route セグメント単位**(App Router の規約上、特殊ファイルは `app/` 配下でのみ機能する — [0027](0027-directory-structure.md)。特殊ファイル命名は [0028](0028-naming-convention.md))。Error Boundary の粒度はセグメント階層に従う。エラー表示の中身のコンポーネントは feature 側に置き、特殊ファイルからは薄く委譲する([0040](0040-routing-rendering-strategy.md) driving adapter 原則)
- `error.tsx` 等に**業務ロジックを書かない**([0040](0040-routing-rendering-strategy.md) driving adapter)

### 4. `loading.tsx` / Suspense ストリーミング境界

異常系 = `error.tsx`(上記 3)と対になる **正常系の待機表示 = `loading.tsx` / `<Suspense>` 境界** を、同じ「薄い表示境界」の規律に載せる:

- `loading.tsx`(セグメントの pending UI)と `<Suspense fallback>` は、**待機表示を担う薄い表示境界**とする。`error.tsx` と対をなし、いずれも業務ロジックを持たない。中身のコンポーネントは feature 側に置き、特殊ファイルからは薄く委譲する(error.tsx と同じ / [0040](0040-routing-rendering-strategy.md) driving adapter 原則)
- **Suspense 境界の粒度**: streaming SSR で「先に出せるシェル」と「待つ部分」を分けるため、境界は **feature 内の、実際にデータ待ちする部分の近く**に置く(`"use client"` を葉へ押し下げる [0040](0040-routing-rendering-strategy.md) と同じ発想で、fallback 境界も過度に上位へ置かない)。`page.tsx` 全体を 1 つの `loading.tsx` で覆うだけにしない
- `loading.tsx` も `app/` 配下の App Router 特殊ファイル([0027](0027-directory-structure.md) / [0028](0028-naming-convention.md))である
- **一次資源が見つからないことは 200 で配信される。** [0041](0041-cache-components-decision.md) により
  `Cache Components` が有効な間、動的な route は必ず殻から流れる。本文より先にヘッダが出るため、その後で
  `notFound()` に達しても status はもう 200 で、見つからない購入・記事・ユーザが 200 として配信される。
  **これは route 側の書き方では解けない** —— `loading.tsx` を置かなくても、`<Suspense>` を使わなくても、
  `export const instant = false` を名乗っても変わらない。Next 自身が案内する回避は `proxy` での事前確認だが、
  [0043](0043-middleware-policy.md) は `proxy` を cookie を読むだけの前捌きに限っており、採らない
- **見つからないことは `noindex` と画面が伝える。** status で伝えられない以上、伝える手段は
  `not-found.tsx` が返す画面と、`notFound()` が挿す `<meta name="robots" content="noindex">` である。
  索引はこれで防げる。**防げないのは status で判定する読み手** —— 外形監視・DAST・非 JS クライアントからは
  成功と区別できない。この代償は [0041](0041-cache-components-decision.md) で引き受けた
- **その結果、待機の状態を持たない画面がある。** `docs/rules.md`「状態表示と待機」の「各画面は loading、empty、error、success の 4 状態を設計する」は「4 つ必ず作る」ではなく
  「4 つを設計して、所有するものを実装・テストする」である。所有しない状態の部品を作ると、
  どこからも参照されない skeleton が残る。**所有しないと決めたことと、その理由を README に書く**
- **Suspense × PPR の相互作用**: `Cache Components` は有効なので([0041](0041-cache-components-decision.md))、`<Suspense>` の位置は待機表示の話ではなく**静的な殻と動的な穴の境界そのもの**である。上の「待つ部分の近くへ置く」は、有効化後は性能の助言ではなく**殻を配れるかどうかの条件**になる —— 境界より外にある取得が 1 つでも残っていれば、その route は殻を配れない
- **fallback は場所を取る。** 穴が埋まる瞬間に周りが動かないよう、待機表示は実物と同じ大きさの枠を出す(`docs/rules.md`「状態表示と待機」の「loading は形状が近い skeleton を優先する」と、「UI 部品と操作」の「状態によって出入りする表示のせいで、操作の位置を動かさない」)。描くものを持たない穴(計測など)だけが `null` を fallback にしてよい
- fallback の**見た目(スケルトン / スピナー)の UI 規約**は用途依存であり、テンプレートから作った側で確定する

### 5. swallow 禁止・cause chain・redact

- **エラーを握り潰さない(swallow 禁止)**。各エラーは handle / wrap して伝播するか、論理的到達不能なら明示的に throw する
- 原エラーの型・情報を鎖に残す。TypeScript の **`Error` の `cause`(`new Error(msg, { cause })`)で chain を保持**する
- **秘匿情報を含むエラーは redact してから wrap** する。ログ・レスポンスに PII / token / password を出さない

### 6. ログ出力タイミング

- エラーのログは **境界で 1 回**(`adapters` の正規化点 / route の error 境界)出力し、二重ログを抑止する
- **5xx(システム起因)= error レベル / 4xx(ユーザ起因)= warn レベル**。ログの具体(スキーマ・出力先・trace 相関)は **[0081](0081-observability-logging.md)** が正

### 境界の粒度

`error.tsx` は**失われて困る範囲の外側**に置く。境界の内側は丸ごと差し替わるため、境界が広いほど、1 つの取得の失敗で消える導線が増える。route 直下に置くのは、その route の本文が失敗しても header・nav・footer を残すためである。

**部分的な失敗を許す画面では、境界ではなく表示で受ける。** 落ちてよい 1 系統のために画面全体を差し替えない([0063](0063-mutation-result-notification.md) の通知手段を使う)。

## 禁止事項

- ❌ `errors` カーネルに HTTP status / レスポンス形式を持たせること(分類は transport 非依存。変換は境界)
- ❌ 生 HTTP status・生エラー・スタックを内層 / UI へ漏らすこと(境界で正規化)
- ❌ エラーを握り潰すこと(swallow 禁止)/ 秘匿情報を redact せずログ・レスポンスに出すこと
- ❌ `error.tsx` / `global-error.tsx` / `not-found.tsx` / `loading.tsx` / Suspense fallback に業務ロジックを書くこと(薄い表示境界)
- ❌ `page.tsx` 全体を 1 つの `loading.tsx` で覆うだけにし、Suspense 境界を待つ部分の近くへ置かないこと(ストリーミングの利点を捨てる)
- ❌ 同一エラーを複数箇所で重複ログすること(境界で 1 回)
- ❌ `Unauthenticated`(401)を `Internal` へ畳むこと(§2。再試行できる失敗と混ざる)
- ❌ 画面が成り立つために要らない値の degrade を、画面ごとの try / catch で書くこと(§2。境界で畳む)
- ❌ 一次資源の不在を status で伝えられる前提で設計すること(§4。有効な `Cache Components` の下では 200 で配信される)
- ❌ 画面が所有しない状態の部品を作ること(§4。参照されない skeleton が残る)

## 関連 ADR

- [0021-frontend-responsibility.md](0021-frontend-responsibility.md) — `errors` カーネル(全層参照可 / `model` が依存してよい唯一)
- [0071-bff-api-integration.md](0071-bff-api-integration.md) — 生 status を errors 分類へ正規化する境界(本 ADR が対応表の詳細を定める)
- [0040-routing-rendering-strategy.md](0040-routing-rendering-strategy.md) — `error.tsx` / `loading.tsx` 配置(本 ADR が責務を確定)/ driving adapter 原則
- [0028-naming-convention.md](0028-naming-convention.md) — App Router 特殊ファイルの命名
- [0081-observability-logging.md](0081-observability-logging.md) — エラーログのスキーマ・出力先・trace 相関
- [0070-backend-role-separation.md](0070-backend-role-separation.md) — バックエンドエラーの契約(境界での正規化の前提)
