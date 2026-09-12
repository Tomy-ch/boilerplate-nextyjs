# クライアント観測性(Web Vitals RUM / client エラー収集 / プロダクト分析 seam)

[0081](0081-observability-logging.md) が「ブラウザ側テレメトリは BFF 中継を seam とする」と器だけを定め、[0101](0101-performance-budget.md) が一次指標に Core Web Vitals を採用しながら **field 値(RUM)の収集経路** を本 ADR へ委ねる。本 ADR は、この 0081 seam に載せる **ブラウザ発の経路 —— ブラウザ側の trace / Web Vitals RUM / client エラー収集 / プロダクト分析 —— を確定** する。いずれも「ブラウザから外へ出る IO」であり、送信面は [0024](0024-adapters-server-client-split.md) が明示配置した `adapters/client` に置く。

## Status

Accepted (一部 exclusion)

## 背景

[0081](0081-observability-logging.md) はサーバ側の構造化ログ / OTel / vendor-neutral OTLP を確定し、ブラウザ側については「クライアントで計測した値は `/api/*`(BFF)経由でサーバへ送り、サーバ側で OTLP export する(直接 SaaS へ送らない)」という **seam の宣言** までを行う。何を流すか(CWV field 値 / client エラー / ユーザ行動)は 0081 本文では列挙されない。

- **Web Vitals RUM**: [0101](0101-performance-budget.md) は一次指標を CWV(LCP / INP / CLS)としつつ計測を lab(CI Lighthouse)に限るため、field 値の経路が無いと **「指標はあるがフィールド値が無い」** 状態になる。
- **client エラー収集**: [0080](0080-error-handling.md) / [0081](0081-observability-logging.md) はサーバ側で完結し、ブラウザで起きたエラーはどこにも残らない **観測性の片翼欠落** になる。
- **プロダクト分析 seam**: [0131](0131-cookie-consent.md) が「運用テレメトリはユーザ行動トラッキングと区別する」と線を引いた側(= 行動トラッキング)。SaaS 非同梱でも、計測呼び出しがコンポーネントに直書きされるか抽象を通るかは本体の構造問題として残る。

[0024](0024-adapters-server-client-split.md) が `adapters/client` element を立て、その「中身」列に **telemetry 送信 / analytics 送信** を明示的に割り当てているため、経路の物理的な家は確定している。本 ADR はその家に載る送信内容と発火・ゲートの方針を定める。

## 決定

経路はすべて 0081 の **ブラウザ→BFF 中継 seam** に載せる。送信面 = `adapters/client`([0024](0024-adapters-server-client-split.md))、受け = `app/route-handler`(`route.ts` → `adapters/server` → OTLP / サーバログ。[0025](0025-app-layer-elements.md) の thin proxy)。**ブラウザから直接 SaaS / collector へ送らない**(0081 禁止事項)。

**収集と送信は `observability` カーネルではなく `adapters` に置く。** `observability` が持つのは OTLP export の口と計装であって、ブラウザ発の送信を組み立てる経路(`adapters/client`)と、受けて signal へ載せ替える経路(`adapters/server`)は外部との IO であり、[0024](0024-adapters-server-client-split.md) の家に属する。

4 経路は、載せる signal で分かれる。

| 経路 | signal | 中継の口 |
| --- | --- | --- |
| ブラウザ側の trace(§0) | traces | OTLP をそのまま渡す口 |
| Web Vitals RUM(§1) | metrics | このリポジトリが決めた形の報告を受ける口 |
| client エラー(§2) | logs | 同上 |
| プロダクト分析(§3) | — | 中継を通らない。タグマネージャが配信元と直接やり取りする |

口を 2 つに分けるのは、**契約の出所が違う**ためである —— OTLP は OTel が決めるので読み替えずに渡し、報告の形はこのリポジトリが決めるので検証して signal へ載せ替える。

### 0. ブラウザ側の trace = 採用

