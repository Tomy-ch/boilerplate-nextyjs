# 動的 feature flag・段階的配信 seam(A-B / 段階的公開)

[0030](0030-environment-variable-management.md) の env は **ビルド/起動時に凍結される immutable fail-fast** の値であり、**再デプロイなしで変えたい動的フラグ値**とは構造的に相性が悪い。本 ADR は、その env モデルが扱わない **動的 feature flag / A-B テスト / 段階的公開** を、**サービス非同梱(exclusion)+ 名前付き拡張点(seam)** として明文化する。flag 供給の物理的な「家」は [0031](0031-policy-state-supply.md)(source adapter + no-op 既定 + stateless props)が持ち、動的値の出所は [0071](0071-bff-api-integration.md)(runtime config 逃し先)が持つため、本 ADR はそれらを**再決定せず結線**し、**(a) 評価場所の既定**と **(b) 動的フラグ値の出所と [0030](0030-environment-variable-management.md) env との緊張の解消**、および **RSC キャッシュとの相互作用の保守的既定**のみを確定する。

## Status

Accepted

## 背景

**env([0030](0030-environment-variable-management.md)・ビルド/起動時固定・immutable fail-fast)は動的フラグ値と相性が悪い。** 動的 feature flag / A-B / 段階的公開は「[0030](0030-environment-variable-management.md) の env 既定モデルの外側にある runtime 関心事」であり、seam なしで後入れすると [0021](0021-frontend-responsibility.md) の依存マトリクスに収まらない(段階的公開は RSC / キャッシュ / proxy すべてに触る横断関心事)。

この seam の**物理的な置き場**は既に確定している:

- **flag 供給**は [0031](0031-policy-state-supply.md) が **source adapter(生値読み)+ no-op 既定 + stateless props** の 3 分解で確定済み。**動的フラグ値の出所(runtime config 逃し先)**は [0071](0071-bff-api-integration.md) が持つ(**評価場所を server 既定とする決定自体は本 ADR §1 が下す**。0071 は「値の出所」を、本 ADR は「評価場所」を確定する分担)。

したがって本 ADR は**新カーネルも新しい家も立てない**。既存の家を結線したうえで、なお未確定の 2 点 —— **評価場所の既定**、および **動的フラグ値の出所と [0030](0030-environment-variable-management.md) env の関係** —— を、設計思想([0010](0010-standards-and-non-lockin.md) 標準準拠・非ロックイン)からべき論で確定する。

同じ「往復モデルの外側の runtime seam」である **双方向/ストリーム通信(WebSocket / SSE)** は subject が異なるため [0074](0074-runtime-communication-seam.md) が持ち、本 ADR には含めない。

## 決定

### flag / A-B / 段階的公開サービス本体は非同梱(exclusion)

SaaS(LaunchDarkly / Statsig / Unleash / GrowthBook 等)を boilerplate に埋め込まない([0031](0031-policy-state-supply.md) と同じ立場)。供給方針(生値読み + no-op 既定 + stateless props 供給)は [0031](0031-policy-state-supply.md) が確定済みであり、本 ADR は**再決定しない**。以下の 2 点のみ確定する。

### 1. 評価場所の既定 = server(vendor-independent 根拠付き)

フラグ評価は既定で **server 側(RSC / route handler / Server Action)** で行う(**server 評価を既定とする決定は本 ADR が下す**。[0071](0071-bff-api-integration.md) の runtime config 逃し先〈動的値の出所〉と結線する)。独立根拠:

- ① フラグ判定ロジックと SaaS SDK を **client bundle から排除**できる(バンドルサイズ)。
- ② client 評価で起きる **flag flicker / CLS を回避**できる(レイアウト安定)。

いずれもプラットフォーム中立な web パフォーマンス根拠であり、「フレームワーク推奨」ではない([0010](0010-standards-and-non-lockin.md) §2 の vendor-independent 正当化)。

### 2. 動的フラグ値の出所と [0030](0030-environment-variable-management.md) env の関係整理(緊張の解消)

「フラグ値を env に載せる」と [0030](0030-environment-variable-management.md)(env = ビルド/起動時に凍結・immutable fail-fast)と衝突する。本 ADR はこれを**衝突させずに分岐で解く**:

- **再デプロイ単位で固定するフラグ**(deploy 単位の kill switch 等)= **[0030](0030-environment-variable-management.md) の env / 目的別 config で持ってよい**(凍結が正しい振る舞い)。
- **再デプロイなしで変えたい動的フラグ** = env に載せない。[0030](0030-environment-variable-management.md) の周辺ルール「再デプロイなしで変えたい値は **BFF runtime config へ逃がす**」([0071](0071-bff-api-integration.md) 補足)に従い、**リクエスト時に source adapter(cookie / BFF runtime config / 外部サービス)から読む**([0031](0031-policy-state-supply.md) の source adapter)。

