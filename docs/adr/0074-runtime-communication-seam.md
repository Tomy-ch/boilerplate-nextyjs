# 双方向/ストリーム通信 seam(WebSocket / SSE)

[0071](0071-bff-api-integration.md) の fetch wrapper は **request/response(単発の往復)前提**で resilience(dual timeout / retry / retry budget / circuit breaker)を組んでいる。本 ADR は、その往復モデルが構造的に扱わない **双方向/ストリーム通信(WebSocket / SSE)** を、**サービス非同梱(exclusion)+ 名前付き拡張点(seam)** として明文化する。この seam の物理的な「家」は既に [0024](0024-adapters-server-client-split.md)(`adapters/client`)が持つため、本 ADR はそれを**再決定せず結線**し、往復モデル(および env のビルド/起動時固定)の**外側にある領域**の境界判定と seam の形のみを確定する。

## Status

Accepted

## 背景

[0071](0071-bff-api-integration.md) の fetch wrapper は **request/response 前提**であり、**双方向・ストリームの口を持たない**。これは「0071 の既定モデルの外側にある runtime 関心事」であり、seam なしで後入れすると [0021](0021-frontend-responsibility.md) の依存マトリクスに収まらない。

この seam の**物理的な置き場**は既に確定している: client の購読 IO は [0024](0024-adapters-server-client-split.md) の **`adapters/client` element**(remote 外部システム × client)が明示的に受け持つ(0024 決定表が「WebSocket・SSE」を列挙)。

したがって本 ADR は**新カーネルも新しい家も立てない**。既存の家を結線したうえで、なお未確定の点 —— **長寿命接続の hosting をどこが持つか([0011](0011-no-docker.md) PaaS 制約下の境界判定)** —— を、設計思想([0010](0010-standards-and-non-lockin.md) 標準準拠・非ロックイン)から確定する。同じ「往復モデルの外側」に見える動的 feature flag / 段階的配信は subject が異なり、[0078](0078-dynamic-feature-flag-seam.md) が持つ。

## 決定

**境界判定(別ドメインか?の一問)で 2 分する**:

- **長寿命接続の hosting(ソケットを開いたまま保持するサーバ)= 別ドメイン(infra/backend)責務 → 境界 seam で切る(非同梱)**。[0011](0011-no-docker.md) の PaaS / サーバレス前提では長寿命接続を本体で保持できない。realtime の供給元は **バックエンド直結 or 外部 managed サービス**(例: Pusher / Ably / Supabase Realtime / managed WebSocket / SSE ゲートウェイ)であり、本 boilerplate は realtime transport サーバを**同梱しない**。これは [0070](0070-backend-role-separation.md)(業務・接続ホスティングは backend)/ [0011](0011-no-docker.md) の帰結であって、新たな制約ではない。
- **client 側の購読/消費 = フロント領域 → 名前付き拡張点(seam)**。家は既に [0024](0024-adapters-server-client-split.md) の **`adapters/client`**。本 ADR はそこに置く **購読 seam の契約**を定める: connect / subscribe / message ハンドラ / close を持つ client subscription adapter とし、[0071](0071-bff-api-integration.md) の request/response wrapper と同じく **`errors` 分類へ正規化・`logging` へ送出**する(生の接続エラー・close code を上位 feature へ漏らさない。[0021](0021-frontend-responsibility.md))。
- **責務分界**: 順序・重複・再接続・cursor・接続状態は transport 都合であり `adapters/client` が持つ。ドメインイベント(どの通知で何の表示をどう変えるか)の畳み込みは feature が持つ。`adapters` は境界であって状態の所有者ではない([0021](0021-frontend-responsibility.md) / [0024](0024-adapters-server-client-split.md))。

**手段の優先順位(標準に乗る。[0010](0010-standards-and-non-lockin.md) §1)**: server→client の一方向 push は **SSE(`EventSource`)を既定**とし、**真に双方向が必要な場合のみ WebSocket** を採る。定期再取得(polling)は [0060](0060-state-management.md) の Server state 既定を破らない範囲での例外であり、その規約は [docs/rules.md](../rules.md) が持つ。

- **vendor-independent 正当性材料([0010](0010-standards-and-non-lockin.md) §2)**: `EventSource` / `WebSocket` は WHATWG / W3C の **web プラットフォーム標準**であり Next.js 固有 API ではない(= フレームワーク・ロックインを構成しない)。SSE を既定に置く独立根拠 = ① HTTP 上で動き既存の proxy / CDN / 認証(cookie)基盤をそのまま通る、② `EventSource` が**自動再接続を標準で内蔵**する、③ 供給元が無くてもバックエンド直結へ素直に degrade する —— いずれも「Next.js が推奨するから」ではない web 標準の性質。「数ある realtime 手段から、これらの独立根拠で SSE を 1 要因として選んだ」と位置づける。