- ブラウザで **OTel の Web SDK** を動かし、ブラウザ発の外向き要求を span にする。export は中継経由で、collector の endpoint も資格情報もブラウザへ出さない(0081)。
- **包むのは `fetch` すべてである。** 自分で呼んでいる取得だけを包むと、router が画面遷移と先読みで出す RSC の要求が抜け、別の trace の根になる。そのぶん 1 つの trace に載る span は増える。
- **span 名は方式とパスで置く**(`GET /docs/[slug]` ではなく実際のパス)。計装の既定は方式だけ(`GET`)で、どの経路への要求かを持たない。クエリは名前に載せない —— 条件は要求ごとに違うので、載せると同じ経路が別の名前へ散る。
- **ブラウザは自分の trace を始めない。** 画面を組んだ要求の `traceparent` をサーバから受け取って親に取る。こうすると SSR から、その画面が後で出した取得までが 1 本の trace になる。渡らない実行(静的生成された画面)では新しい trace を始める。
- **計装は最初の描画の後に読み込む。** 計測のための資材を初期の読み込みへ載せると、[0101](0101-performance-budget.md) が一次指標に置く当の値を悪くする。
- **service 名は中継が上書きする。** 認証を要求しない口なので、ブラウザの名乗りをそのまま通すと誰でも任意の service の trace へ span を書ける。ブラウザは自分がどの service の一部かを知る必要がない。
- **vendor-independent**: OTel の SDK は CNCF の実装であって観測性 SaaS ではなく、送り先は任意の OTLP バックエンドである(§1 と同じ論理)。

### 1. Web Vitals RUM = 採用

- `useReportWebVitals`(Next.js 組込 hook)で LCP / INP / CLS 等を収集し、同一オリジン BFF 経由でサーバへ送り、**サーバ側で OTLP export**(0081)する。これで [0101](0101-performance-budget.md) の lab 計測(CI Lighthouse)に対する **field 値の欠落経路を閉じる**。閾値は置かない —— [0101](0101-performance-budget.md) の予算は lab の側が持ち、field 値は分布として読む。
- **vendor-independent 正当性材料**([0010](0010-standards-and-non-lockin.md)): CWV は web.dev / W3C 由来の業界標準指標(0101 が既に一次指標として独立採用済み)/ 送信 transport は OTLP/OTel = vendor-neutral(0081)/ BFF 中継は secret 非露出([0030](0030-environment-variable-management.md))と lock-in 回避。**RUM 観測性 vendor SDK(Datadog RUM 等)を正当化から抜いても、CWV を OTLP/OTel で収集する構成は成立** する = 非ロックイン(0081 のスタンスは OTLP/OTel vendor-neutral・vendor SDK 非同梱であり、特定 vendor を前提としない)。`useReportWebVitals` の使用は「App Router を選んだ」既決の帰結(0010 §2)であって機能固有ロックインではない。
- **RUM 観測性 SaaS は同梱しない(exclusion)**(0081 と一致。Collector / OTLP 経由を基本とする)。
- **サーバ側では metric(指標ごとのヒストグラム)として持つ**。求めるのは実利用者ぶんの百分位であり、1 件ずつのレコードから毎回それを組むより計器の側が分布を持つほうが、読む手数も保持のコストも小さい。公式 semantic convention が web vitals へ与えているのは `browser.web_vital` という event 名だけで metric 名を定めていないが、event で出すと 1 レコードごとに中継要求の span が付き、測定が起きていない要求と親子になる。
- これは **運用テレメトリ(パフォーマンス)** であり、[0131](0131-cookie-consent.md) が consent gate の対象とする **ユーザ行動トラッキングとは区別** される。→ **既定で consent gate の対象外**(下記 §4)。

### 2. client エラー収集 = 採用

- `window` の `error` / `unhandledrejection` を捕捉し、BFF 中継で **サーバログ**(0081)へ送る。**エラー境界が捕まえた例外はこの経路に乗らない** —— React は明示的な境界の捕捉を`console.error` へ流すだけで `error` を発火しないため、境界でも記録したいなら境界の側から報告する。
- **記録は画面を組んだ要求の trace へ紐づける**(§0 の `traceparent` を報告に載せて返す)。渡らなければ trace を付けない —— 中継要求の span を付けると、例外が起きていない要求と親子になる。
- エラー分類は `errors` カーネルのセンチネル([0080](0080-error-handling.md))を用いる。**送る側は 1 回のページ読み込みで打ち切り件数まで**とし、**サンプリングは持たない** —— 率が要るなら中継の口の手前へ足す。
- **伏せるのは受け側**で、[0081](0081-observability-logging.md) の名前の表に当たる属性だけを落とす。**例外の文言と stack の中身は無害化しない** —— この層が始末できるのは自分が組み立てた値だけである([0070](0070-backend-role-separation.md) 境界値の所有)。文言に載せてよいものは呼び出し側が決める。
- **vendor-independent**: ブラウザ側エラーの可視化は 0080 / 0081 がサーバ側で完結していた観測性の片翼を埋めるもので、収集経路は構造化ログ / OTLP(0081)= vendor-neutral。エラー監視 SaaS は同梱しない(§1 と同じ exclusion 論理)。
- **運用テレメトリ扱い**(consent gate 対象外。0131。§4)。

