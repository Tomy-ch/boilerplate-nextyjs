# BFF / API 統合

バックエンド API を呼ぶ **API クライアントの配置 / fetch wrapper の resilience(timeout / retry / retry budget / circuit breaker)/ エラー正規化 / response の runtime 検証の受け取り点** を定める。[0070](0070-backend-role-separation.md) の thin proxy・境界値所有を、実際の HTTP 呼び出し層としてどう実装するかを確定する。

## Status

Accepted

## 背景

`/api/*` の責務範囲・外部 API クライアントの場所・fetch wrapper(retry / timeout / error 変換 / logging)を本 ADR が確定する。コンポーネントに ad-hoc な fetch を散らさず、retry・timeout を各所で独自に実装しないことが前提であり、その代わりに outbound を 1 つの wrapper へ集約して、そこに resilience を持たせる。

outbound HTTP が持つべき resilience は **dual timeout / idempotent retry / retry budget / circuit breaker** の 4 つである。timeout が 1 段だと「1 回の試行を諦める」と「呼び出し全体を諦める」を区別できず、retry は非冪等な要求を重複させ、budget が無い retry は劣化した下流へ負荷を積み増し(retry storm)、breaker が無いと劣化中も叩き続けて fail-fast できない。本 ADR はこの 4 つを既定値付きで wrapper に持たせる。

## 決定

### API クライアントの配置 = `adapters` カーネル

- バックエンド API クライアント(fetch wrapper)は **`adapters` カーネル**に置く([0021](0021-frontend-responsibility.md)。`config` を import できる唯一の層 / 外部接続の所有境界)。生の `fetch` をコンポーネント・feature に散らさない。**`adapters` は server / client の 2 element に分割される**(server = backend client・secret 有・config 可 / client = 同一オリジン BFF fetch・WebSocket・telemetry 送信・secret 不可)。詳細は [0024](0024-adapters-server-client-split.md) が正。本 ADR の resilience(dual timeout / retry / breaker)は主に `adapters/server` に適用する
- 生成型・zod スキーマ([0072](0072-api-type-generation.md))の**変換もこの境界で所有**する([0070](0070-backend-role-separation.md) 型漏洩禁止)

### fetch wrapper の resilience

すべての outbound を fetch wrapper 経由に集約し(生 `fetch` を直接使わない)、以下を備える:

- **dual timeout**: **per-attempt timeout** と **overall timeout** の二段を `AbortSignal` / `AbortController`(`AbortSignal.timeout()`)で表現する。backoff が overall を超える場合は retry を skip(deadline 尊重)。既定値は per-attempt 3s / overall 10s とし、per-downstream に調整可能とする。**試行回数の上限は 3** —— overall 10s は per-attempt 3s の 3 倍を少し超える値であり、それ以上の試行は overall に阻まれて実行されない
- **retry**: **idempotent メソッド(GET / PUT / DELETE)は retryable**、**POST / PATCH は明示 opt-in**(idempotency key 付与時のみ)。retryable 条件 = 5xx / 429 / transport error。**exponential backoff + full jitter**、`Retry-After` ヘッダを尊重する
- **retry budget**: per-downstream の token bucket(既定 10%)で retry storm を防ぐ
- **circuit breaker**: closed / half-open / open の状態機械(既定: 失敗率 0.5 / サンプル 20 / open 5s / half-open probe 3)。単一バックエンドでも、劣化時に叩き続けず fail-fast するために持つ
- per-downstream の **Profile**(timeout / retry / breaker 設定)で調整し、未指定は既定 Profile を使う

**接続口は downstream と分類([0112](0112-data-classification-cache-boundary.md))の組ごとに 1 つ置く。** retry budget と circuit breaker は client の中に状態として載るため、同じ downstream へ client を複数組むと、劣化したかどうかの判断が分けた数だけ割れ、budget も breaker も設計値どおりに働かない。public 側は「データ取得のキャッシュ・再検証」節の、分類ごとに 1 つ置いた接続口がこれを兼ねる。