**request/response resilience との差(0071 との非重複を明示)**: [0071](0071-bff-api-integration.md) の resilience(dual timeout / idempotent retry / breaker)は**単発の往復**に効くもので、長寿命ストリームには**そのまま適用できない**。ストリーム側の resilience は形が異なる(**再接続 backoff + jitter / heartbeat・liveness / resume-from-cursor**)。本 ADR はこの**別形の resilience が `adapters/client` の購読 seam 側に属する**ことを名指すに留め、**具体機構は用途依存として fork 先へ委ねる**(§補足)。

## 禁止事項

- ❌ realtime transport サーバ(長寿命接続の hosting)を本体に同梱すること([0011](0011-no-docker.md) PaaS 前提 = 別ドメイン。バックエンド直結 or 外部サービス)
- ❌ WebSocket / SSE の購読を `features` / `components` に直書きすること([0071](0071-bff-api-integration.md) の生 fetch 禁止と同型。購読 seam = `adapters/client`。[0024](0024-adapters-server-client-split.md))
- ❌ 生の接続エラー / close code / ストリーム例外を上位へ漏らすこと(`errors` 分類へ正規化。[0021](0021-frontend-responsibility.md))
- ❌ transport 都合の状態(順序 / 重複 / 再接続 / cursor)を feature に持たせ、ドメインイベントの畳み込みを `adapters` に持たせること(責務分界を跨ぐ)
- ❌ [0071](0071-bff-api-integration.md) の request/response resilience(dual timeout / retry / breaker)をそのまま長寿命ストリームに適用すること(別形 = 再接続 backoff / heartbeat / resume)

## 補足

- 本 ADR は保守的に **IF/契約 + SSE 既定の指針**までを敷き、具体機構(再接続 / heartbeat を含む local subscription adapter)は fork 先へ委ねる。
- 本 ADR は exclusion(非同梱宣言 + named seam を併記する)である。polling / 相対時刻更新等の周期 client 取得の rule は本 ADR の対象外([docs/rules.md](../rules.md))。本 ADR は**双方向/ストリーム**の seam のみを扱う(動的配信フラグは [0078](0078-dynamic-feature-flag-seam.md))。
- **購読 seam はコードとして置かない。** 設置面(実使用箇所)が存在せず、使われない IF は腐るためである。本 ADR が記すのは**採用時の拡張点の座標**(`adapters/client` の subscription adapter 契約)であり、実体化は最初の該当 feature 実装時に行う(既定 = native `EventSource` / `WebSocket` + 薄い client・Medium。§手段の優先順位=標準準拠は不変)。native で足りず外部クライアントを採る場合も本体は seam を保持し、[0010](0010-standards-and-non-lockin.md)(vendor-independent 正当化 + adapters/カーネル境界の裏で差替可能・vendor 直参照を feature/component に散らさない)/ [0004](0004-library-management.md)(exact-pin / `pnpm audit`)の枠内で置く。

## 関連 ADR

- [0078-dynamic-feature-flag-seam.md](0078-dynamic-feature-flag-seam.md)— 動的 feature flag / 段階的配信 seam(往復モデルの外側にある別主題)
- [0071-bff-api-integration.md](0071-bff-api-integration.md)— request/response fetch wrapper と resilience(本 ADR が「扱わない領域」を名指す親)
- [0024-adapters-server-client-split.md](0024-adapters-server-client-split.md)— `adapters/client`(WebSocket・SSE の物理的な家。本 ADR は購読 seam の契約を結線)
- [0011-no-docker.md](0011-no-docker.md)— PaaS / サーバレス前提(長寿命接続 hosting = 別ドメインの根拠)
- [0070-backend-role-separation.md](0070-backend-role-separation.md)— 業務・接続ホスティングは backend(realtime 供給元 = 別ドメインの根拠)
- [0010-standards-and-non-lockin.md](0010-standards-and-non-lockin.md)— 標準準拠(EventSource / WebSocket = web 標準に乗る)+ 非ロックインの vendor-independent 正当化
- [0060-state-management.md](0060-state-management.md)— Server state 既定(polling / 反応的供給の抑制根拠)
