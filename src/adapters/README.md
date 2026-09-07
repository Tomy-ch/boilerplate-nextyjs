---
imports-allowed: [model, errors, logging, config, observability]
forbidden: [components, capabilities, stores, business-logic]
test-requirement: integration
coverage-exclusions:
  - "src/adapters/server/taint/experimental-react.fixture.ts"
---

# adapters

バックエンド API、BFF fetch、telemetry の送信など外部接続だけを置く境界アダプタです。`server/` と `client/` の 2 element に分けます。

**このアプリが送信を組み立てないものは、ここを通りません。** 同梱のタグマネージャは容器を読み込むだけで、送信は容器の中身が行うため、`app` の client island が受け持ちます（[0082](../../docs/adr/0082-client-observability.md) §3）。
実行文脈を持たない規則——どちらの element が送る要求にも等しく効くもの——は `http/` に置き、契約からの生成物は `gen/` に置きます。どちらも `adapters` の中からだけ import できます。

## 受け入れるもの

- 外部 API / SDK への接続、外部型から表示用型への変換
- `server/` の secret を使う接続、`client/` のブラウザ向け接続

## 受け入れないもの

- 業務ロジック、UI、local browser API

## 値の分類は取得の口が宣言する

**`createHttpClient` は分類を必ず受け取ります**（[0112](../../docs/adr/0112-data-classification-cache-boundary.md)）。

| 分類 | 何を運ぶか | 持てるもの |
| --- | --- | --- |
| `scope: "public"` | 主体を名乗らずに取れるもの | `cache` / `tags`。資格情報の口は**型として持ちません** |
| `scope: "user-scoped"` | 主体に紐づくもの | 資格情報。`cache` / `tags` は**型として持ちません** |

**資格情報を載せうる口は、載せなかった回も含めて user-scoped です。** `allowAnonymous: true` を立てても
動きません。分類は口の性質であって要求ごとの結果ではなく、だから静的に決まり、型で塞げます。

**主体を指す値は資格情報とは限りません。** 契約が独自に持つ識別子のヘッダも主体を指します。
そういう値を載せる口も user-scoped です —— 判定は「認証されているか」ではなく「応答が主体で
変わるか」です。

分類が塞ぐのは「PII が共有キャッシュへ入る」経路です。入れ物は server 側で共有され、鍵は URL・
method・ヘッダ・本文なので、主体ごとに割れた値がそこへ載ると、ある主体の応答が別の主体へ渡ります。
**注意書きではなく引数の不在**にしてあるのは、注意書きが守るのは読んだ人だけだからです。

user-scoped な値をキャッシュしたいときの手段は `use cache: private`（サーバへ保存されず、ブラウザの
メモリにのみ載る）に限ります。**これは明示的な例外能力であって一般許可ではありません。**

## リクエストをまたいで残すのは `use cache` の側

**寿命を持つのは取得の口です**（[0071](../../docs/adr/0071-bff-api-integration.md)）。残す口の中で
`use cache` を宣言し、寿命は `cacheLife`、捨てる印は `cacheTag` が持ちます。呼ぶ側（feature / page）へ
置くと、同じ取得が呼び出しの数だけ別の寿命を持ち、印の付け先が散ります。

**内側の `fetch` には寿命を持たせません。** `use cache` の内側の取得はまとめて外側の寿命に従うので、
二重に持つと内側が切れないぶん、外側が取り直しても同じ古い応答を掴みます。

**寿命は profile の名前で名乗り、秒数は `next.config.ts` の `cacheLife` が持ちます。** 口の側は「何の
寿命か」だけを言い、テンプレートから作った側は口を触らずに値を動かせます。**殻へ載る取得の profile に `expire` を置きません**
—— `expire` はその時間トラフィックが途絶えた直後の 1 要求へ同期の取り直しを課すので、そこで取得先へ届かないと
殻を配れていたはずの route が丸ごと失敗へ倒れます。