これにより [0030](0030-environment-variable-management.md) と本 ADR は**補完関係**になり矛盾しない(env は静的フラグ、runtime config / source adapter は動的フラグ)。具体ソース(cookie か BFF runtime config か外部か)は用途依存で [0031](0031-policy-state-supply.md) / 実装 / fork 先が持つ。

### 3. RSC キャッシュとの相互作用(保守的立場)

ユーザ / コホートで変わるフラグ評価結果を、キャッシュ / PPR の static 出力へ**誤って焼き込まない**。フラグで分岐する内容は **dynamic(uncached)扱い、またはコホートを cache key に含める**ことを既定とする。Cache Components は有効([0041](0041-cache-components-decision.md))であり、殻と穴の分かれ目は器の形で決まるため、フラグで分岐する内容は穴の内側で解く。**フラグ評価 × cache key の具体設計は用途依存**のため、本 ADR では上記の保守的既定のみ定め、**具体は実装へ委ねる**。

## 禁止事項

- ❌ flag / A-B / 段階的公開サービス本体を同梱すること(exclusion。[0031](0031-policy-state-supply.md) の供給 seam に乗せる)
- ❌ **動的フラグ値を [0030](0030-environment-variable-management.md) の env / 目的別 config 経由に載せること**(env は凍結。動的値は runtime config / source adapter へ逃がす)
- ❌ フラグ評価ロジック / SaaS SDK を既定で client bundle に載せること(評価既定 = server。flicker / CLS 回避・バンドル排除)
- ❌ ユーザ / コホート依存のフラグ評価結果をキャッシュ / PPR static 出力へ焼き込むこと(dynamic 扱い or cohort を cache key に含める)

## 補足

- 本 ADR は保守的に **評価場所 = server 既定 + 動的値 = runtime config / source adapter 逃し + cache 焼き込み回避**の指針までを定め、具体機構(source の選択・cache key 設計)は実装 / fork 先へ委ねる。
- 本 ADR は [0140](0140-documentation-operations.md) のタクソノミーで **exclusion(+ 拡張点)** 分類に属する。exclusion 本体(非同梱宣言)と named seam(拡張点)を併記する型に従う。
- **本体は flag 供給 seam をコードとして置かない。** 動的 flag を消費する設置面が本体に存在せず、使われない seam は腐るためである。本 ADR が記すのは採用時の拡張点の座標(source adapter + no-op 既定 + stateless props〈[0031](0031-policy-state-supply.md)〉/ 評価既定 = server / 動的値 = runtime config 逃し)であり、SaaS 採用と seam の実体化は fork 先が行う(既定の形は env + adapter で、GrowthBook 等の SaaS は adapter の裏で差し替える)。採用時も本体は source adapter / no-op 既定 / server 評価既定を保持し、flag SaaS を [0010](0010-standards-and-non-lockin.md)(vendor-independent 正当化 + adapters / カーネル境界の裏で差替可能・vendor 直参照を feature / component に散らさない)/ [0004](0004-library-management.md)(exact-pin / `pnpm audit`)の枠内で置く。

## 関連 ADR

- [0074-runtime-communication-seam.md](0074-runtime-communication-seam.md)— 双方向/ストリーム通信 seam(同じ「往復モデルの外側の runtime seam」に属する別主題)
- [0031-policy-state-supply.md](0031-policy-state-supply.md)— flag 供給(source adapter + no-op + stateless props。本 ADR は再決定せず結線)
- [0071-bff-api-integration.md](0071-bff-api-integration.md)— 動的フラグ値の runtime config 逃し先(値の出所。本 ADR §1 の server 評価が結線する先。評価場所の既定は本 ADR が確定)
- [0030-environment-variable-management.md](0030-environment-variable-management.md)— env = ビルド/起動時固定(静的フラグの家)。動的フラグは runtime config へ逃がす境界
- [0041-cache-components-decision.md](0041-cache-components-decision.md) — Cache Components 有効(フラグ評価 × cache key 相互作用の依存先)
- [0010-standards-and-non-lockin.md](0010-standards-and-non-lockin.md)— 非ロックインの vendor-independent 正当化(server 評価既定の独立根拠)
- [0131-cookie-consent.md](0131-cookie-consent.md)— 同じ [0031](0031-policy-state-supply.md) 供給 seam に乗るポリシー状態(consent。機構は本体同梱)