**user-scoped 側は 1 つの接続口へ寄せていない。** 寄せるには、資格情報の取得口を client へ渡す形を 1 か所へ集めることになり、[0112](0112-data-classification-cache-boundary.md) 決定 5 の検査(`project-rules/no-captured-bearer-token`: 取得口には import した口だけを渡せる)と正面から交差する —— 集めた側が取得口を引数で受け取れば検査が通さず、集めた側が取得口を自分で import して固定すれば、資格情報の解決経路が「呼ぶ口を読めば分かる」場所から 1 段離れ、検査が守っている前提が動く。どちらも決定 5 の検査の形と同時にしか決められないため、寄せるなら両方を 1 つの改定として扱う。それまで user-scoped の接続口は各取得口が自前で組み、その module 変数に固定する。**user-scoped でも downstream ごとに 1 つが原則で、破るなら理由をその場に書く。** 強制: 散文。「同じ downstream か」は `baseUrl` の実行時の値で決まりコードの形からは決まらないため、1 つへ寄せるまでは機械へ寄せられない。寄せた後は「client を組む kernel を直に引けるのは接続口だけ」という import 制限へ寄せられる(public 側で `project-rules/no-user-scoped-in-cached-module` が採る形)。

### エラー正規化(生 status を漏らさない)

- 生の HTTP status を上位(feature / UI)に漏らさず、**`errors` カーネルの分類(sentinel)へ正規化**する([0021](0021-frontend-responsibility.md) errors)。HTTP status → 安定エラーコード(`NOT_FOUND` / `VALIDATION_FAILED` 等)の対応表を wrapper が持つ
- **正規化テーブル・ユーザ向けメッセージ変換の詳細は [0080](0080-error-handling.md) が正**。本 ADR は「adapters が生 status を正規化して errors 分類で返す」境界の存在を定める
- ログは `logging` カーネル([0021](0021-frontend-responsibility.md)。config 値は注入で受ける)

### response の runtime 検証の受け取り点

- response は **`adapters` 境界で runtime validation**(zod `.parse()`)する。これは [0070](0070-backend-role-separation.md)(境界値所有 = フロントが契約破れの最後の砦)を実装する点であり、検証スキーマの生成は [0072](0072-api-type-generation.md)(orval + zod)が正
- 検証に失敗した response(契約破れ)は正規化エラー(上記)として扱う

### SSRF guard(条件付き)

- フロント → 自社バックエンドの通常経路では SSRF guard は**不要**。`/api/*` BFF が**外部(信頼できない URL)を叩く**場合のみ、egress guard(宛先 allowlist)を検討する。本 ADR は「本体では不要・外部叩き時のみ」の方針のみ記す

### Server Actions

- 変更系の呼び出しは Server Action([0040](0040-routing-rendering-strategy.md)。feature 内 `actions.ts`)から adapters のクライアント経由で行う。Server Action は編成のみ・業務ロジックを持たない

### データ取得のキャッシュ・再検証

[0040](0040-routing-rendering-strategy.md) は「レンダリングモードを強制しない」までを定め、データ取得のキャッシュ設計は本 ADR が持つ。その**データ層のキャッシュ・再検証規約**を確定する(resilience とは別軸。Next.js のデータキャッシュの所有をここに置く):

