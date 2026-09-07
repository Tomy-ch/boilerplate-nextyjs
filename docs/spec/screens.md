# フロント実装リファレンス: 画面一覧 & API 概要

輸入 EC サンプル(go-boilerplate 協調)。nextjs-boilerplate 実装時の入力資料。
詳細な型・エラーコードは `go-boilerplate/openapi/openapi.gen.yaml` を正とする。本書は画面と API の対応関係・実装上の注意点の把握用である。認証だけは `go-boilerplate/docker/mock-auth-server/openapi/openapi.gen.yaml` の mock OIDC 契約を正とする。

- 本書は**サンプルの仕様**であり、[v1 実装計画](../plan/v1-implementation-plan.md) Phase 5 の PR 分解はここを入力とする
- 本書に列挙された画面・feature は**原則としてサンプル破棄(爆破)の対象**であり、**本書自身も消える**。**例外**(ログイン画面等のコア残留分)と正確な境界は [`scripts/setup/remove-sample/sample-manifest.ts`](../../scripts/setup/remove-sample/sample-manifest.ts) の `SAMPLE_PATHS` が正
- backend API の実装計画は [go-boilerplate #596](https://redirect.github.com/Tomy-ch/go-boilerplate/issues/596) を参照する。**未チェックの項目は未実装であり、OpenAPI に追加されるまでフロントから呼び出さない**。本書では現行 OpenAPI に存在する API だけを使用 API として記載する

---

## 0. 認証・共通事項(フロントが意識する範囲)

- 認証は **Next.js BFF が mock OIDC を仲介**する。ブラウザは httpOnly BFF Session Cookie のみ保持し、JWT(Access Token / ID Token)はブラウザに露出しない
- BFF は `GET /.well-known/openid-configuration` で endpoint / issuer を取得し、`GET /.well-known/jwks.json` で署名鍵を取得する。値を画面や feature に直書きしない
- ログインは BFF が `GET /oidc/authorize` へ Authorization Code + PKCE S256 を開始し、callback で `POST /oidc/token` を `application/x-www-form-urlencoded` で呼ぶ。`code_verifier`、`state`、`nonce` は BFF が保持・検証する
- ログアウトは BFF が `POST /oidc/logout` を呼ぶ。IdP の logout は GET ナビゲーションではないため、ブラウザから IdP へ直接遷移しない
- フロントから見た「認証が要る API」は、BFF 経由で Bearer が自動付与される前提で実装する。個別に Authorization ヘッダを組み立てる必要はない
- 401 は「未ログイン / セッション切れ」として扱い、ログイン画面(U9、BFF route)へリダイレクト
- 403 は「ログイン済みだが権限不足」。admin 系画面(A 系)で非 admin ユーザーがアクセスした場合に発生。UI 上は該当ボタン / 導線ごと出し分けるのが基本
- 通貨: 商品の `price` は USD の decimal 文字列、購入集計の金額は USD セント整数である。`displayCurrency=JPY` を明示指定した時だけ `referenceAmount` が参考値として付与される。フロントは「参考」であることを表示上明示する
- カート(U4)は **バックエンドが持つ**(`/v1/carts/me`)。未ログインでも使え、主体はゲストが `X-Cart-Session`、ログイン済みが Bearer で、両方あればログイン済みが優先される。**取得は明細ごとの再評価つき**で、買えない明細・値の変わった明細に `issues` が立ち、小計は `issues` が空の明細だけの合算(参考値)である。ログイン時のゲストからの引き継ぎは BFF が callback で起こす([ADR 0079](../adr/0079-auth-frontend-seam.md) §7)
- 画像は `POST /v1/products/images`(multipart)でアップロードし、backend が発行したオブジェクトキー(`products/{uuid}.{ext}`)を保存する。配信元は Garage の公開エンドポイントで、`next/image` の `remotePatterns` へ allowlist 登録する。**ワイルドカードは使わない**
- 商品説明(description)は **リッチテキスト**(TipTap で作成)。表示側は必ず sanitizer を通す(生の `dangerouslySetInnerHTML` 直接使用は禁止。[実装規約「セキュリティ」](../rules.md)の「`dangerouslySetInnerHTML` は原則禁止する」)
- ページネーションは基本 **cursor 方式**。無限スクロール(増分取得)の画面とページ送り相当の画面が混在するので、画面ごとの実装パターンに注意
- Idempotency-Key が必要な書き込みは購入作成(U6)のみ。二重送信防止として実装すること

---

## 1. 画面一覧(24)

### ユーザー側(12)

| # | 画面 | 使用 API | ざっくり仕様 | フロント実装上の注意 |
| --- | --- | --- | --- | --- |
| U1 | トップ | `GET /v1/products/ranking/quantity` / `GET /v1/products`(新着 sort) / `GET /v1/products/categories` | 売れ筋ランキング・新着商品・カテゴリ導線を並べるだけのトップページ。パーソナライズなし | 分類は `use cache` を持つ口から引くので静的な殻に入り、残る 2 系統を RSC 内で `Promise.allSettled` で取る。`all` は最初の失敗で待機を打ち切るため、成功した系統の結果が使えない。落ちた系統だけを失敗表示へ替える |
| U2 | 商品一覧 | `GET /v1/products`(`after` / `first` / `categoryCodes` / `keyword` / `sort`) / `GET /v1/products/categories` | 検索・絞り込み・並び替え付き一覧 | 条件は `searchParams` に載せ、変わるたびに RSC が再取得する。絞り込みは広い段ではサイドバーで選択即時、狭い段では sheet 内でまとめて確定する(並び替えはどちらの段でも即時)。増分取得は無限スクロール方式。状態で絞り込む口は置かない。`statusCodes` は契約も backend も受け付けて実際に効くが、状態マスタは在庫・販売の 10 状態で売り手の語彙であり、どれを買い手へ出すかが未決のため(公開の可否は `publishedAt` の別軸で、状態マスタとは無関係) |
| U3 | 商品詳細 | `GET /v1/products/{productId}` / `GET /v1/products`(`categoryCodes`) | 単一商品の詳細表示。関連商品は一覧 API をカテゴリフィルタで再利用(専用 API なし) | description はリッチテキストなので必ず sanitizer 経由で表示 |
| U4 | カート | `GET /v1/carts/me` / `PUT /v1/carts/me/items/{productId}` / `DELETE /v1/carts/me/items/{productId}` / `DELETE /v1/carts/me` | 商品追加・数量変更・削除・全消し | **リロードで消えない**。数量は加算ではなく設定(upsert)で、自然キーが冪等性を持つため `Idempotency-Key` は要らない。買えない明細・値の変わった明細は `issues` として画面に出す。カートのサイドバー / drawer の副導線「カートを見る」から入る。**認証を要さない**ため、未ログインでも中身を全画面で確かめられる唯一の経路である |
| U5 | 購入確認 | `GET /v1/carts/me` / `GET /v1/exchange-rates?base=USD&quote=JPY&amount=` / `GET /v1/users/me` | カート内容の最終確認。JPY 表示切替可 | 明細は client から引き継がず**この画面で取り直す**。再評価が入るため、U4 で見た時点から買えなくなった明細・値の変わった明細がここで現れうる。為替 API の `amount` は decimal 文字列。為替取得失敗時は参考額なしで購入自体は継続できる(degrade)。カートのサイドバー / drawer の主導線「購入手続きへ」から入る。認証の内側にある |
| U6 | 購入完了 | `POST /v1/purchases?displayCurrency=JPY` | 購入確定。`details` に `productId` と `quantity` を送信 | OpenAPI 上の `Idempotency-Key` は任意だが、フロントは常に設定する。二重クリック / リロードを防ぎ、`ActionState<T>` で送信状態を管理する |
| U7 | 購入履歴 | `GET /v1/purchases`(`after` / `first`) | 自分の購入一覧 | **無限スクロール(増分取得)方式**。前ページの `nextCursor` を `after` に渡す |
| U8 | 購入詳細 | `GET /v1/purchases/{purchaseCode}` / `PATCH /v1/purchases/{purchaseCode}/pay` / `PATCH /v1/purchases/{purchaseCode}/cancel` | 購入 1 件の明細・商品情報と、その状況でできる操作 | 明細には products と結合した現在の商品名、購入時点の `unitPrice` が含まれる。**できない操作は押せなくするのではなく出さない**。可否は状況の業務キー(`status.code`)から引く。409 は「いまの状況では通らない」として言い分け、読み込み直す導線を添える |
| U9 | ログイン | BFF route → mock OIDC | **Authorization Code + PKCE S256** で IdP へリダイレクト | Go API を一切叩かない。フロントは BFF のログイン URL へ遷移するだけで、Discovery / authorize / token の処理は Route Handler が担う |
| U10 | 登録(オンボーディング) | `GET /v1/prefectures` / `GET /v1/addresses?postalCode=` / `POST /v1/users` | 初回ログイン後の追加情報登録(住所等) | 明示オンボーディングとして実装する。`POST /v1/users` には `Idempotency-Key` を設定し、郵便番号補完が `isFallback=true` なら全項目を手入力する |
| U11 | マイページ | `GET /v1/users/me` / `GET /v1/users/me/purchases/summary` | プロフィール確認・購入サマリ表示・退会導線 | 退会は確認モーダル必須(不可逆操作) |
| U12 | ユーザー更新 | `GET /v1/users/me` / `GET /v1/prefectures` / `PUT /v1/users/{userId}` | プロフィール編集 | U11 とは独立ルート。**CollectAll**(RSC 内 `Promise.all` での並置合成)の実例 |

### admin 側(8)

| # | 画面 | 使用 API | ざっくり仕様 | フロント実装上の注意 |
| --- | --- | --- | --- | --- |
| A1 | ダッシュボード | `GET /v1/dashboard/summary` | 数値カードと、ステータス別内訳の横棒 | サマリは **backend 側で合成済み**の値をそのまま表示する。在庫僅少一覧は契約(`GET /v1/products/low-stock`)が入ったが、A1 は使っていない(独立した後続機能) |
| A2 | 商品一覧 | `GET /v1/products`(`includeUnpublished=true`) / `GET /v1/products/statuses` | admin 操作一覧。作成・編集・補充への導線 | 未公開の商品も母集団に含める。含める指定は admin だけが通せる。母集団を変えると並び順の第 1 キーが登録日時へ変わるため、ページ送りの鍵は同じ指定の中でだけ使える |
| A3 | 商品補充 | `PATCH /v1/products/{productId}/stock` | 在庫数の加算 / 調整のみ | `delta` は符号付き。409 は再取得、503 は時間を空けて再試行する。在庫以外は編集しない(A7 の担当) |
| A4 | 集計 | `GET /v1/dashboard/summary` / `GET /v1/products/ranking/quantity` | 売上・ランキング系の集計表示 | A1 と共通 API を使うが表示観点が異なる。期間は瞬時の半開区間 `[orderedAfter, orderedBefore)` で送り、暦の区分（今日・今月）を解くのは画面の側。売れ筋は直近 30 日に固定し、期間の選択に従わない |
| A5 | ユーザー一覧 | `GET /v1/users`(`page` / `perPage` / `active`) / `DELETE /v1/users/{userId}` | ユーザー一覧・退会操作 | 退会は確認モーダル必須。409 は進行中購入が残るための拒否であり、非同期取消・在庫復元を前提にしない |
| A6 | 商品作成 | `POST /v1/products` / `GET /v1/products/categories` / `GET /v1/products/statuses` / `POST /v1/products/images` | 新規商品登録フォーム | description は TipTap。**画像はアップロード UI**。`price` は USD の decimal 文字列、画像 upload の `imagePath` を作成 API へ渡す |
| A7 | 商品編集 | `GET /v1/products/{productId}` / `PATCH /v1/products/{productId}` / `POST /v1/products/images` | 既存商品の編集フォーム | 読み込んだ `version` を必ず送る。409 時は「他の人が更新済み」の再読み込み導線を表示する。在庫数はここでは編集不可(A3 の担当) |
| A8 | 発送 | `GET /v1/purchases/shippable` / `PATCH /v1/purchases/{purchaseCode}/ship` / `GET /v1/purchases`(`statusCodes=8` + `includeOtherUsers=true`) / `PATCH /v1/purchases/{purchaseCode}/deliver` | 支払い済み・未発送の注文を、まとめて発送してよい便ごとに並べて発送する。発送済みの注文はその下に並べ、1 件ずつ配達済みにする | 便の分け方も並び順も契約が決めるので画面は並べ直さない。発送は購入 1 件ずつなので、まとめる操作は同じ送信に注文を並べて送る。途中まで通った送信を失敗にせず、通った件数と通らなかった件数を両方出す。確認は挟まない(流れ作業のため)。配達の確認はまとめる軸を持たず常に 1 件 —— 届いたかどうかは注文ごとに分かれる |

### 輸入元に無い画面(4)

輸入した EC サンプルには無く、この repo が足した画面である。**題材(EC)を持つのは静的 3 画面の
うち「このサイトについて」だけ**で、残りは boilerplate 自身の説明と開発用の面なので、サンプルを
捨てた後も `/dev/session` は残る。

| # | 画面 | 使用 API | ざっくり仕様 | フロント実装上の注意 |
| --- | --- | --- | --- | --- |
| S1 | このサイトについて(`/about`) | — | 何のためのサイトか・何で出来ているか・何が動かないか | 取得を持たない。静的に描画する |
| S2 | プライバシー(`/privacy`) | — | 入力した情報がどこに残るかを、起動のしかたごとに 3 通りで説明する | 定型文にしない。利用者が自分の起動構成を判断できる形で書く |
| S3 | 利用規約(`/terms`) | — | 閲覧の同意・セキュリティ上のリスク・提供条件・免責 | 免責はこの画面だけが持つ。S1 に写さない |
| D1 | 開発用 session(`/dev/session`) | — (IdP の口のみ) | IdP を通さずに session を発行し、保護された画面へ入る | production build には route ごと入らない。開ける環境の判定を画面と Server Action の両方に掛ける |

### 合成パターンの使い分け(実装判断の指針)

- **backend 合成(A1)**: 表示にドメイン計算(集計)が絡む → バックエンドが 1 本の API で合成済みレスポンスを返す。フロントは複数 API をまたいだ計算をしない
- **CollectAll(U12)**: 複数の独立したリソースを単に並べるだけ → フロント側(RSC 内)で並行 fetch して合成してよい

---

## 2. API 概要一覧

### Product 系

| Method / Path | 認証 | 用途 | フロントが送る主な項目 | 主なレスポンス項目 | 主なエラー |
| --- | --- | --- | --- | --- | --- |
| `GET /v1/products` | 不要(`includeUnpublished=true` は要 admin) | 一覧(cursor + フィルタ + keyword + sort) | after, first, categoryCodes, statusCodes, keyword, sort, includeUnpublished | items[], nextCursor | 400, 401, 403 |
| `GET /v1/products/{productId}` | 不要 | 詳細 | — | 商品詳細(description 含む) | 400, 404 |
| `GET /v1/products/categories` | 不要 | カテゴリマスタ | — | categories[] | — |
| `GET /v1/products/statuses` | 不要 | ステータスマスタ | — | statuses[] | — |
| `GET /v1/products/ranking/quantity` | 不要 | 売れ筋ランキング(数量順) | orderedAfter, orderedBefore, limit | ranked items[] | 400 |
| `POST /v1/products` | 要 admin | 商品作成(A6) | name, description(rich text), price(decimal 文字列), categoryId, statusId, imagePath, quantity | 作成後の商品 | 400, 401, 403, 422 |
| `PATCH /v1/products/{productId}` | 要 admin | 商品更新(A7)。在庫以外の項目 | version と部分更新フィールド | 更新後の商品 | 400, 401, 403, 404, **409(楽観ロック)**, 422 |
| `PATCH /v1/products/{productId}/stock` | 要 admin | 在庫補充(A3) | delta | 更新後の商品 | 400, 401, 403, 404, **409**, 422, 503 |
| `POST /v1/products/images` | 要 admin | 画像アップロード(A6 / A7) | multipart の image binary | `{ imagePath }` | 400, 401, 403, 413, 415, 422 |

### Purchase 系

| Method / Path | 認証 | 用途 | フロントが送る主な項目 | 主なレスポンス項目 | 主なエラー |
| --- | --- | --- | --- | --- | --- |
| `POST /v1/purchases` | 要 | 購入作成(U6) | details(productId, quantity), Idempotency-Key(ヘッダ), displayCurrency(任意 query) | 購入、referenceAmount | 400, 401, 409(在庫不足等), 422 |
| `GET /v1/purchases` | 要(`includeOtherUsers=true` は要 admin) | 購入履歴(U7、cursor)。期間は瞬時の半開区間 | after, first, orderedAfter, orderedBefore, statusCodes, includeOtherUsers | items[], nextCursor | 400, 401, 403 |
| `GET /v1/purchases/{purchaseCode}` | 要 | 購入詳細(U8) | — | 明細(商品名を結合済み) | 401, 404 |
| `PATCH /v1/purchases/{purchaseCode}/cancel` | 要 | キャンセル(U8) | — | 更新後ステータス | 400, 401, 404, 409(不正遷移) |
| `PATCH /v1/purchases/{purchaseCode}/pay` | 要 | 支払い(擬似決済、U8)。未処理 / 受付中 / 確認中 からのみ | — | 更新後ステータス | 400, 401, 404, 409(二重支払い・不正遷移) |
| `PATCH /v1/purchases/{purchaseCode}/ship` | 要 admin | 発送(A8) | — | 更新後ステータス | 400, 401, 403, 404, 409 |
| `PATCH /v1/purchases/{purchaseCode}/deliver` | 要 admin | 配達完了 | — | 更新後ステータス | 400, 401, 403, 404, 409 |
| `GET /v1/purchases/shippable` | 要 admin | まとめ発送の組(A8) | limit | `groups[]`（購入者ごとの組） | 400, 401, 403 |

### 集計・在庫

| Method / Path | 認証 | 用途 | 主なレスポンス項目 |
| --- | --- | --- | --- |
| `GET /v1/users/me/purchases/summary` | 要 | 自分の購入サマリ(U11) | 合計額・件数・ステータス別内訳 |
| `GET /v1/dashboard/summary` | 要 admin | admin 横断集計(A1 / A4) | period、range 時の from / to、期間売上・ステータス別件数・商品数(backend 合成済み) |

### 基盤・横断

| Method / Path | 認証 | 用途 | 備考 |
| --- | --- | --- | --- |
| `GET /v1/users/me` | 要 | 認証コンテキスト解決 | ログイン中ユーザーの基本情報 |
| `GET /v1/prefectures` | 不要 | 都道府県マスタ | 登録 / 更新フォームの select 用 |
| `GET /v1/addresses?postalCode=` | 不要 | 郵便番号 → 住所補完 | isFallback=true なら全項目を手入力する(degrade) |
| `GET /v1/exchange-rates` | 不要 | 為替レート(参考円換算用) | base, quote, amount(decimal 文字列) は必須。外部障害は 503 |
| `POST /v1/users` | 要 | 初回オンボーディング(U10) | Idempotency-Key とユーザー情報を送る。409 は既存ユーザーなどの競合 |
| `DELETE /v1/users/{userId}` | 要 admin(A5) または本人(U11) | 退会 | 進行中購入があると 409。取消・在庫復元は同一トランザクションで処理される |

### ログイン / ログアウト(mock OIDC)

Go API の OpenAPI には存在しない。BFF の Route Handler が次の mock OIDC 契約を使う。フロントは BFF の URL(例: `/api/auth/login` / `/api/auth/logout`)だけを使い、IdP endpoint や token を直接扱わない。

| Method / Path | BFF の用途 | ブラウザが直接呼ばない理由 |
| --- | --- | --- |
| `GET /.well-known/openid-configuration` | issuer / endpoint の Discovery | 設定の正は IdP の公開メタデータであり、feature に固定しない |
| `GET /.well-known/jwks.json` | ID Token の署名鍵取得 | JWT 検証は BFF の責務 |
| `GET /oidc/authorize` | Authorization Code + PKCE S256 開始 | state、nonce、code_challenge を BFF が生成・検証する |
| `POST /oidc/token` | callback 後の token 交換 | code_verifier と token をブラウザに露出しない |
| `GET /oidc/userinfo` | 必要な claim の取得 | access token を BFF 内に閉じる |
| `POST /oidc/logout` | RP-Initiated Logout | IdP logout は GET ではなく form POST |

`/bypass/token` と `/bypass/session` は mock の dev-gate 限定テスト補助であり、通常のログイン導線には使わない。

---

## 3. 未決事項(フロント実装に影響するもの)

| # | 内容 | 決着させる時期 |
| --- | --- | --- |
| 1 | **`style-src`(CSP)の運用方式** — TipTap が inline style を出力するため、nonce 運用かハッシュ運用かで A6 / A7 のエディタ組み込み方法が変わる | v1 実装計画 P6-2 |
| 2 | ~~**sanitizer ライブラリの選定**~~ — **決着済み**。`hast-util-from-html` + `hast-util-sanitize` + `hast-util-to-jsx-runtime` を採用し、port は `src/model/rich-text/` に置く(v1 実装計画 §3.10) | 決着済み |
| 3 | ~~**未公開商品を含む admin 商品一覧**~~ — **決着済み**。`GET /v1/products` に `includeUnpublished` が入り、admin だけが `true` を指定できる。A2 はこれを指定して未公開の商品も並べる | 決着済み |
| 4 | ~~**在庫僅少一覧**~~ — **契約は決着済み**。`GET /v1/products/low-stock` が OpenAPI に入った。A1 の数値カードとは独立した後続機能なので、画面はまだ持たない | 契約は決着済み / 画面は後続 |
| 5 | ~~**配達完了の対象を admin が指せない**~~ — **決着済み**。`GET /v1/purchases` に `statusCodes` と `includeOtherUsers` が入り、admin は発送済みの注文を列挙できる。A8 がその一覧と `deliver` を持つ | 決着済み |

> **PostHog / Cookie 同意**: 本資料は「採否未決」としていたが、**v1 実装計画で「軽量 consent 機構 + ゲートは採用 / GTM・PostHog 本体は不採用」に確定**した([0131](../adr/0131-cookie-consent.md) を exclusion から反転)。

---

## 4. 除外事項(フロントで作らなくてよいもの)

- 決済 SDK 本体・PSP 連携(pay 操作は Go 側の状態遷移のみで完結。擬似決済)
- リアルタイム機能(SSE / WebSocket)
- 推薦・パーソナライズ機能
- 商品説明以外のリッチテキスト編集画面
- 時系列チャート(数値カードと、ステータス別内訳の横棒までとする)
- i18n 切替、DnD、feature flag UI
