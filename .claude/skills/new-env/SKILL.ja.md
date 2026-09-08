> このファイルは `SKILL.md`（canonical / 英語）の日本語参考訳です。スキルとしては読み込まれません（参考用）。

# New Env

新規環境変数をプロジェクトに end-to-end で追加するスキル。各環境の env ファイルへ値を置き env 変数表へ載せる。加えて、アプリが config 経由で読む変数であれば、**目的（purpose）別の config モジュール 1 本**のスキーマに宣言し、その不変な型付きオブジェクト経由で公開し、config カーネル README で解説する。

2 つのドキュメントは持つものが違う（[0030](../../../docs/adr/0030-environment-variable-management.md) §6）。**`env/README` が「どの変数が存在するか」の正**であり、値がプレースホルダのみの変数も config を経由しない変数もここに載る。**config カーネル README は「設定値そのもの」の正**であり、ビルド時に検証され構築時に purpose モジュールへ流し込まれる値を扱う。config が扱うのは env に存在するものの部分集合であり、同じ内容を両方へ書かない。

本スキルが実装する設計は [0030](../../../docs/adr/0030-environment-variable-management.md)（環境変数管理 / config カーネル）、命名形式は [0028](../../../docs/adr/0028-naming-convention.md) に従う。ADR が正であり、本スキルはその機械的作業を自動化するだけである。

## 前提: config カーネルが存在すること

本スキルは `src/config/` が既にあることを前提とする。最初に確認する:

```sh
ls src/config/ 2>/dev/null
```

`src/config/` が無い場合は**即座に停止**し、config カーネル未着手のため変数を追加する先が無い旨をユーザへ伝える。変数追加の依頼を根拠に、カーネル・スキーマ・検証呼び出し・`env/` を**新規作成してはならない**。カーネル構築はそれ自体が独立した変更であり、[0030](../../../docs/adr/0030-environment-variable-management.md) がそこへ委ねたスキーマライブラリ選定を要するため。

## 使うとき

以下のとき:

- 新しい env 変数が必要になった（外部サービス URL / タイムアウト調整値 / 公開サイト URL 等）
- 複数ファイルの同期が要り、一貫した更新をしたい

以下には使わない:

- 既存 env 変数の**リネーム**（別ワークフロー。全箇所を一括で改名する）
- 既存 env 変数の**削除**（逆方向。手作業のほうが安全）
- **purpose の新設**（`src/config/<purpose>/` の新規ディレクトリ）。本スキルは purpose モジュールが既に在ることを前提とする。新設時は最初の 1 変数を手で書く（新モジュールは import 境界上の位置づけ決定も要る — [0030](../../../docs/adr/0030-environment-variable-management.md) §3）。以降の追加から本スキルを使う
- **再デプロイなしで変えたい値**を env へ置くこと。それは BFF runtime config の担当（[0071](../../../docs/adr/0071-bff-api-integration.md)）であり、ここではない

## 読み書きする対象

**読む（常に）** — 以下はすべて実行時に検出する。インベントリを固定値で持たない:

- `src/config/*/*.schema.ts` と対応する server / client モジュール — purpose インベントリ、スキーマ validator、Config getter の作法
- `src/config/environment.ts` — 明示的な環境スキーマと purpose validator の import
- `env/README.md` — 変数表とサブシステム別セクション。**どの変数が存在するか**の正
- `src/config/README.md` — config カーネル README。**設定値そのもの**（ビルド時に検証され、purpose モジュールへ渡される値）の正
- `env/.env.local` / `.env.ci` / `.env.dev` / `.env.stg` / `.env.prd` — 環境別の値の置き場とセクションコメントの体裁
- `package.json` — 存在する検証スクリプト（`lint:ci` / `typecheck` / `build`、テストスクリプトが追加済みならそれも）

**書く（確認後のみ）**:

- env ファイル群と `env/README.md` — **常に**（変数はすべて env に存在する）
- purpose schema、対応する Config モジュール、`src/config/environment.ts`、`src/config/README.md` — アプリが config モジュール経由で読む変数のときのみ

**触らない**:

- `next.config.ts` / `instrumentation.ts` — ビルド時・サーバ起動時の検証点（[0030](../../../docs/adr/0030-environment-variable-management.md) §1）はスキーマモジュールを丸ごと import するため、既存 purpose のスキーマへフィールドを足せば自動的に検証対象になる。ここへの変更が要るように見える場合は、その purpose モジュールが未接続ということなので、編集せず報告して止まる
- `biome.json` — `noProcessEnv` の override は config カーネルの持ち物で、変数追加の範囲ではない
- `env/` と `src/config/` の外のすべて

## Step 0. 仕様の収集

**スキル起動直後に必ず `AskUserQuestion` を呼ぶ**。env 変数の追加はユーザ確認を要する（[0030](../../../docs/adr/0030-environment-variable-management.md) §6）。まとめて聞く。

### 質問 1: 変数名と purpose

- 質問:「環境変数名を入力してください（`{SUBSYSTEM}_{NAME}` の UPPER_SNAKE_CASE。ブラウザへ出す変数は `NEXT_PUBLIC_{SUBSYSTEM}_{NAME}`）。例: `APP_API_BASE_URL` / `NEXT_PUBLIC_ANALYTICS_SITE_ID`」
- 自由入力。その後:
  1. 先頭に `NEXT_PUBLIC_` があれば剥がし（これは client 側を示すプレフィックスであってサブシステム名ではない）、最初の `_` で分割してサブシステムを得る
  2. `src/config/` から検出した purpose 群と突合する
  3. 一致すれば推定モジュールを提示して確認する（例:「推定 purpose: `api`（`src/config/api/api.server.ts`）」）
  4. 一致しなければ候補を提示し、選び直すか、purpose モジュールを手で追加するために停止するかを尋ねる
  5. **標準名の例外**（[0028](../../../docs/adr/0028-naming-convention.md)）: 外部仕様が名前まで規定し、サードパーティ SDK が読む変数（`OTEL_EXPORTER_OTLP_ENDPOINT` / `PORT` 等）は標準名のままとし `{SUBSYSTEM}_{NAME}` を課さない。適用対象は**外部ツールが読む変数だけ**で、アプリが自分で読む変数には適用しない

### 質問 2: config モジュール経由で読む変数か

- 質問:「この変数はアプリが config モジュール経由で読みますか？」
- 選択肢:
  - 「はい（config 経由で読む）」 — 通常経路。purpose モジュールへスキーマ項目 + getter を足し、`src/config/README` にも項目を書く
  - 「いいえ（外部ツール / SDK が `process.env` から直接読む）」 — 例: `OTEL_EXPORTER_OTLP_ENDPOINT` のような標準名の変数、またはアプリではなくプラットフォームが消費する値

この回答が変更の到達範囲を決める。`env/` と `env/README` はどちらでも更新し、`src/config/` とその README を触るのは「はい」のときだけ（2 つの文書の所有の分担は本スキル冒頭の段落が述べる）。

「いいえ」の場合は質問 3（どちらのモジュールか）と質問 4（型 / required・code default）を飛ばす。どちらもスキーマの話であり、書くスキーマ項目が無いため。`NEXT_PUBLIC_` の露出則と Secret ラベルは引き続き適用する。Step 2 の計画では「config モジュールには触れない」と明示し、getter が無い理由を読み手に疑わせない。

### 質問 3: server / client の別

- 質問:「この変数はどちら側ですか？」
- 選択肢:
  - 「server（secret を含み得る / runtime object）」 — `<purpose>.server.ts` へ
  - 「client（`NEXT_PUBLIC_` / ブラウザに露出する公開定数）」 — `<purpose>.client.ts` へ

[0030](../../../docs/adr/0030-environment-variable-management.md) の 2 つの不変条件を強制する:

- `NEXT_PUBLIC_` 付きの名前は client モジュール、無い名前は server モジュールへ行く。回答が名前と矛盾する場合は不整合を提示して聞き直す
- **secret を `NEXT_PUBLIC_` に置かない。** 質問 5 で secret ラベルが付いたのに client 側であれば停止して説明する — `NEXT_PUBLIC_` の値はブラウザバンドルへリテラル展開されるため secret が漏れる。そのまま進めず、分割（公開 ID は client / secret キーは server）を提案する

