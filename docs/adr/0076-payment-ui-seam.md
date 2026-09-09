# 決済 UI seam(mount seam と PCI 境界)

決済(Stripe Elements / PayPal / Adyen 等)を **本体非同梱(exclusion)** としたうえで、テンプレートから作った側が決済を採用したときに乗る **フロント領域の mount seam**(SDK の DOM マウント点 + client_secret 受け渡し口)と、**別ドメイン(backend / PSP)の PCI 境界 seam**(生カード情報をフロントに持たせない = PCI SAQ-A 相当)を分けて明文化する。

## Status

Accepted

## 背景

[0070](0070-backend-role-separation.md) が `/api/*` を **thin proxy** に限定し、[0071](0071-bff-api-integration.md) の fetch wrapper が JSON API を前提とするため、決済 UI は両者のどちらにも乗らない:

- 決済 SDK(Stripe Elements / PayPal Buttons / Adyen Drop-in 等)を本体非同梱とする **exclusion の宣言**が要る(i18n / PWA / 同意と同じく明文で持つ)。
- 採用時の seam(外部スクリプト方針・PCI 上フロントに置いてよい範囲・BFF 中継の要否)を定めておかないと、作った側が SDK を feature へ直接組み込む。

決済は性質の異なる 2 ドメインに割れる(フロントの UI マウント面 / backend・PSP の PCI 準拠面)。本 ADR は [0010](0010-standards-and-non-lockin.md) の 2 原則(§1 デファクトへの準拠 / §2 vendor-independent な正当性材料の必須化)と、**境界判定**(「別ドメイン(infra / backend)の責務か?」の一問)を各面に通して仕分ける。

## 決定

決済は 2 つのドメインに割れる。**境界判定**を各面に通す。

### 1. フロント領域 = 決済 SDK の UI マウント seam

決済 SDK(Stripe Elements / PayPal Buttons / Adyen Drop-in 等)は **本体非同梱(exclusion)** とし、作った側が採用したときに乗る **mount seam**(SDK が iframe / redirect を差し込む DOM マウント点 + client_secret 等の受け渡し口)だけを名前付きで敷く。**既定は決済画面を PSP 側へ遷移させる(redirect)か、backend / BFF 経由で操作する構成**であり、本体の配信ヘッダはその前提で閉じている —— iframe を差す SDK を採る作った側は、[0111](0111-csp-security-headers.md) §2 の `Cross-Origin-Embedder-Policy` と `Permissions-Policy` の `payment` を開ける判断を伴う。

- 外部スクリプトの読込は [0131](0131-cookie-consent.md)(同意ゲート)と CSP([0111](0111-csp-security-headers.md))に連動させる。決済 SDK の `<script>` は同意 / CSP 許可の下でのみロードする(サードパーティスクリプト規約 = `docs/rules.md`「セキュリティ」の「第三者 script は同意ゲートの裏に置く」と一貫させる)。
- **本体は mount seam をコードとして置かない。** 決済画面という設置面が本体に存在せず、使われない seam は腐るためである。本 ADR が記すのは採用時の拡張点の座標(SDK の DOM マウント点 + client_secret 受け渡し口)であり、SDK 採用と seam の実体化は作った側が行う。採用時も本体側の座標と PCI 境界(§2)は保ち、SDK は [0010](0010-standards-and-non-lockin.md)(vendor-independent 正当化 + adapters / カーネル境界の裏で差替可能・vendor 直参照を feature / component に散らさない)と [0004](0004-library-management.md)(exact-pin / `pnpm audit`)の枠内で置く。

### 2. 別ドメイン(backend / PSP)= PCI 境界 seam で切る

決済処理・金額確定・冪等性・**PCI-DSS 準拠範囲**は backend / PSP の責務。フロントは **生カード情報に触れない**構成(SDK が iframe / redirect でカードデータを隔離し、フロント JS がカード番号・CVC を保持しない = PCI SAQ-A 相当)に留める。PaymentIntent 等の作成は backend、フロントは client_secret / トークンの受け取りのみ(受け取り口は `adapters/server`)。

- **vendor-independent 正当性材料([0010](0010-standards-and-non-lockin.md) §2)**: 「カードデータをフロント JS から隔離する」構造は PCI SSC が定める規格(SAQ-A / iframe 隔離)であって特定 PSP(Stripe / PayPal / Adyen)に依存しない(PSP を抜いても「フロントは生カード情報を持たない」は正当)。boilerplate が固定するのは mount seam の形だけで、PSP・実装詳細は作った側の嗜好に委ねる([0070](0070-backend-role-separation.md) の認証 out-of-scope と同型)。

## 禁止事項

- ❌ 決済 SDK を boilerplate 本体に同梱すること / 特定 PSP を本体前提に組み込むこと(mount seam のみ・SDK と PSP は作った側の判断)
- ❌ フロント JS で生カード情報(カード番号 / CVC)を保持・送信する構成にすること(SDK の iframe / redirect 隔離 = PCI SAQ-A 相当を破る)
- ❌ 決済 SDK の外部スクリプトを同意 / CSP ゲートの外でロードすること([0131](0131-cookie-consent.md) / [0111](0111-csp-security-headers.md))

## 補足

- **タクソノミー**([0140](0140-documentation-operations.md)): 本 ADR は exclusion(決済 SDK 非同梱)に属する。日常強制される rule(サードパーティスクリプト規約)は `docs/rules.md`「セキュリティ」の「第三者 script は同意ゲートの裏に置く」が持ち、本 ADR から逆参照する。

## 関連 ADR

- [0075-file-upload-seam.md](0075-file-upload-seam.md)— ファイルアップロード seam(同じ境界判定で仕分けた隣接主題)
- [0077-bff-abuse-protection-boundary.md](0077-bff-abuse-protection-boundary.md)— BFF abuse 保護(infra 境界 seam。同じ境界判定の兄弟)
- [0070-backend-role-separation.md](0070-backend-role-separation.md)— `/api/*` = thin proxy / 契約 SSOT(決済処理・PCI 準拠が backend 責務であることの親決定)
- [0071-bff-api-integration.md](0071-bff-api-integration.md)— fetch wrapper(JSON 前提)/ `adapters` の resilience(client_secret 受け取り口の土台)
- [0131-cookie-consent.md](0131-cookie-consent.md)— 同意ゲート(決済 SDK 外部スクリプトの読込条件)
- [0111-csp-security-headers.md](0111-csp-security-headers.md)— CSP / `Cross-Origin-Embedder-Policy` / `Permissions-Policy`(iframe を差す SDK を採るときに開ける先)
- [0010-standards-and-non-lockin.md](0010-standards-and-non-lockin.md)— 標準準拠 + vendor-independent 正当性(PCI SAQ-A の正当化の土台)
- [0024-adapters-server-client-split.md](0024-adapters-server-client-split.md)— `adapters` server / client 2 分割(client_secret / トークンの受け取り = server 側)
