# 双方向/ストリーム通信 seam(WebSocket / SSE)

[0071](0071-bff-api-integration.md) の fetch wrapper は **request/response(単発の往復)前提**で resilience(dual timeout / retry / retry budget / circuit breaker)を組んでいる。本 ADR は、その往復モデルが構造的に扱わない **双方向/ストリーム通信(WebSocket / SSE)** を、**サービス非同梱(exclusion)+ 名前付き拡張点(seam)** として明文化し、seam を実体化するときの契約 —— transport / 認証 / event の粒度 / 順序の前提 / 再接続 / mock の線引き —— を確定する。seam の物理的な「家」は既に [0024](0024-adapters-server-client-split.md)(`adapters/client`)が持つため、本 ADR はそれを**再決定せず結線**する。

## Status

Accepted

## 背景

[0071](0071-bff-api-integration.md) の fetch wrapper は **request/response 前提**であり、**双方向・ストリームの口を持たない**。これは「0071 の既定モデルの外側にある runtime 関心事」であり、seam なしで後入れすると [0021](0021-frontend-responsibility.md) の依存マトリクスに収まらない。

この seam の**物理的な置き場**は既に確定している: client の購読 IO は [0024](0024-adapters-server-client-split.md) の **`adapters/client` element**(remote 外部システム × client)が明示的に受け持つ(0024 決定表が「WebSocket・SSE」を列挙)。stream の生死や再接続 backoff の残りといった**通信機構の状態**も同じ場所に属し、回線の有無(runtime の能力)とは別物である([0022](0022-capabilities-kernel.md))。

したがって本 ADR は**新カーネルも新しい家も立てない**。既存の家を結線したうえで、なお未確定だった点 —— **長寿命接続の hosting をどこが持つか([0011](0011-no-docker.md) PaaS 制約下の境界判定)** と、**実体化するときに毎回選び直すことになる契約** —— を、設計思想([0010](0010-standards-and-non-lockin.md) 標準準拠・非ロックイン)から確定する。同じ「往復モデルの外側」に見える動的 feature flag / 段階的配信は subject が異なり、[0078](0078-dynamic-feature-flag-seam.md) が持つ。

seam の実体は `src/` に無い(§補足)。本 ADR が持つのは**選択と却下**であり、実体化するときに満たすべき形の通し説明 —— 一連の流れ・順序の扱い・再接続の組み立て・どの層が何を持つか・踏みやすい点 —— は [docs/design/realtime-delivery.md](../design/realtime-delivery.md) が持つ。

## 決定

### 1. 長寿命接続の hosting は同梱しない(exclusion)

**境界判定(別ドメインか?の一問)で 2 分する**:

- **長寿命接続の hosting(ソケットを開いたまま保持するサーバ)= 別ドメイン(infra/backend)責務 → 境界 seam で切る(非同梱)**。[0011](0011-no-docker.md) の PaaS / サーバレス前提では長寿命接続を本体で保持できない。realtime の供給元は **バックエンド直結 or 外部 managed サービス**(例: Pusher / Ably / Supabase Realtime / managed WebSocket / SSE ゲートウェイ)であり、本リポジトリは realtime transport サーバを**同梱しない**。これは [0070](0070-backend-role-separation.md)(業務・接続ホスティングは backend)/ [0011](0011-no-docker.md) の帰結であって、新たな制約ではない。
- **client 側の購読/消費 = フロント領域 → 名前付き拡張点(seam)**。家は既に [0024](0024-adapters-server-client-split.md) の **`adapters/client`**。

強制: 散文 —— **寄せられない**。同梱しているかどうかは依存とディレクトリの有無で決まり、規則にする対象が無い。

### 2. 購読 seam の契約と責務分界

`adapters/client` に置く **購読 seam の契約**を定める: connect / subscribe / message ハンドラ / close を持つ client subscription adapter とし、[0071](0071-bff-api-integration.md) の request/response wrapper と同じく **`errors` 分類へ正規化**する(生の接続エラー・close code を上位 feature へ漏らさない。[0021](0021-frontend-responsibility.md))。

**責務分界**: 順序・重複・再接続・cursor・接続状態は transport 都合であり `adapters/client` が持つ。ドメインイベント(どの通知で何の表示をどう変えるか)の畳み込みは feature が持つ。`adapters` は境界であって業務状態の所有者ではない([0021](0021-frontend-responsibility.md) / [0024](0024-adapters-server-client-split.md))。