### 質問 4: 型と required / code default

- 質問:「型と、required / code default を選んでください」
- 選択肢:
  - 「string, required」
  - 「string, code default あり（値を後で指定）」
  - 「number / boolean / enum, required（型は後で指定）」
  - 「number / boolean / enum, code default あり（型と値を後で指定）」

該当する場合は具体の型とデフォルト値を追加で自由入力させる。判定則は [0030](../../../docs/adr/0030-environment-variable-management.md) §4: プロジェクト固有・環境ごとに変わる値は **required**（欠落でビルド / 起動が失敗する）、フレームワーク的な普遍値はスキーマ側の **code default**。

### 質問 5: Secret ラベル

- 質問:「Secret 管理ラベルを選んでください」
- 選択肢:
  - 「なし（公開値 / 非機微）」
  - 「Secret management required（本番は secret store から供給。平文コミット禁止）」
  - 「Secret management recommended（定期ローテーション推奨）」

いずれかの secret ラベルが付く場合、コミットされる env ファイルへ書くのは**プレースホルダ**であり実値ではない。本番値は PaaS の env / secret store から供給する（[0030](../../../docs/adr/0030-environment-variable-management.md) §5 / §6）。実値を尋ねるのではなく、この旨をユーザへ伝える。

### 質問 6: 説明

自由入力。ユーザは英語か日本語の**どちらか**（または両方）を与える。不足側はスキルが補い、変数表の両言語が二度書きなしで同期する。

- 「説明（日本語または英語のどちらか）」
- Notes 欄（任意） — Secret 管理 / 環境依存等の注記。説明と同じ言語で受ける

解決規則:

- 日本語のみ → 日本語行を書き、英語側へ訳す
- 英語のみ → その逆
- 両方 → そのまま使い、翻訳しない
- 訳は短く直截に、周囲の行のレジスタに合わせる。自明でない訳は書き込み前に Step 2 の計画へ出してレビューを受ける

### 質問 7: 環境別の値

- 質問:「環境別の値を指定しますか？」
- 選択肢:
  - 「全環境同じ値（または code default で OK）」
  - 「local だけ別の値を入れる」
  - 「prd だけ別の値を入れる」
  - 「環境ごとに個別指定する（追加質問）」

選択に応じて値を集める。`prd` は、ユーザが明示値を与えない限り既存ファイルのプレースホルダ慣行（通常はコメントアウト行）に従う。secret ラベル付きの変数は常にプレースホルダとする。

## Step 1. 挿入位置の決定

形を仮定せず、既存の記述を読んで挿入位置を確定する。

### purpose config モジュール

purpose ディレクトリは schema モジュールと、対応する runtime モジュール 1 本（`src/config/<purpose>/<purpose>.server.ts` **または** `<purpose>.client.ts`）を持つ。

1. **スキーマ validator** — `<purpose>.schema.ts` の named validator を追加・拡張する。既存のスキーマライブラリを使い、required / code default は質問 4 に従う
2. **環境スキーマ項目** — `src/config/environment.ts` の明示的な `z.object({...})` へ validator を import して呼び出す
3. **Config 値と getter** — 対応する runtime モジュールに型付き値と getter を加え、private constructor と既存作法を保つ。setter や外部公開 constructor / factory は足さない

client モジュール固有（[0030](../../../docs/adr/0030-environment-variable-management.md) §2）: 値は**静的なドット参照**で読む — `process.env.NEXT_PUBLIC_ANALYTICS_SITE_ID` と literal に書き下す。動的インデックスアクセスと分割代入はビルド時のリテラル置換が効かないため禁止。

server モジュール固有: `import "server-only"` はファイル先頭に既にあるはず。無ければ、無防備なモジュールへ黙って変数を足すのではなく欠陥として報告する。

### env ファイル

実在する `env/.env.local` / `.env.ci` / `.env.dev` / `.env.stg` / `.env.prd` の各々について:

- purpose のセクションコメントを探し、その下へ既存の整列とコメント作法を保って 1 行足す
- secret ラベル付きはプレースホルダ（またはコメントアウト行）とし、実値は書かない

