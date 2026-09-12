# `capabilities` カーネル(横断 client hook)

[0020](0020-adopted-architecture.md) の **機能スライス × 表示層カーネル** アーキテクチャにおけるカーネル **`capabilities`** について、その **責務 / 依存 / `"use client"` 不変条件 / 合成方針 / 移植性** を定める。

[0021](0021-frontend-responsibility.md) が全カーネルの **責務マトリクス・命名規律・昇格ルールの SSOT** であるのに対し、本 ADR は `capabilities` カーネルの **中身** を定める。これは「実質のあるカーネルは自前 ADR を持つ」という定石の踏襲である(`config` → [0030](0030-environment-variable-management.md) / `errors` → [0080](0080-error-handling.md) / `logging`・`observability` → [0081](0081-observability-logging.md) / `adapters` の中身 → [0071](0071-bff-api-integration.md))。軽量な `model` / `components` が 0021 内で足りるのに対し、`capabilities` は中身が厚い(責務 + RSC 不変条件 + 合成方針 + 移植性)ため独立させる。

## Status

Accepted

## 背景

[0021](0021-frontend-responsibility.md) の**昇格ルール**(feature を跨ぐ横断要素を `model` / `components` / `adapters` へ昇格させる)には、それだけでは **reactive な横断 client hook の出口が無い**。`useConnectivity` のような「フロント領域の横断 client hook(拡張点 / seam)」は、表示ロジックでも UI でも外部接続でもなく、複数 feature から使うときの昇格先を要する。

[0021](0021-frontend-responsibility.md) の命名規律は「役割を名指しできない置き場が必要になった時点で、それは設計の欠落であり、**真に横断が必要になったら ADR 追補で役割を定義してから作る**」と定めている。本 ADR はその条項に従い、役割を定義したうえでカーネルを立てる。onion の層に対応物はない(React の client hook はフロント固有である)。

## 決定

### 責務

`capabilities` は、**runtime(ブラウザ + Next.js フレームワーク)の能力を reactive な client hook として供給する**カーネルである。想定する hook 例:

- `useConnectivity`(オンライン/オフライン検知 = `navigator.onLine` の購読)
- `useMediaQuery` / breakpoint
- `useClipboard`
- Web Storage(`useLocalStorage` / `useSessionStorage`)/ client cookie 読み
- safe-area / viewport
- ページの可視性(既読の確定・隠れている間の再接続の抑制)
- navigation-block(離脱ガード)
- scroll 制御
- Web Worker へのオフロード(seam)

キーボードショートカットは据え置き除外のため hook 例から外す([0053](0053-ui-component-interaction-seam.md) §5)。グローバルショートカットを採用する場合の置き場が `capabilities` であることだけは変わらない。

### `"use client"` 不変条件(client-only)

`capabilities` は **client-only(`"use client"`)固定**とする。位置づけは **2 軸モデル**([0024](0024-adapters-server-client-split.md))による:

- **WHAT**: `adapters` = アプリが *呼び出す remote 外部システム*(backend API 等)との境界 / `capabilities` = アプリが *その中で動く local runtime*(ブラウザ + フレームワーク)との境界
- **WHERE**: `capabilities` は client のみ。`adapters` は server / client 両面([0024](0024-adapters-server-client-split.md) で `adapters/server`・`adapters/client` の 2 element に分割)

`capabilities` は `adapters` の「client ミラー」**ではなく**、**WHAT が異なる**(runtime 境界)。両者の RSC 境界(server-only / use-client)は ESLint boundaries の element 属性で機械強制する([0040](0040-routing-rendering-strategy.md))。**local ブラウザ API(Web Storage / clipboard / cookie 読み)は「外部システム」でなく browser runtime API なので、`adapters` でなく `capabilities` が担当する**。

### 受け入れないもの

- **remote IO**(fetch / WebSocket・SSE / analytics・telemetry 送信)→ `adapters/client`([0024](0024-adapters-server-client-split.md))。※ Web Storage / cookie 読みは remote でなく local runtime API なので `capabilities` が担当(上記「責務」)
- **通信機構の状態**(stream が生きているか = `EventSource` の状態・再接続 backoff の残り)→ `adapters/client` の購読 seam([0074](0074-runtime-communication-seam.md))。回線の有無は runtime の能力だが、stream の生死は通信機構の状態であり、**この 2 つは別物で、画面はどちらも必要とする**
- **server config**(secret を持つ runtime config object。client のため不可)。※ client config(= NEXT_PUBLIC のビルド時インライン**リテラル**)は runtime object でなく公開定数のため import 可([0030](0030-environment-variable-management.md))
- **業務状態**
- **UI マークアップ** → `components`
- **ポリシー状態**: consent-gate は [0131](0131-cookie-consent.md) の機構([0031](0031-policy-state-supply.md) の供給経路)、feature-flag は [0078](0078-dynamic-feature-flag-seam.md) の seam が所有する。`capabilities` は **runtime 能力に限る**(ポリシー hook はここに置かない)

### 依存

| 層(import する側) | 許可される import 先 |
| --- | --- |
| `capabilities` | `model` / `errors` / `logging` / client config(**server config 不可**・secret 無。client config = NEXT_PUBLIC リテラルは可。[0030](0030-environment-variable-management.md)) |
| `features` | 既存 + **`capabilities`** |

