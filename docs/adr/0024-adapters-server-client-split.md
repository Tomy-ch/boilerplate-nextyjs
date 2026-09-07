# adapters の server/client 分割と client 側外部接続境界

[0071](0071-bff-api-integration.md) が `adapters`(BFF / API 統合)の中身を、[0022](0022-capabilities-kernel.md) が `capabilities`(client runtime hook)を定める。両者を「`adapters` = 外部システム × server / `capabilities` = runtime × client」という対角線だけで対にすると、**「外部システム × client」セルが空席**になる —— ブラウザから外へ出る IO(client→BFF fetch / WebSocket・SSE / analytics・telemetry 送信)を置く家が無い。

本 ADR は、この **client 側の外部接続境界**を、`adapters` を **1 カーネル内 2 element に分割**することで確定する。あわせて `adapters` と `capabilities` の位置づけを **2 軸モデル**で定める。ポリシー状態(consent / flag)の供給は本 ADR の adapters/client を土台に [0031](0031-policy-state-supply.md) が定める。

## Status

Accepted

## 背景

`adapters` を server-only とし、`capabilities` が remote IO を明示拒否し、`features` / `components` への生 fetch を [0071](0071-bff-api-integration.md) が禁止すると、client 発の外部 IO は **全出口が閉じる**。[0021](0021-frontend-responsibility.md) が `adapters` の例に挙げる「analytics 送信」も client でしか起きないため、server-only 宣言とは両立しない。client 側の外部接続には明示の element が要る。

## 決定

### 1. 2 軸モデル

境界カーネルは 2 つの軸で位置づける:

- **WHAT**: remote 外部システム(アプリが呼び出す先)/ local runtime(アプリが動く器)
- **WHERE**: server / client

| | server | client |
| --- | --- | --- |
| **remote 外部システム** | `adapters/server` | `adapters/client` |
| **local runtime** | (config / `instrumentation.ts`) | `capabilities` |

`capabilities` は `adapters` の「client ミラー」ではなく、**WHAT が異なる**(runtime 境界)。`capabilities` の実質ルール(責務・use-client・受け入れないもの)は [0022](0022-capabilities-kernel.md) が持ち、本 ADR はその位置づけを定める。

### 2. `adapters` を 1 カーネル内 2 element に分割

外部システム境界は **1 責務**(型変換 + resilience)であり、server / client は**実行文脈の差 = element 属性**。別カーネルにはしない(1 責務が 2 カーネルに割れるのを避ける)。

```text
src/adapters/
├── gen/      区画: adapters-gen(契約からの生成物。[0072](0072-api-type-generation.md))
├── http/     区画: adapters-http(実行文脈を持たない、両 element が従う規則)
├── server/   element: adapters/server
└── client/   element: adapters/client
```

| element | 実行文脈 | import 可 | 中身 |
| --- | --- | --- | --- |
| `adapters/server` | **server-only**(`import "server-only"`) | `model` / `errors` / `logging` / **`config`(ここだけ)** | backend API client・secret 有・resilience([0071](0071-bff-api-integration.md)) |
| `adapters/client` | **`"use client"`** | `model` / `errors` / `logging` / client config(**server config 不可・secret 無**。client config = NEXT_PUBLIC リテラルは可) | 同一オリジン BFF fetch / WebSocket・SSE([0074](0074-runtime-communication-seam.md))/ telemetry 送信([0082](0082-client-observability.md))/ アップロード送信(ファイルの受け口([0075](0075-file-upload-seam.md))へ渡す前の選択と検証。既定は backend の受け口で決まる = [0075](0075-file-upload-seam.md))/ analytics 送信(**このアプリが送信を組み立てる場合に限る**。同梱のタグマネージャは組み立てを持たないため通らない = [0082](0082-client-observability.md) §3)。**remote のみ** |

- **local ブラウザ API(Web Storage・client cookie 読み)は `adapters` でなく `capabilities`**([0022](0022-capabilities-kernel.md))。clipboard と同型 = browser runtime API であり外部システムではない
- **宛先オリジン**: 同一オリジン BFF(`/api/*`)が主経路。**同一オリジン外への送信も、ADR が明示に許す場合に限り `adapters/client` が所有する**(realtime のバックエンド直結 / managed サービス([0074](0074-runtime-communication-seam.md)))。telemetry は [0081](0081-observability-logging.md) により BFF 中継(外部直送禁止)。**タグマネージャだけは例外で、`adapters/client` を通らない** —— 読み込む口は `app` の client island が持ち、送信は容器の中身が行う([0082](0082-client-observability.md) §3 / [0131](0131-cookie-consent.md) §2)
- **実行文脈を持たない規則は、element の下ではなく区画へ置く**(`src/adapters/http/`)。要求 URL の予算のように server / client のどちらの送信にも等しく効く規則は、片方の element に置くともう片方から import できず、規則が 2 つに割れる。`architecture.ts` が `adapters-http` として宣言し、`adapters` の中からだけ届く
- `features` は両 element の公開面を import 可。`capabilities` は `adapters` を import しない
- ESLint boundaries を 2 element に割り、**secret / RSC 境界を機械強制**(server-only に client hook 混入・client に config import はエラー)

## 禁止事項

- ❌ `adapters/client` に secret / server config を置くこと(client bundle 漏洩)。client config の NEXT_PUBLIC リテラルは可
- ❌ `adapters/server` に client hook / `"use client"` を混ぜること(逆も。RSC 境界。[0040](0040-routing-rendering-strategy.md))
- ❌ local ブラウザ API(storage / clipboard / cookie 読み)を `adapters` に置くこと(→ `capabilities`)

## 補足

- ポリシー状態(consent / flag)の source adapter と供給方針は本 ADR の adapters/client を土台に [0031](0031-policy-state-supply.md) が定める。

## 関連 ADR

- [0071-bff-api-integration.md](0071-bff-api-integration.md) — `adapters`(BFF / API 統合)の中身。本 ADR はその server/client 面を確定
- [0022-capabilities-kernel.md](0022-capabilities-kernel.md) — `capabilities`(runtime hook)。本 ADR が 2 軸モデルで位置づける
- [0031-policy-state-supply.md](0031-policy-state-supply.md) — consent / flag の source adapter + 供給(本 ADR の adapters/client が土台)
- [0025-app-layer-elements.md](0025-app-layer-elements.md) — Route Handler(client 送信の受け側 = `adapters/server` の import 元)
- [0040-routing-rendering-strategy.md](0040-routing-rendering-strategy.md) — RSC / Client 境界(server-only / use-client の機械強制の根拠)
- [0081-observability-logging.md](0081-observability-logging.md) — ブラウザ→BFF 中継(client 送信面 = `adapters/client`)