### `env/README.md` — 変数の存在（常に）

該当サブシステムのセクションの変数表へ、列数と順序を保って行を足す:

```text
|APP_API_BASE_URL|<説明>|<型>|<例>|<注記>|
```

secret ラベルを選んだ場合は Notes 列に含める。この行は**すべての**変数について書く — config モジュールが読まない変数も、値が常にプレースホルダの変数も含む。

### `src/config/README.md` — 設定値（config 経由の変数のみ）

質問 2 が「はい」のときだけ。周囲の記述に倣って値を解説する: どの purpose に属するか、server / client のどちら側か、required か code default か、受け手がどう受け取るか。env 行の内容をここへ**再掲しない**（所有の分担は本スキル冒頭の段落が述べる）。config README が個別の値ではなく purpose 単位の解説になっている場合は、何も足さずその旨を計画で述べる（ファイルの構造に無い変数別セクションを勝手に作らない）。

### `src/config/environment.fixture.ts` — 全量のスタブ（config 経由の変数のみ）

**config 経由の変数はここにも足す。**fixture は検証を通る変数一式を書く唯一の場所で、
`satisfies Record<keyof Environment, string>` で型付けされている — つまり `environment.ts` へ
足して fixture へ足し忘れると、**書いた場所ではなく、著者が開いてもいないファイルの型検査**が
落ちる。fixture が export する 2 つのオブジェクト（生のスタブ一式と、検証後の結果）の両方へ、
隣と同じ形の値で鍵を足す。

置き場は決め打ちせず見つける: purpose のテストが `stubValidEnvironment` を import している先が
それである。将来の整理で移動・分割されたら、import を辿る。

### テスト

config のテスト方針は **env スタブ + factory 再生成**（`vi.stubEnv`） — [0030](../../../docs/adr/0030-environment-variable-management.md) 周辺ルール / [0090](../../../docs/adr/0090-testing-strategy.md)。purpose ディレクトリに config テストが在れば、本体変更と歩調を合わせて拡張する: 新 getter を検証するケースと、required 変数なら欠落時に検証が失敗することを確認するケース。config テストがまだ無い場合はスキップし、その旨を Step 2 の計画で明示する。

## Step 2. 計画の提示と確認

変更内容一式を日本語サマリで提示する — 変数名、config 経由か env のみか、purpose と対象モジュール、server / client、型、required / code default、secret ラベル、両言語の説明、環境別の値、各ファイルで何が変わるかの一覧、レビュー対象の自動翻訳。env のみの経路では、config モジュールにも config README にも触れないことを明示する。

`AskUserQuestion` で確認する:

- 質問:「以上の内容で適用しますか？」
- 選択肢:「適用する」 /「修正したい箇所を指摘する」 /「キャンセル」

## Step 3. 適用

読み取り済みコンテキストから導いた厳密なアンカー（対象セクションの最後のスキーマ項目 / フィールド / getter / 表の行）で `Edit` を使う。順序:

1. `src/config/<purpose>/<purpose>.schema.ts`、対応 runtime モジュール、`src/config/environment.ts`（validator → 環境スキーマ項目 → getter）— config 経由の経路のみ
2. `src/config/environment.fixture.ts` — config 経由の経路のみ
3. config テスト（存在する場合）
4. env ファイル（1 ファイル 1 編集）
5. `env/README.md`
6. `src/config/README.md` — config 経由の経路のみ

いずれかの編集が失敗したら停止して報告する。残りのファイルへ進まない。

## Step 4. 検証

`package.json` に在るスクリプトを実行する:

```sh
pnpm fix        # 整形の吸収
pnpm lint:ci    # noProcessEnv を含む。src/config/ 外の process.env 直読を検出
pnpm typecheck  # 新 getter とその型
pnpm build      # スキーマ全量のビルド時検証（required の欠落はここで落ちる）
```

テストスクリプトが在ればそれも実行する。本スキルにとって意味のあるゲートは `pnpm build` である — [0030](../../../docs/adr/0030-environment-variable-management.md) §1 の全量検証が実際に走るのがそこだから。