**確実に残るのは、組み立て時に殻へ焼かれた分だけです。** `use cache` の既定の入れ物はプロセスのメモリなので、
serverless では要求ごとに別のインスタンスへ着地しえて再利用が起きない回があり、デプロイをまたぐと鍵ごと
捨てられます。`fetch` の `cache: "force-cache"` が持っていた「デプロイとインスタンスをまたいで残る」性質は
ここで失われるもので、**request 時の再利用を保証と読まないでください**。必要になったテンプレートから作った側は
`cacheHandlers` か `use cache: remote` を選びます（配備先に依存するので本体は選びません）。

**`use cache` を持つモジュールは `createHttpClient` を直に引けません。** 直に引けるモジュールは
user-scoped な client も組める状態にあり、`project-rules/no-user-scoped-in-cached-module` が止めます。
代わりに、**公開の分類だけを作る口を `server/` 側に 1 つ置き**、そこを引きます —— その口が作れる
のは公開の client だけなので、キャッシュの下で分類を取り違えようがありません。

その口が 1 つである理由はもう 1 つあります。retry budget と circuit breaker は client の中に状態として
載るため、同じ downstream へ client を分けると、劣化したかどうかの判断が分けた数だけ割れます。**この理由は
user-scoped 側にも同じだけ当てはまりますが、そちらは各口が自前で組み、module 変数に固定します** ——
資格情報の取得口をどこへ寄せるかが `project-rules/no-captured-bearer-token` と交差し、その検査の形と
同時にしか決められないためです（[0071](../../docs/adr/0071-bff-api-integration.md)「fetch wrapper の
resilience」）。user-scoped でも downstream ごとに 1 つが原則で、破るなら理由をその場に書きます。

## 主体を名乗るかは、口ではなく client が決める

**`createHttpClient` に `getBearerToken` を渡さない client は、そこを通る要求のすべてが匿名になります。**
資格情報はヘッダを組む境界が付けるもので、呼び出し側の口ごとには決まりません。読み取りだけを持つ
うちは匿名で妥当ですが、**同じ client の上に書き込みを足した時点で、書き込みも匿名で出ていきます**。

公開の読み取りと主体の要る書き込みが 1 つの client に同居するときは、`getBearerToken` を渡したうえで
`allowAnonymous: true` を併せます。取れたときだけ載る形になり、未ログインの読み取りも通ります。

**渡すのは import した口だけです。** `Authorization` を組む値をその場で掴むと、要求のたびに
`cookies()` を読む形が崩れ、cached scope の防御（`next-request-in-use-cache`）が何も言わずに外れます。
cookie がまだ無い session 確立の 1 往復だけは `bearerToken` という別の綴りで渡します。

これを落としても型も検査も落ちません。**気づけるのはバックエンドが 401 を返したときだけ**で、症状は
「その画面の保存だけが必ず失敗する」という形で現れます。前面の役割判定は残りますが、バックエンドが
自分で認可を判断する材料が届かなくなるため、層が 1 枚に減ります。

## URL の予算

**条件を URL へ載せる要求には、1 本ぶんの予算があります。** 経路の中継——ブラウザ / CDN /
リバースプロキシ / backend——はどれも要求行の長さに上限を持ち、超えた要求は backend へ届く前に
弾かれます。契約が各条件に宣言した上限は、この 1 つの予算を食い合います。

数えるのは **request target——path とクエリ——のバイト数**です。要求行に載る部分そのもので、
接続先の違う経路どうしでも同じものを数えられます。文字数ではありません。全角 1 文字は UTF-8 で
3 バイトになり、符号化すると 9 文字へ膨らみます。

**契約の上限を広げたら、予算を計算し直してください。** 文字列条件の `maxLength`、繰り返す条件の
`maxItems`、カーソルの長さ——どれが動いても配分が変わります。ひとつの条件が伸びた分は、他の条件が
使える余地から引かれます。

<!-- sample:begin -->
同梱のサンプルで、商品一覧（`GET /v1/products`）に宣言上限をすべて張り付けた場合:

| 条件 | 上限の根拠 | バイト |
| --- | --- | --- |
| `categoryCodes` × 32 | `maxItems: 32` / 値は最大 5 桁 | 640 |
| `statusCodes` × 32 | 同上 | 576 |
| `keyword` | `maxLength: 255`。全角は 1 文字 9 バイトへ膨らむ | 2,304 |
| `minPrice` / `maxPrice` | `maxLength: 40` × 2 | 100 |
| `minQuantity` / `maxQuantity` | int32 10 桁 × 2 | 46 |
| `sort` / `first` | enum と 3 桁 | 28 |
| `after` | `maxLength: 512` | 519 |
| **計** | | **約 4.2 KB** |

`keyword` を 4 バイト文字（絵文字など）で埋めた場合は 1 文字が 12 文字へ膨らみ、合計は約 5.0 KB に
なります。実務上の閾値（8 KB 前後）に対して、契約を守る限りは超えられない——逆に言えば、上限を
広げた時点でこの計算は崩れます。
<!-- sample:end -->

**閾値は経路が最初に弾く長さで、実務上は 8 KB 前後です。** 値は `NEXT_PUBLIC_HTTP_MAX_URL_BYTES` が
持ちます（[env/README](../../env/README.md)）。直値で持たないのは、経路のどこが最初に弾くかが配信構成で
決まるためです。テンプレートから作った側は自分の経路の最小値へ書き換えてください。`NEXT_PUBLIC_` は
ビルド時にリテラルへ置換されるため、変更には再ビルドが要ります。

判定は `http/url-budget.ts` の 1 つで、呼ぶのは 2 つの要求境界——`server/http/request.ts` と
`client/http/request.ts`——だけです。**画面ごとの事前チェックは置きません。** 閾値は画面からは
原理的に分からず、置けば画面の数だけ当て推量の定数が増えます。超過は `uri-too-long` として落ち、
画面には `errors` の分類 1 つとして現れます（[0080](../../docs/adr/0080-error-handling.md)）。

## ブラウザ発のテレメトリの中継

**ブラウザから collector を直接叩かせません**（[0081](../../docs/adr/0081-observability-logging.md)）。
endpoint も資格情報もブラウザへ出さず、同一オリジンの BFF が受けて OTLP へ載せます。この経路は
3 つに分かれ、境界ごとに持ち物が違います。

| 置き場 | 持つもの |
| --- | --- |
| `http/telemetry-report.ts` | 送る側と受ける側が共有する報告の形。型と、送る前に切り詰める長さだけ |
| `client/telemetry/report-telemetry.ts` | 測定と例外を報告へ組み、`sendBeacon` で送る |
| `client/telemetry/browser-tracer.ts` | ブラウザ側の計装。動的な import でだけ読まれる |
| `server/telemetry/browser-telemetry.ts` | 報告を検証し、signal へ載せる |
| `server/telemetry/browser-traces.ts` | ブラウザが作った span を collector へ渡す |
| `server/taint/taint.ts` | server の object と秘密値を、Client Component へ渡せないものとして登録する |

**検証は受け側にしかありません。** 送る側にも同じ長さの宣言がありますが、それは通信量を抑える
ためのもので、送信者は差し替えられます。認証を要求しない口なので、受け側が自分で確かめます
（[0077](../../docs/adr/0077-bff-abuse-protection-boundary.md)）。

**`observability` を import できるのは受け側だけです。** Web Vitals は指標ごとのヒストグラムとして
出すため OTel の Metrics API へ、例外は返ってきた `traceparent` の文脈で記録するため trace 相関の口へ
触ります（[0082](../../docs/adr/0082-client-observability.md)）。
**この許可は `client/` にも機械的に及びます。** 境界検査の要素は `adapters` ひとつで、`server/` と
`client/` を区別しません（層より細かい単位を分けているのは `features` だけです）。効いているのは
**`observability` の側が `server-only` を名乗っていること**で、client から引いた時点でビルドが落ちます。
同じ形は `config` にもあります —— ADR 0021 は server config を `adapters/server` だけに許しますが、
機械強制は層の粒度で当たります。