- **既定は uncached**([0040](0040-routing-rendering-strategy.md) の Next.js 16 事実 = `fetch` は既定でキャッシュされない)を土台とし、**キャッシュは opt-in**。用途を問わないグローバルキャッシュを既定で敷かない
- **キャッシュ指定の所有層**: 何をキャッシュするかの宣言(`use cache` / `cache: 'force-cache'` 等)と再検証(`revalidateTag` / `revalidatePath` / `cacheLife` / `cacheTag`)は、**データ取得を所有する層 = `adapters`(fetch wrapper)と、それを呼ぶ Server Component / feature** が持つ。resilience 同様、コンポーネント各所に散らさず境界へ集約する
- **cache tag 命名**は wire リソース(operationId / エンティティ)に対応させ、[0072](0072-api-type-generation.md) の生成境界と一貫させる。**体系は `<資源>` と `<資源>:<識別子>` の 2 段**とし、資源名はバックエンド契約の集合名に揃える。画面名や feature 名は使わない。**印を付けるのは取得を所有する `adapters` の 1 か所**で、その module が定数として公開し、`features` / `app` はその定数だけを使う。文字列を書く側が増えるほど、綴りの食い違いが「無効化したのに古いまま」という形で現れる
- **ミューテーション後の再検証**: 変更系 Server Action(上記 / [0040](0040-routing-rendering-strategy.md) `actions.ts`)成功後は、影響する tag / path を `revalidateTag` / `revalidatePath` で無効化する(または `router.refresh()`)。「更新したのに画面が古い / 二重に再取得する」を防ぐ既定経路をこの層が定める。**単位はそのデータを所有する取得口**で、所有口がキャッシュに居るなら印を無効化し、居ないなら描き直す。アプリ全体を捨てる呼び方(`revalidatePath("/", "layout")`)は所有境界ではない —— 更新した値がどの画面にも付く外枠に出るときだけの例外とし、理由をその場に書く
- **キャッシュへ入れてよいのは、主体を名乗らずに取れるものだけ**。Data Cache は server 側で共有され、鍵は URL・method・ヘッダ・本文である。資格情報を載せる取得を入れると、鍵が主体ごとに割れて再利用はほとんど起きない一方、入れ物だけが主体の数だけ増える。**入れないものへ印(`next.tags`)を付けない** —— 印は入っているものにしか付かないため、付けた側も無効化する側も、動いていないのに動いて見える
- **重複排除**: 同一リクエスト内の重複 fetch は React `cache()` / fetch memoization で排除し、BFF・バックエンドへの重複呼び出しを抑止する
- **`Cache Components` は有効である**([0041](0041-cache-components-decision.md))。上の既定 uncached はそのまま効き、残したいものに `use cache` を付け、寿命は `cacheLife`、捨てる印は `cacheTag` で持つ。所有層(取得の口とそれを呼ぶ RSC)も、タグの綴りも、ミューテーション連動も変わらない
- **`use cache` を置ける粒度は 3 つ**(page / 関数 / component)。**取得の口の側へ寄せる。** 呼ぶ側へ置くと、同じ取得が呼び出しの数だけ別の寿命を持ち、捨てる印の付け先が散る
- **寿命は profile の名前で名乗る。** 秒数は `next.config.ts` の `cacheLife` に定義した profile が持ち、口の側は「何の寿命か」だけを言う。テンプレートから作った側は口を 1 つも触らずにその値だけを動かせる
- **殻へ載る取得の profile に `expire` を置かない。** `expire` はその時間トラフィックが途絶えた直後の 1 要求へ同期の取り直しを課すため、そこで取得先へ届かないと、殻を配れていたはずの route が丸ごと失敗へ倒れる。置かなければ取り直しは常に背後で起き、失敗しても最後に読めた内容が出続ける
- **`use cache` が確実に残すのは、組み立て時に殻へ焼かれた分だけである。** 既定の入れ物はプロセスのメモリなので、serverless では要求ごとに別のインスタンスへ着地しえて再利用が起きない回があり、デプロイをまたぐと鍵ごと捨てられる。これは `fetch` の `cache: "force-cache"`(Data Cache。デプロイとインスタンスをまたいで残る)から失うもので、**request 時の再利用を保証と読んではならない**。インスタンスをまたいで残す必要が出た作った側は `cacheHandlers` か `use cache: remote` を選ぶ —— どちらも配備先に依存するため、本体は選ばない([0010](0010-standards-and-non-lockin.md))
- **`use cache` の内側の取得に個別のキャッシュ指定(`cache` / `next.tags`)を置かない。** 内側はまとめて外側の寿命に従うため、二重に持つと内側が切れないぶん、外側が取り直しても同じ古い応答を掴む
- **`use cache` を持つモジュールは、client を組む kernel を直に引かない。** **分類ごとに 1 つ置いた接続口**を経由する。直に引けるモジュールは user-scoped な client も組める状態にあり、[0112](0112-data-classification-cache-boundary.md) 決定 4 の段 2 がその import を落とす
- **`use cache` を持つ口は組み立て時にも呼ばれる。** キャッシュの中身は build 中に作られるため、**build 環境から取得先へ到達できることが前提になる**。到達できない環境で組むなら `APP_API_MODE=mock` を選ぶ([0011](0011-no-docker.md) の環境定義) —— そのとき build は契約から生成したハンドラを HTTP の口として立て、取得先を自給する。これは request 時の往復を減らすことと引き換えに受け取る制約である
- **user-scoped な値は `use cache` の下へ置かない**([0112](0112-data-classification-cache-boundary.md))。手段は `use cache: private` に限り、それは明示的な例外能力である。強制は `project-rules/no-user-scoped-in-cached-module` と framework の `next-request-in-use-cache` が持つ
- 具体値(何を・どれだけ・どの tag で)は用途依存のため作った側で確定する(本 ADR は所有層と既定方針 = opt-in・境界集約・ミューテーション連動を定める)