失敗したら内容を提示して停止する。編集のロールバックはしない（fix forward するかはユーザが決める）。

## Step 5. 締め

- 1 行サマリを出す: `<VAR_NAME> を <purpose> に追加。<N> ファイル更新。build OK。`
- secret ラベル付き、または `prd` をプレースホルダのままにした場合は、実値を PaaS の env / secret store に設定する必要がある旨（本スキルはそこを触らない）を伝える
- 本スキルはコミットしない。レビュー後に `/commit` を使う

## AI 変更スコープ

`CLAUDE.md` / `AGENTS.md` の「Exception: Skill Execution」に従い、本スキル実行中は以下へスコープを限定して AI 変更スコープが緩和される:

- env ファイル群と `env/README.md`。config 経由の経路ではさらに、purpose schema、対応する runtime モジュール、`src/config/environment.ts`、`src/config/environment.fixture.ts`、同居するテストファイル、`src/config/README.md` — またはユーザが承認した部分集合

保護されたまま:

- `next.config.ts` / `instrumentation.ts` / `biome.json`、および `src/config/` + `env/` 外のすべて
- Accepted な ADR 本文、`AGENTS.md`、`LICENSE`

## 制約

- ❌ `src/config/` が無い状態で実行すること（報告して止まる。カーネル構築は別の変更）
- ❌ purpose 一覧 / スキーマライブラリ / env ファイル集合を固定値で持つこと（常に実ツリーから検出する）
- ❌ secret を `NEXT_PUBLIC_` に置くこと
- ❌ コミットされる env ファイルへ実 secret 値を書くこと
- ❌ config オブジェクトに setter を足すこと / purpose を束ねる facade を作ること
- ❌ client モジュールで `NEXT_PUBLIC_` を動的アクセス・分割代入すること
- ❌ 1 変数を複数の purpose モジュールへまたがらせること
- ❌ config モジュールが無いことを理由に `env/README` の行を省くこと（存在の正は env。config を経由しない変数も載せる）
- ❌ env 変数表の内容を config README へ二重に書くこと（逆も同様。2 つの文書は持つものが違う）
- ❌ 仕様確認の `AskUserQuestion` を省くこと / 計画提示なしに適用すること
- ✅ ユーザ向け出力は日本語
- ✅ env ファイル（整列・コメント作法）と README 表（列数・順序）の体裁を保つ
- ✅ 書き込み後に `pnpm fix` + `pnpm lint:ci` + `pnpm typecheck` + `pnpm build` を実行する
- ✅ 検証の失敗は提示する。自動ロールバックはしない

## チェックリスト

完了報告の前に確認する:

- [ ] `src/config/` が存在し、purpose インベントリをそこから読んだ（仮定していない）
- [ ] 変数名を確認し、`{SUBSYSTEM}_{NAME}`（または根拠のある標準名例外）に照合した
- [ ] config 経由か env のみかを確認し、変更の到達範囲がそれと一致している
- [ ] server / client を確認し、`NEXT_PUBLIC_` の有無と整合している
- [ ] secret ラベルを確認した。secret を `NEXT_PUBLIC_` に置いておらず、実 secret 値をコミット対象へ書いていない
- [ ] 型と required / code default を確認した
- [ ] 説明を片方の言語で受け取り、他方を訳して計画に提示しレビューを受けた
- [ ] 環境別の値を確定した
- [ ] 計画全体を提示し、ユーザが承認した
- [ ] config 経由の経路: purpose モジュールを 1 本だけ更新した（スキーマ項目 + private フィールド + getter。setter なし）
- [ ] client モジュールの値は静的ドット参照のみ
- [ ] 実在する env ファイルすべてを該当セクション配下で更新した
- [ ] `env/README.md` の変数表に行を足した（常に）
- [ ] config 経由の経路では `src/config/README.md` を更新した（env 行の再掲なし）
- [ ] config 経由の経路: `src/config/environment.fixture.ts` にも鍵を足した
- [ ] config テストを更新した、または不在を明示した
- [ ] `pnpm fix` / `lint:ci` / `typecheck` / `build` を実行し結果を報告した
- [ ] コミット / push を行っていない
- [ ] 最終サマリが日本語である