**ブラウザ側の計装は動的な import でだけ読みます。** 要求境界（`client/http/request.ts`）は画面を
開いた時点で読まれるので、そこから OTel へ辺を張ると計装の重さが初期の読み込みに乗ります。要求を
span にするのは `fetch` を包む計装のほうで、要求境界のコードは計装を知りません。

**包むのは自分が呼んでいる要求だけではありません。** router が画面遷移と先読みで出す RSC の要求も
対象です。自分で呼んでいる場所だけを包むと、client 遷移が trace から抜けて別の trace の根になります。
そのぶん 1 つの trace に載る span は増えます —— 先読みは見えている画面ぶんだけ出るためです。

## client へ渡してはいけないものを登録する

`server/taint/taint.ts` が [0030](../../docs/adr/0030-environment-variable-management.md) §8 の口です。
汚した object や値を Client Component へ渡すと、**描画が実行時に落ちます**。

| 汚すもの | 例 | 登録する場所 | 寿命 |
| --- | --- | --- | --- |
| 資格情報を含む server の object | session の記録（Access Token / ID Token を持つ） | その object が生まれる場所 | object 自身 |
| PII を含む取得結果 | 連絡先・住所・生年月日を持つ主体の詳細 | 取得の口（契約の形から表示の型へ写した直後） | object 自身 |
| 文字列の秘密 | 署名鍵・外部サービスのキー | その値を**読む側**（`config` は react を持ち込めない） | 値を持つ singleton |

**何が PII かはここが決めません。** 分類とその置き場は
[0112](../../docs/adr/0112-data-classification-cache-boundary.md) が持ち、ここはその分類を実行時の
関所へ写すだけです。

### 参照実装

取得の口で、写し終えた値を汚します。**呼び出し側では汚しません** —— 口が増えるたびに同じ 1 行が
要り、書き忘れた経路がそのまま穴になります。

```ts
export const getAccount = cache(async (): Promise<Account> => {
  const account = toAccount(
    await getClient().request({ path: "/v1/accounts/me", schema: GetAccountResponse }),
  );

  taintObjectReference(
    "主体の詳細には連絡先が含まれます。Client Component へ渡すのは画面が使う項目だけにしてください",
    account,
  );

  return account;
});
```

文字列の秘密は、値そのものを登録します。参照で追えないためで、登録の寿命はその値を持つ singleton
に握らせます。

```ts
taintUniqueValue("署名鍵は server 専用です", config, config.sessionSecret);
```

**メッセージは落ちた人が読む唯一の手掛かりです。** 「渡すな」だけでなく、代わりに何を渡すのかまで
書きます。落ちる場所は渡した側で、そこに居る人は何を選べばよいかを知りません。

**主機構ではありません。** 参照でしか追えないので、コピー（`{ ...record }`）にも派生値
（`` `Bearer ${token}` ``）にも及びません。主防御は取得範囲と Client DTO の最小化で、これはそこを
抜けた誤送信を実行時に捕まえる補助です（[0112](../../docs/adr/0112-data-classification-cache-boundary.md) 段 4）。

**`react` を直接呼ばず、この口を通します。** テストはこのモジュール境界を差し替え、本物が効くことは
`taint/taint.test.ts` が RSC の直列化器で確かめます。防御の中に「口があれば呼ぶ」分岐を置かないため
です —— 置くと、口が消えた日に検査ごと黙って外れます。

## 運用