強制: ESLint boundaries(`architecture.ts` の依存表)が、`features` / `components` から購読の**実装**(vendor client を含む)を import する経路を落とす。**ブラウザ組み込みの `EventSource` / `WebSocket` は import を持たない global なので boundaries には掛からない** —— これは `process` と同じ形で `no-restricted-syntax` に**寄せられる**(`adapters/client` の外での構築を落とす)。規則は seam を実体化する PR が置く —— 落とす対象が無いうちは、規則の正例が書けない。

### 3. transport は SSE を既定とし、WebSocket は真に双方向のときだけ

**手段の優先順位(標準に乗る。[0010](0010-standards-and-non-lockin.md) §1)**: server→client の一方向 push は **SSE(`EventSource`)を既定**とし、**真に双方向が必要な場合のみ WebSocket** を採る。定期再取得(polling)は [0060](0060-state-management.md) の Server state 既定を破らない範囲での例外であり、その規約は [docs/rules.md](../rules.md) が持つ。

**vendor-independent 正当性材料([0010](0010-standards-and-non-lockin.md) §2)**: `EventSource` / `WebSocket` は WHATWG / W3C の **web プラットフォーム標準**であり Next.js 固有 API ではない(= フレームワーク・ロックインを構成しない)。SSE を既定に置く独立根拠 = ① HTTP 上で動き既存の proxy / CDN / 認証基盤をそのまま通る、② ブラウザ組み込みで依存を足さず、購読の口が「URL を 1 つ開く」だけの形に収まる、③ 供給元が無くてもバックエンド直結へ素直に degrade する —— いずれも「Next.js が推奨するから」ではない web 標準の性質。**`EventSource` が再接続を内蔵することは根拠に数えない** —— 決定 8 でそれを使わないと決めているため。

強制: 散文 —— **寄せられない**。「真に双方向か」は用途の判断で、コードの形からは決まらない。

### 4. 認証は BFF が発行する短命 ticket。one-time にはしない

- **ブラウザは backend の stream endpoint を直接叩く。** [0079](0079-auth-frontend-seam.md) により Access Token はブラウザに無く、`EventSource` は任意のヘッダを載せられないので、資格情報は **BFF(Route Handler)が発行する短命の ticket** として **query に載せる**。発券の口は主体を名乗る要求なので user-scoped の口である([0112](0112-data-classification-cache-boundary.md))
- **ticket は主体 × 購読の単位 × stream の scope に束縛し、寿命(TTL)を持つ。** 束縛と TTL が再利用の範囲を限る
- **one-time にはしない。** one-time にすると、再接続のたびに BFF → backend の発券往復が要る。再接続を起こすのは stream 側の都合(5xx / 網の断)なので、そちらの障害が再接続の回数だけ発券口の負荷へ転化する。ブラウザ組み込みの再接続も同じ URL の再利用を前提に作られており、one-time はその前提と衝突する。TTL の内側は同じ ticket で張り直し、越えた分だけ発券し直す
- **ticket は URL に載るので、URL を文言・ログ・span の属性へ載せない。** `logging` の redaction は**名前で伏せ、値の形は見ない**([0081](0081-observability-logging.md))ため、URL 文字列の中の ticket には届かない。ブラウザ由来の例外文言を包むときは `errors` の `redactMessage` で値を名指しして消す

強制: 発券口の user-scoped は `createHttpClient` の分類引数(型。[0112](0112-data-classification-cache-boundary.md))。URL を文言へ載せないことは散文 —— **寄せられない**。文言の中身は静的に決まらない。

### 5. stream が運ぶのは message ではなく event

**stream が運ぶのは意味ごとに名前を持つ event**(`<資源>.created` のような形)であり、「message」のような**運搬の語**でも、本文の変更と状態の変更を同居させる**広い名前**(`<資源>.updated` 1 つで両方を運ぶ)でもない。広い名前は、受け取った側が本文を見て何が起きたかを判定し直すことになり、その判定が feature ごとに発明される。

強制: 一部寄せられる。event の型は契約側が宣言し、`adapters/client` は受け取った event を型名で判別する zod schema(discriminated union)で検証する —— 契約に無い名前は検証で落ちる。名前の粒度そのものは契約の設計で、散文 —— **寄せられない**。

### 6. client が stream に前提するのは、単位ごとの単調増加だけ

- sequence は購読の単位ごとに単調増加する。**歯抜けは正常であり、SSE の到達順も保証されない** —— client はこの 2 つを前提しない
- **整列と重複排除は `adapters/client` が持ち**、上へ流すのは整列済みの event だけである。**「穴が埋まるまで待つ」は却下する** —— 歯抜けが正常である以上、待ち続ける条件が成立しない。連続性を要求する側へ倒すと、backend の実装(別ドメイン)に対する仮定が client の待ち条件へ焼き込まれる
- 整列の窓を越えて遅れた event は描画済みの位置へ挿入せず、**初期表示の取得口(決定 7)を取り直して整合させる**