### 3. プロダクト分析 seam = タグマネージャを同梱する

- **タグマネージャを同梱する**([0131](0131-cookie-consent.md) §2)。同梱するのは**容器を読み込む口だけ**で、何を計測するかは容器の中身が持つ。したがって本体は発火 IF も no-op sink も持たない —— **発火する呼び出しがコードに 1 つも無い**ためである。
- **物理配置 = `app` の client island**(`src/app/analytics.tsx`)。`adapters/client` ではない。あそこが受け持つのは**このアプリが送信を組み立てる経路**(§1 RUM / §2 client エラー)であり、タグマネージャは**読み込むだけで送信は容器の中身が行う**。送信の組み立てを持たないものに source adapter を立てても、通り道が 1 つ増えるだけになる。
- **タグから値を送るようになった時点で、発火 IF を `adapters/client` へ立てる。** そのとき初めて「直書き vs 抽象を通す」という構造問題が実在する。本体が先に空の IF を置くことはしない。
- **`dataLayer` へ値を渡してよいのはこの island だけ**とする。feature / component から直接触ると、何が外へ出るかが散る。
- **consent gating**: プロダクト分析は 0131 の consent 対象(ユーザ行動トラッキング)そのものである。掛け方は**呼び出しの手前で述語を見る形ではなく、島そのものを mount しない形**を採る —— [0031](0031-policy-state-supply.md) の純関数 gate 述語(既定 = 「未同意で全 gate」)が偽である間、`src/app/consent.tsx` は島を描かない。**要素が在る時点で取得が始まる資材は、述語では止められない**(0131 §1)。gate の具体粒度・consent ソースは用途依存でここでは定めない(0031 と一致)。
- **vendor-independent**: 同梱するのは容器を読み込む口だけで、**どの計測ベンダーへ繋ぐかは容器の中身が持つ**。ベンダーを替えても本体のコードは変わらない。外すのは容器 ID を空にするだけで済み、外した配備の初期 JS にライブラリは載らない([0131](0131-cookie-consent.md) §2)。

### 4. consent gate の線引き(運用テレメトリ vs 行動トラッキング)

[0131](0131-cookie-consent.md) は consent gate の対象を **ユーザ行動トラッキング** に限り、[0081](0081-observability-logging.md) の運用テレメトリと区別する。本 ADR はこの線をそのまま適用する:

- **RUM / client エラー = 運用テレメトリ → 既定で gate 対象外**(パフォーマンス / 障害の運用計測)。
- **プロダクト分析 = 行動トラッキング → gate 必須**(§3。0031 述語)。
- ただし **field RUM を同意対象とする法域要件があり得る**ため、RUM / client エラーに gate を掛けたい場合は §3 と同じ 0031 gate 述語を再利用できる拡張点を残す(本体既定は保守的に operational 扱い)。この境界は法域依存で本体では固定しない。
- **同じブラウザからの訪問を繋ぐ識別子は、同意が得られている間だけ配る。** 未同意のうちに配ると、識別子を渡してから同意を尋ねることになる。**同意が外れたら消す** —— 期限切れ・利用者による削除・選び直しのいずれも同じ扱いにする。これは前捌きを含む機構全体の約束であり、島の mount / unmount だけでは足りない(識別子は cookie として残る)。

### 5. BFF エンドポイントの物理

- 本 ADR が確定するのは **seam**(0081 中継 / `adapters/client` 送信面 / `adapters/server` 受け)と、**中継の口を契約の出所で 2 つに分ける**こと(§決定の表 —— OTLP をそのまま渡す口 / このリポジトリが決めた形の報告を受ける口)である。報告を受ける口を signal ごとに更に分けるかは用途依存で本体は固定しない。
- **中継エンドポイントの保護**(レート制限 / ボディサイズ上限 / 無認証エンドポイントの abuse 対策)は **本 ADR の射程外**。これは infra ドメイン寄りの境界 seam = [0077](0077-bff-abuse-protection-boundary.md) が所有する。本 ADR は送信経路のみを定め、保護方針は 0077 を参照する(密結合のため相互参照で局所推論を保つ)。

## 禁止事項

