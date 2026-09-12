# BFF abuse 保護境界(infra / edge seam)

`/api/*`(テレメトリ中継を含む公開エンドポイント)への abuse 保護を、**infra(PaaS / edge)ドメインの境界 seam**(レート制限 / DDoS 緩和 / WAF = 名前付きで残して切る)と、**本体に最小限残す防御**(Route Handler のボディサイズ上限・content-type 検証・入力バリデーション)に分けて明文化する。

## Status

Accepted

## 背景

[0070](0070-backend-role-separation.md) が `/api/*` を **thin proxy** に限定し、[0081](0081-observability-logging.md) が「ブラウザ → BFF 中継」をテレメトリの seam にした結果、本体構成に**認証を要求しない公開エンドポイント**が生じる:

- `/api/*`(テレメトリ中継含む)へのレート制限・ボディサイズ上限・認証なしエンドポイントの保護を、本体で持つか PaaS 側へ委ねるかの線引きが要る。
- [0081](0081-observability-logging.md) の中継 seam が生む無防備な公開エンドポイントに、防御方針が無いままでは置けない。

本 ADR は [0010](0010-standards-and-non-lockin.md) の 2 原則(§1 デファクトへの準拠 / §2 vendor-independent な正当性材料の必須化)と、**境界判定**(「別ドメイン(infra / backend)の責務か?」の一問)を適用して abuse 保護を仕分ける。

## 決定

**境界判定 = Yes(別ドメイン)**。レート制限・DDoS 緩和・WAF は **infra(PaaS / edge)ドメインの責務**であり、本リポジトリに実装を抱えず、**名前付きの境界 seam を残して切る**。

### 1. PaaS / edge へ委譲する防御(infra 境界 seam)

レート制限・IP / bot フィルタ・DDoS 緩和・大域的な WAF は Vercel / Cloudflare / AWS 等の edge / WAF 機能で敷く。本体はこれを前提とし、PaaS 側で設定する拡張点として明示する([0081](0081-observability-logging.md) が生む無防備エンドポイント = テレメトリ中継 `/api/*` の保護もここに載る)。

- **vendor-independent 正当性材料([0010](0010-standards-and-non-lockin.md) §2)**: 公開エンドポイントを edge で多層防御する構造は OWASP / 一般的 web セキュリティの原則であって特定 PaaS 機能に依存しない(Vercel / Cloudflare / AWS WAF いずれでも成立)。

### 2. 本体に最小限残す防御(フロント領域で表現可能な防御)

個々の Route Handler が **ボディサイズ上限・content-type 検証・入力バリデーション** を forwarding 前に行うことは、Next.js 公式 BFF ガイドの「proxy する前に validation を足す」パターンに乗る範囲であり、edge の有無に関わらず本体が持つ最小防御として Route Handler 規約(`docs/rules.md`「層境界と依存」の「Route Handler は Node runtime の薄い proxy に留める」)側で受ける。

本体が同梱するテレメトリ中継(`/api/telemetry`)がその参照形である:

- content-type が JSON を名乗らない要求は **415** で落とす
- 契約が許す最大の報告(約 15.7 KB)を超える本体は **413** で落とす。**宣言された長さで先に落とし、宣言の無い要求は読んだ後の実測で落とす** —— 宣言だけを信じると、長さを名乗らない要求が素通りする
- レート制限と大域的な遮断は §1 のとおり edge / WAF の責務であり、この Route Handler には置かない

### 3. 線引きの範囲

本 ADR が確定するのは「rate limit / DDoS / WAF = infra 境界 seam で切る」「入力・サイズ検証の最小防御 = 本体 Route Handler 規約」という **帰属の骨格**と、同梱する中継の参照形(§2)に留める。他の公開エンドポイントの具体値(上限・許容する content-type)は用途 / PaaS 依存であり、§2 の形に倣って Route Handler ごとに置く。

## 禁止事項

- ❌ レート制限 / DDoS 緩和 / WAF を 本リポジトリのアプリコードに実装すること(infra 境界 seam = PaaS / edge へ委譲)
- ❌ 公開 `/api/*`(テレメトリ中継含む)にボディサイズ上限・content-type / 入力検証を一切設けず forwarding すること(本体が持つ最小防御)

## 補足

- **タクソノミー**([0140](0140-documentation-operations.md)): 本 ADR は decision(abuse 保護の帰属確定)に属する。日常強制される rule(Route Handler 実装規約)は `docs/rules.md`「層境界と依存」の「Route Handler は Node runtime の薄い proxy に留める」が持ち、本 ADR から逆参照する。
- **トピック上の関連**: 本 ADR(infra abuse 保護)は観測性 ADR([0081](0081-observability-logging.md))の中継 seam と密接に関連する(0081 が保護対象の無防備エンドポイントを生む起点であるため)。関連は索引・相互参照で表現する。

## 関連 ADR

- [0075-file-upload-seam.md](0075-file-upload-seam.md)— ファイルアップロード seam(同じ境界判定で仕分けた隣接主題)
- [0076-payment-ui-seam.md](0076-payment-ui-seam.md)— 決済 UI seam(mount seam と PCI 境界。同じ境界判定の兄弟)
- [0070-backend-role-separation.md](0070-backend-role-separation.md)— `/api/*` = thin proxy(無防備エンドポイントを生む起点の親決定)
- [0081-observability-logging.md](0081-observability-logging.md)— ブラウザ → BFF 中継 seam(無防備エンドポイントを生む起点。本 ADR の保護対象)
- [0082-client-observability.md](0082-client-observability.md)— 中継の口(`/api/telemetry`)の送信内容(§2 の参照形が守る対象)
- [0010-standards-and-non-lockin.md](0010-standards-and-non-lockin.md)— 標準準拠 + vendor-independent 正当性(edge 多層防御の正当化の土台)