強制: `adapters/client` の購読 adapter の単体テスト(逆順・重複・窓を越えた遅延を入力にする)。前提の側は散文 —— **寄せられない**。backend が何を保証するかはこのリポジトリのコードに現れない。

### 7. 初期表示は取得、送信は往復。stream はどちらにも使わない

- **初期表示**は Server Component の取得口(History の projection)が組み、**その応答が返す cursor が購読の開始位置**になる。stream の replay で初期状態を組み立てる形は採らない —— 初期表示が購読の成立に依存し、stream が落ちている間は画面が出ない
- **送信**は Server Action → `adapters/server` の往復([0061](0061-form-mutation-ux.md))で行い、**`Idempotency-Key` を付けて `idempotent: true` を宣言する**([0071](0071-bff-api-integration.md) の POST 冪等性)。stream を送信の経路にしない —— 送信の失敗は分類として呼び出し側へ返る必要があり、stream にはその往復が無い
- 楽観追加は **client 側で採番した id を送信に載せ、event に echo された id で突合する**。突合できない楽観行は残さない

強制: `idempotent: true` の宣言は `retry-policy.ts` の `isRetryableMethod` が読む(型と単体テスト)。`Idempotency-Key` を付けずに `idempotent` を立てないことは散文 —— **寄せられない**。ヘッダの意味は wrapper には見えない。

### 8. 再接続は自前。`EventSource` の組み込み再接続と `Last-Event-ID` は使わない

- [0071](0071-bff-api-integration.md) の resilience(dual timeout / idempotent retry / breaker)は**単発の往復**に効くもので、長寿命ストリームには**そのまま適用できない**。ストリーム側の resilience は形が異なる —— **再接続 backoff + jitter / liveness / resume-from-cursor** —— であり、`adapters/client` の購読 seam が持つ
- **`EventSource` の組み込み再接続は使わない。** backoff と jitter を自前で持つと、間隔を `retry:` でしか動かせない組み込み再接続とは共存できない。`onerror` で即 `close()` して自前で張り直す
- **`Last-Event-ID` は使わず、cursor を毎回明示する。** `Last-Event-ID` を送るのは組み込み再接続だけで、自前で張り直した接続には載らない。再開位置の経路が 2 つあると、どちらが正か決める規則が要る
- **backoff の対象は 5xx と網の断だけ。** 発券の 401(`unauthenticated`)は session 切れとして打ち切り再ログインへ、stream 側の 403(`permission-denied`)は権限喪失として打ち切る。再試行が 401 / 403 で誤りであることは [0080](0080-error-handling.md) と同じ

強制: 打ち切りの分類は `adapters/client` の購読 adapter の単体テスト。組み込み再接続を使わないことは散文 —— **寄せられる**(`onerror` で `close()` を呼ばない実装を検出する形は書けるが、規則は無い)。

### 9. mock で差し替えない

`mocks/` は契約から生成した MSW ハンドラだけを置く一方向の場所であり、SSE は契約から生成できない。手書きのハンドラを足すとその一方向が破れる。**開発時は実バックエンドへ繋ぎ、イベントを起こす手段は backend 側が持つ。** Storybook が見せるのは購読の結果として feature が取る状態であり、それは props で与える([0054](0054-ui-catalog-storybook.md))。

強制: `mocks/` の README が「手で編集しません」を持ち、`mocks` 区画は起動境界からしか届かない(`architecture.ts` の `RESTRICTED_AREAS`)。SSE のハンドラを置かないことは散文 —— **寄せられない**。

## 禁止事項