- ❌ ブラウザから直接 SaaS へ RUM / エラーを送ること(BFF 中継 seam。[0081](0081-observability-logging.md))。**唯一の例外が同意ゲートの裏のタグマネージャ**で、これは中継へ通すことが原理的にできないため、[0131](0131-cookie-consent.md) §2 が帰結ごと引き受ける。**例外はその経路に閉じる** —— §1 の RUM と §2 の client エラーは中継を通したままにする
- ❌ 観測性 SaaS SDK を同梱すること([0081](0081-observability-logging.md) の OTLP 中立に反する)。**プロダクト分析のタグマネージャは [0131](0131-cookie-consent.md) §2 が同梱を決めており、この禁止の対象外**
- ❌ `dataLayer` を同意ゲートの島(§3)以外から触ること。発火 IF を立てた後は、その IF を通さず直書きすることも同じく禁じる([0031](0031-policy-state-supply.md))
- ❌ プロダクト分析を consent gate 無しで発火させること(0031 gate 述語必須。[0131](0131-cookie-consent.md))
- ❌ 訪問を繋ぐ識別子を未同意のうちに配ること / 同意が外れた後も残すこと(§4)
- ❌ [0081](0081-observability-logging.md) の名前の表に当たる属性を、伏せずに載せること
- ❌ 例外の文言や stack が伏せられている前提で、そこへ主体固有の値を載せること(中身は無害化しない)
- ❌ ブラウザ発の送信面を `adapters/client` 以外(feature / component の生 fetch 等)に置くこと([0071](0071-bff-api-integration.md) / [0024](0024-adapters-server-client-split.md))

## 補足

- **consent の結線**: プロダクト分析は [0031](0031-policy-state-supply.md) の gate 述語で結線する(掛け方は島を mount しない形。§3)。RUM / client エラーの consent 要否は **法域依存で本体では確定せず**、operational = gate 対象外の保守的既定 + 0031 述語の再利用拡張点、に留める(§4)。
- **保護は [0077](0077-bff-abuse-protection-boundary.md) へ委譲**(§5)。無防備な公開中継エンドポイントの保護は別ドメイン寄りの境界 seam であり、参照先が本 ADR 外に分散する点を明示。
- 送信の具体実装(バッチ / `sendBeacon` vs `fetch` / サンプリング率)は用途依存(本体が備えるのは seam までで、§1 RUM / §2 client エラーの話である)。
- **計測製品そのものを本体が選ぶことはしない**: 同梱するのはタグマネージャ(容器を読み込む口)までで、容器の中に何を入れるかはここでは定めない。SaaS の SDK を直接同梱すると、その 1 つを選んだことが選択肢を狭める —— タグマネージャなら、繋ぎ替えは容器の中身の入れ替えで済む。タグから値を送るようになったとき発火 IF をどこへ立てるかは §3 が持つ。**consent gate 述語は [0131](0131-cookie-consent.md) / [0031](0031-policy-state-supply.md) 側に実在する**。なお §1 RUM / §2 client エラーは運用テレメトリ(0081・OTLP)であり、本注記の対象外。

## 関連 ADR

- [0081-observability-logging.md](0081-observability-logging.md) — ブラウザ→BFF 中継 seam / OTLP-only / SaaS 非同梱。本 ADR はその経路を具体化する
- [0101-performance-budget.md](0101-performance-budget.md) — CWV 一次指標 / lab 計測。本 ADR が field 値(RUM)収集経路を補完
- [0131-cookie-consent.md](0131-cookie-consent.md) — consent gate 対象 = 行動トラッキング(プロダクト分析)/ 運用テレメトリ(RUM / client エラー)との区別
- [0024-adapters-server-client-split.md](0024-adapters-server-client-split.md) — `adapters/client`(**このアプリが送信を組み立てる**経路の家。タグマネージャはここに置かない —— §3)
- [0031-policy-state-supply.md](0031-policy-state-supply.md) — consent gate 述語の供給(プロダクト分析は述語が真の間だけ島が mount される)
- [0080-error-handling.md](0080-error-handling.md) — エラー分類センチネル / redact(client エラーの分類・masking)
- [0077-bff-abuse-protection-boundary.md](0077-bff-abuse-protection-boundary.md) — 中継エンドポイントの保護(§5 の委譲先)
- [0071-bff-api-integration.md](0071-bff-api-integration.md) — client→BFF fetch 経路(送信の実装層)
- [0030-environment-variable-management.md](0030-environment-variable-management.md) — secret 非露出 / BFF runtime config(BFF 中継の根拠)
- [0010-standards-and-non-lockin.md](0010-standards-and-non-lockin.md) — 標準準拠 + vendor-independent 正当化(RUM 経路の正当性の土台)