- **`components` は不変**(`model` / `errors` のみ)= **`components` は `capabilities` を import しない**
- **昇格ルールの 4 つ目の出口**: reactive な横断 client hook(runtime 能力)→ `capabilities` へ。単一 feature でしか使わない hook は feature 内共置のまま([0021](0021-frontend-responsibility.md) 受入基準 1・2)

### 合成は feature が行う

hook の呼び出しと UI への配線(合成)は **feature** が行う。**app(route / page = driving adapter)に合成ロジックを書かない**([0020](0020-adopted-architecture.md) / [0021](0021-frontend-responsibility.md) の thin app 原則)。

- **Provider mount 例外**: `capabilities` が export する Provider を root layout に mount する場合、これは **layout の薄い mount 例外**として扱う(app は `<Provider>` を置くだけで薄いまま。feature は `useXxx()` を直接呼び、`components` は props-in のまま = prop 配線は feature が担う)。**この mount 例外を capabilities 限定でなく横断 UI / Provider 全般へ一般化する規約は [0026](0026-layout-shell-mount.md) が定める**
- **UI 密着の挙動 hook**(focus-trap / scroll-lock 等)は `capabilities` ではなく、その component への **co-location**(runtime 能力ではなく UI 挙動のため)。レスポンシブ判定は JS hook でなく **CSS(Tailwind breakpoint / `@container`)を優先**([0050](0050-styling-strategy.md))し、`useMediaQuery` の乱用を避ける

### 命名

`capabilities` は **役割名**(runtime 能力の供給)である。メカニズム名の `hooks` / `utils` カーネルは引き続き**禁止**([0021](0021-frontend-responsibility.md) 命名規律)。feature 内の単一 hook の共置は従来どおり許可する。

## 移植性

feature の移植可能性は、**カーネル契約に対して相対的**である(ゼロ依存の島ではない)。`capabilities` を消費する feature は、`components` を消費する feature と**同程度に移植可能**であり、`capabilities` はその移植の土台(カーネル群)を脅かすのではなく広げる。

移植性を最大化するため、`capabilities` の hook API は **デファクト標準の形**(`useConnectivity` / `useMediaQuery` 等の慣用シグネチャ)に寄せる([0010](0010-standards-and-non-lockin.md) の標準準拠)。標準形であるほど、移植先のプロジェクトで等価カーネルが見つかり、feature がそのまま噛む。

## 禁止事項

- ❌ `capabilities` に server 実行コード / remote IO / server config / secret / 業務状態 / UI マークアップを置くこと(client config の NEXT_PUBLIC リテラルは可)
- ❌ `adapters/server`(server-only)に client hook を混ぜること / `adapters/client` に secret を持たせること(RSC・secret 境界。[0024](0024-adapters-server-client-split.md))
- ❌ `components` が `capabilities` を import すること(合成は feature 経由。UI 挙動 hook は component co-location)
- ❌ app(route / page)に合成ロジックを書くこと(Provider の薄い mount のみ許可)
- ❌ ポリシー状態(consent / feature-flag)を `capabilities` に持たせること(各 seam が所有)
- ❌ 通信機構の状態(stream の生死・backoff)を `capabilities` に持たせること(購読 seam が所有)
- ❌ メカニズム名の `hooks` カーネルを作ること(役割名 `capabilities` が家)

## 関連 ADR

- [0020-adopted-architecture.md](0020-adopted-architecture.md) — 機能スライス × 表示層カーネル(本カーネルの親宣言)
- [0021-frontend-responsibility.md](0021-frontend-responsibility.md) — 責務マトリクス / 命名規律 / 昇格ルールの SSOT。命名規律「横断が必要なら追補で役割定義してから作る」の発動
- [0024-adapters-server-client-split.md](0024-adapters-server-client-split.md) — 2 軸モデル(本カーネルは adapters の「ミラー」でなく WHAT が異なる runtime 境界)/ remote IO の client 面 = `adapters/client`
- [0074-runtime-communication-seam.md](0074-runtime-communication-seam.md) — 購読 seam(通信機構の状態の所有先)
- [0031-policy-state-supply.md](0031-policy-state-supply.md) — 本カーネルが持たないポリシー状態(consent / flag)の供給先
- [0026-layout-shell-mount.md](0026-layout-shell-mount.md) — Provider mount 例外(本 ADR の capabilities 限定から一般化)
- [0071-bff-api-integration.md](0071-bff-api-integration.md) — `adapters`(BFF / API 統合)の中身
- [0040-routing-rendering-strategy.md](0040-routing-rendering-strategy.md) — RSC / Client 境界(`"use client"` 不変条件の根拠)
- [0010-standards-and-non-lockin.md](0010-standards-and-non-lockin.md) — 標準準拠(移植性のための hook API デファクト準拠)
- [0030-environment-variable-management.md](0030-environment-variable-management.md) / [0080-error-handling.md](0080-error-handling.md) / [0081-observability-logging.md](0081-observability-logging.md) — 「実質のあるカーネルは自前 ADR」の先例
- [0131-cookie-consent.md](0131-cookie-consent.md) / [0078-dynamic-feature-flag-seam.md](0078-dynamic-feature-flag-seam.md) — consent 機構 / feature-flag seam(ポリシー状態の所有先。`capabilities` には置かない)