- ❌ realtime transport サーバ(長寿命接続の hosting)を本体に同梱すること([0011](0011-no-docker.md) PaaS 前提 = 別ドメイン。バックエンド直結 or 外部サービス)
- ❌ WebSocket / SSE の購読を `features` / `components` に直書きすること([0071](0071-bff-api-integration.md) の生 fetch 禁止と同型。購読 seam = `adapters/client`。[0024](0024-adapters-server-client-split.md)。強制: boundaries は import を、`no-restricted-syntax` は global の構築を落とす —— 後者は実体化と同時に置く)
- ❌ 生の接続エラー / close code / ストリーム例外を上位へ漏らすこと(`errors` 分類へ正規化。[0021](0021-frontend-responsibility.md))
- ❌ transport 都合の状態(順序 / 重複 / 再接続 / cursor)を feature に持たせ、ドメインイベントの畳み込みを `adapters` に持たせること(責務分界を跨ぐ)
- ❌ [0071](0071-bff-api-integration.md) の request/response resilience(dual timeout / retry / breaker)をそのまま長寿命ストリームに適用すること(別形 = 再接続 backoff / liveness / resume)
- ❌ Access Token を stream の資格情報にすること(ブラウザに無い。[0079](0079-auth-frontend-seam.md)。資格情報は BFF 発行の ticket)
- ❌ ticket を含む URL を例外の文言・ログ・span の属性へ載せること(名前で伏せる redaction には届かない。[0081](0081-observability-logging.md))
- ❌ 401 / 403 を backoff の対象にすること([0080](0080-error-handling.md)。再試行しても同じ経路を辿る)
- ❌ `Last-Event-ID` と cursor の query を併用すること(再開位置の正が 2 つになる)
- ❌ `mocks/` に SSE のハンドラを手書きすること(契約からの生成という一方向を破る)

## 補足

- **購読 seam はコードとして置かない。** 設置面(実使用箇所)が存在せず、使われない IF は腐るためである。本 ADR が記すのは**採用時の拡張点の座標**(`adapters/client` の subscription adapter 契約)と契約であり、実体化は最初の該当 feature 実装時に行う(既定 = native `EventSource` / `WebSocket` + 薄い client。§手段の優先順位=標準準拠は不変)。native で足りず外部クライアントを採る場合も本体は seam を保持し、[0010](0010-standards-and-non-lockin.md)(vendor-independent 正当化 + adapters/カーネル境界の裏で差替可能・vendor 直参照を feature/component に散らさない)/ [0004](0004-library-management.md)(exact-pin / `pnpm audit`)の枠内で置く。
- **契約側に属するものは決めない。** 再開 cursor の query パラメータ名 / heartbeat の形式と間隔 / 開発時にイベントを起こす手段 / ticket の TTL は backend の契約が持つ。それらが client 側の設計に何を要求するかは [docs/design/realtime-delivery.md](../design/realtime-delivery.md) が列挙する。
- 本 ADR は exclusion(非同梱宣言 + named seam を併記する)である。polling / 相対時刻更新等の周期 client 取得の rule は本 ADR の対象外([docs/rules.md](../rules.md))。本 ADR は**双方向/ストリーム**の seam のみを扱う(動的配信フラグは [0078](0078-dynamic-feature-flag-seam.md))。

## 関連 ADR

- [0078-dynamic-feature-flag-seam.md](0078-dynamic-feature-flag-seam.md)— 動的 feature flag / 段階的配信 seam(往復モデルの外側にある別主題)
- [0071-bff-api-integration.md](0071-bff-api-integration.md)— request/response fetch wrapper と resilience(本 ADR が「扱わない領域」を名指す親。POST 冪等性の opt-in)
- [0024-adapters-server-client-split.md](0024-adapters-server-client-split.md)— `adapters/client`(WebSocket・SSE の物理的な家。本 ADR は購読 seam の契約を結線)
- [0022-capabilities-kernel.md](0022-capabilities-kernel.md)— 通信機構の状態と runtime の能力の区別
- [0011-no-docker.md](0011-no-docker.md)— PaaS / サーバレス前提(長寿命接続 hosting = 別ドメインの根拠)
- [0070-backend-role-separation.md](0070-backend-role-separation.md)— 業務・接続ホスティングは backend(realtime 供給元 = 別ドメインの根拠)
- [0010-standards-and-non-lockin.md](0010-standards-and-non-lockin.md)— 標準準拠(EventSource / WebSocket = web 標準に乗る)+ 非ロックインの vendor-independent 正当化
- [0060-state-management.md](0060-state-management.md)— Server state 既定(polling / 反応的供給の抑制根拠)
- [0061-form-mutation-ux.md](0061-form-mutation-ux.md)— 送信は Server Action の往復
- [0079-auth-frontend-seam.md](0079-auth-frontend-seam.md)— Access Token はブラウザに無い(ticket 方式の根拠)
- [0080-error-handling.md](0080-error-handling.md)— 401 / 403 を再試行しない
- [0081-observability-logging.md](0081-observability-logging.md)— redaction は名前で伏せる(URL の ticket に届かない根拠)
- [0112-data-classification-cache-boundary.md](0112-data-classification-cache-boundary.md)— 発券口は user-scoped
- [0054-ui-catalog-storybook.md](0054-ui-catalog-storybook.md)— 購読の結果は props で見せる
- [0144-decision-enforcement-pairing.md](0144-decision-enforcement-pairing.md)— 決定ごとの強制手段の書き方