- **`integration` の宣言が掛かるのは、外部との往復を持つモジュールです**。`fetch`（または注入された
  `fetchImpl`）を直接持つものが対象で、そこでは HTTP 境界だけを対象に、内側を mock して型と形を
  確かめます（[0090](../../docs/adr/0090-testing-strategy.md)）。**外部 IO を持たない純粋な変換**
  （`http/url-budget.ts` / `server/http/search-params.ts` / `server/http/retry-policy.ts` /
  `server/http/error-status.ts` / `server/http/error-response.ts` / `server/http/json-request.ts` /
  `client/telemetry/route-pattern.ts` / `server/telemetry/browser-telemetry.ts` など、境界の前後で
  値を写すだけのもの）は、その変換自体を `unit` の
  形——HTTP を模さず値を直接照合する——で検証します。境界を持たないものへ境界のテストを課しても、
  確かめる相手が無いためです。**`http/` はこの形しか置きません**——実行文脈を持たない規則の置き場
  なので、外部との往復を持つものは `server/` か `client/` に属します
- **`use cache` を持つ口では、寿命 profile の名前と `cacheTag` の引数も観測の対象に含めます**。HTTP
  境界の外側にある宣言ですが、綴りを取り違えても型検査も lint も落ちず、実行時に「無効化したのに古いまま」
  という形でしか現れません。`next/cache` をモジュール境界で差し替え、口が何を名乗ったかを確かめます。
  **確かめられるのはそこまでです** —— 名乗った profile 名が `next.config.ts` に実在するか、実際に
  キャッシュが効くかは、この層では分かりません（前者は build、後者は殻の実測が持ちます）

- `server/` は server config を利用でき、`client/` は secret を利用しない
- 外部型・生成型はここで変換し、内側へ漏らさない

## 関連する ADR

この層のコードが依存する決定です。**コメントからは ADR を直接指さず、この節を辿ります** ——
ADR は番号も節も動くので、動いたことに気づける場所を 1 つに寄せています（[docs/rules.md](../../docs/rules.md)
「コメントと文書」）。子ディレクトリの README を持つ区画（[`server/auth`](server/auth) /
[`server/http`](server/http) / [`server/telemetry`](server/telemetry) /
[`client/telemetry`](client/telemetry) / [`gen`](gen)）は、そちらの節が持ちます。

- [0024](../../docs/adr/0024-adapters-server-client-split.md) — `server/` と `client/` の分割と、client 側の外部接続境界
- [0021](../../docs/adr/0021-frontend-responsibility.md) — 層の責務と import 境界（server config を引けるのは `server/` だけ）
- [0020](../../docs/adr/0020-adopted-architecture.md) — 内向きの依存と、外部型を内層へ漏らさないこと
- [0070](../../docs/adr/0070-backend-role-separation.md) — バックエンドとの責務の線。業務ロジックを持たないこと
- [0071](../../docs/adr/0071-bff-api-integration.md) — 外部 API クライアントと fetch wrapper、取得の口が寿命を持つこと
- [0073](../../docs/adr/0073-pagination-fetch-boundary.md) — ページングと増分取得の取得境界
- [0075](../../docs/adr/0075-file-upload-seam.md) — ファイルアップロードの seam（署名付き直接 PUT と多重部の例外）
- [0079](../../docs/adr/0079-auth-frontend-seam.md) — 資格情報を組む境界と、主体を名乗る要求の扱い
- [0080](../../docs/adr/0080-error-handling.md) — バックエンド由来の失敗を分類へ正規化すること
- [0081](../../docs/adr/0081-observability-logging.md) — ブラウザから collector を直接叩かせず、BFF が中継すること
- [0082](../../docs/adr/0082-client-observability.md) — Web Vitals と client 例外の収集、送信面の置き場
- [0112](../../docs/adr/0112-data-classification-cache-boundary.md) — 取得の口が分類を宣言し、キャッシュと資格情報の口を型で塞ぐこと
- [0030](../../docs/adr/0030-environment-variable-management.md) — secret の扱いと、client へ渡せないものを登録する口
- [0040](../../docs/adr/0040-routing-rendering-strategy.md) — 再検証の契機（取り直しが起きるまで古い値が残ること）
- [0090](../../docs/adr/0090-testing-strategy.md) — 層別の検証責務（`integration` が掛かる範囲）