### 実装ライブラリ

- retry / backoff / circuit breaker の実装は、標準 `fetch` + `AbortSignal` を土台に自前で持つ。ユーティリティを足す場合は [0004](0004-library-management.md) の採用フロー(exact pin / `pnpm audit`)を通す

## 禁止事項

- ❌ コンポーネント・feature に生 `fetch` を散らすこと(adapters の wrapper 経由)
- ❌ 生の HTTP status を上位へ漏らすこと(errors 分類へ正規化)
- ❌ 非 idempotent メソッド(POST / PATCH)を idempotency key なしに無条件 retry すること
- ❌ retry budget / circuit breaker なしに retry すること(retry storm 防止)
- ❌ `adapters` の fetch wrapper に業務ロジックを書くこと(外部接続と変換のみ。[0021](0021-frontend-responsibility.md))
- ❌ response を検証せず内層へ流すこと(adapters 境界で zod 検証。[0070](0070-backend-role-separation.md) / [0072](0072-api-type-generation.md))
- ❌ キャッシュ / 再検証の指定をコンポーネント各所へ散らすこと(データ取得の所有層 = adapters / 呼び出す RSC に集約)
- ❌ `use cache` の内側の `fetch` へ `cache` / `next.tags` を置くこと(寿命が二重になり、外側の再取得が古い応答を掴む)
- ❌ 用途を問わないグローバルキャッシュを既定で敷くこと(既定 uncached・opt-in)/ ミューテーション後に影響 tag / path を再検証せず古い表示を放置すること

## 補足

- 再デプロイなしで変えたい値の BFF runtime config 逃し先([0030](0030-environment-variable-management.md) が引き渡した責務)は、本層(BFF / API 統合)で扱う。キャッシュ必須・ユーザー体感レイテンシに載せない。具体設計(エンドポイント / キャッシュ方式)は本 ADR の方針の下で作った側が確定する(設計上の分岐が生じたら本 ADR を追補する)

## 関連 ADR

- [0070-backend-role-separation.md](0070-backend-role-separation.md) — thin proxy / 契約 SSOT / 境界値所有(本 ADR の親決定)
- [0021-frontend-responsibility.md](0021-frontend-responsibility.md) — `adapters` / `errors` / `logging` カーネルの責務・依存
- [0024-adapters-server-client-split.md](0024-adapters-server-client-split.md) — `adapters` の server/client 2 element 分割・client 側外部接続境界(本 ADR の adapters を細分)
- [0072-api-type-generation.md](0072-api-type-generation.md) — 型 + zod 生成(response 検証スキーマの供給元)
- [0040-routing-rendering-strategy.md](0040-routing-rendering-strategy.md) — Server Actions(変更系の呼び口)/ レンダリングモード(データ取得のキャッシュ設計は本 ADR「データ取得のキャッシュ・再検証」節が持つ)
- [0030-environment-variable-management.md](0030-environment-variable-management.md) — BFF runtime config の逃し先
- [0080-error-handling.md](0080-error-handling.md) — HTTP status → エラー分類・ユーザ向けメッセージの正規化テーブル(本 ADR の error 正規化の詳細)
- [0081-observability-logging.md](0081-observability-logging.md) — fetch wrapper のログ / トレース伝播
