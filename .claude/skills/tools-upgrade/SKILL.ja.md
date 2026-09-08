> **このファイルは `SKILL.md` の日本語訳です。**
> 直接編集しないでください。内容の変更が必要な場合は canonical な `SKILL.md`（英語版）を更新し、その後この日本語訳を同期してください。
> Claude Code のスキルとしては `SKILL.md` のみが読み込まれます。このファイルはスキル本体ではなく、レビューや学習用の翻訳ドキュメントです。

# ツールバージョン更新

このスキルは `mise.toml` の `[tools]` table に並ぶ全ツールについて、upstream 最新版との差分を監査し、**サプライチェーン隔離ゲート（supply-chain quarantine gate）** 付きで適用候補を提示する。`min_age_days` 未満の新しいリリースは「通知のみ」として扱い、自動適用しない（窓の解決とその理由は Step 0 が持つ）。

理由: npm / PyPI / Go module proxy への悪意あるリリースの大半は、公開後 24〜72 時間以内に検知・取り下げが行われる。backend ごとに定めた窓のあいだ待つことで、コミュニティが検知する前に取り込んでしまうリスクを抑える。

## 使用タイミング

以下のような場合に使用する。

- 定期（月次・四半期）のツールバージョン棚卸し
- リリース直前の、既知 CVE 修正版が出ていないかの確認
- セキュリティアドバイザリ後の、対象ツールに更新があるかの確認

以下の用途では使用しない。

- Node.js 自体のアップグレード → `/node-upgrade` を使う（その Node ラインのリリースノート / 破壊的変更をレビューする）
- npm 依存のアップデート（`package.json`）→ `pnpm add` / `pnpm update` を直接使う（[0004](../../../docs/adr/0004-library-management.md)）
- 単発のアドホックなバージョン bump → `mise.toml` を直接編集して `make install-tools`。
  **検疫はこの経路にも掛かる** —— `make tools-cooldown-check` が、窓を満たさない pin をどの経路で入れたかに依らず落とす
- **mise 自身**のアップグレード → `mise.toml` が宣言するのは mise が解決する対象であって mise 自身は
  宣言できないため、版は `.github/actions/setup-mise/action.yaml` にあり本スキルの射程外。揃えるべき
  3 箇所を含む手順は `repo-ops` runbook の項目 8

## Step 0. backend 別の検疫の窓を解決する

**窓は単一の数値ではなく、この文書が決めるものでもない。** ADR
[0110](../../../docs/adr/0110-security-operations.md) 1.1 が backend ごとに定めている。窓が追うのは
その配布経路で悪性のリリースが検知・撤回されるまでの速さであって、そのツールが何を壊しうるかではない。
全 backend に同じ値を当てると、窓の長いほうの経路が黙って検疫不足になる。待つこと自体が防御の大半を買う
—— 典型的な悪性リリース（npm `ua-parser-js` 2021、PyPI `ctx` 2022）は公開後 24〜72 時間以内に検知・yank されている。

手順:

1. **ADR 0110 1.1 をその実行で読み**、現在の記述から backend → 窓の対応表を作る。数値をこの文書へ
   写さない —— ここに書いた値は second source of truth になり、ADR が動いた時点で古くなる。
2. スキル引数に値があれば（例 `/tools-upgrade 14`）**全 backend への上書き提案**として扱い、その旨を
   質問文に書く。
3. 必ず `AskUserQuestion` を呼び、手順 1 の表を既定として提示する。
    - 質問: 「リリースを自動適用の対象にするまでの最小経過日数を確認してください（既定は ADR 0110 1.1 の backend 別の窓）」
    - 選択肢: 「ADR どおり（backend 別）」 / 「全 backend に同じ日数を当てる（値を指定）」 / 「キャンセル」
4. 解決した各値が 0 以上の整数であることを検証し、以降の手順で `<MIN_AGE_DAYS(backend)>` として使う。
5. **`mise.toml` が実際に使っている backend の窓を ADR が定めていない場合、値を発明しない。** その実行では
   ADR が示す最長の窓を当て、欠落を所見として報告する —— 窓の宣言が無い backend は ADR 側の欠落であって、
   ここで数値を選んでよい理由にはならない。

窓の対応表が確定するまでは upstream API へのアクセスや `mise.toml` の読み込みは行わない。

## AI Modification Scope について

`CLAUDE.md` の "Exception: Skill Execution" 節に基づき、スキル実行中に以下のパスへの変更が許可される。

- `mise.toml`（`[tools]` table のみ、ユーザーが承認したエントリだけを書き換え）

本スキルが書き換える追跡ファイルは `mise.toml` だけ（Step 6: そこから伝播するものは無い）。

以下は引き続き保護対象（スキル実行中でも変更不可）。

- `AGENTS.md` / `CLAUDE.md`
- 生成物（`src/adapters/gen/**` と取り込んだ `openapi.gen.yaml` — [0072](../../../docs/adr/0072-api-type-generation.md)） <!-- skill-lint-ignore -->
- バージョン bump と無関係な全てのファイル

## Step 1. `mise.toml` のパース

`mise.toml` を読み、`[tools]` 配下の全 key を列挙する。各 key について backend を判定する。

| Key format | Backend | 最新バージョンの取得元 |
| --- | --- | --- |
| `aqua:owner/repo` | aqua (GitHub Releases) | `gh api repos/owner/repo/releases/latest` |
| `npm:package` | npm | `https://registry.npmjs.org/{package}` |
| `pipx:package` | pipx (PyPI) | `https://pypi.org/pypi/{package}/json` |
| `core:node`（ランタイム） | mise core | `https://nodejs.org/dist/index.json` |
| `core:python`（ランタイム） | mise core | `https://www.python.org/api/v2/downloads/release/` |

backend prefix の無い key は存在してはならない。[0003](../../../docs/adr/0003-version-manager.md) は backend の
明示を要求している — 複数 backend を持つツールは、レジストリの既定が変わると取得元が黙って変わるため。
そうした key は resolve せず、指摘として報告する。

各ツールについて以下を取得する。

- **stable な最新バージョン**（`-rc` / `-beta` / `-alpha` / `-pre` / `-dev` 等の pre-release タグは除外）
- **公開日時**（ISO 8601）

GitHub Releases 系は `gh api` を優先する（`GITHUB_TOKEN` 経由で認証され rate limit が緩和される）。それ以外のエンドポイントは `curl -fsSL` で取得する。

## Step 2. 分類

各ツールを以下のクラスに分類する。

| クラス | 条件 |
| --- | --- |
| **up-to-date** | `pinned == latest`（先頭 `v` の有無を正規化したうえで一致） |
| **eligible** | `pinned != latest` かつ `now - release_date >= MIN_AGE_DAYS(backend)` |
| **pending** | `pinned != latest` かつ `now - release_date < MIN_AGE_DAYS(backend)` |
| **resolution_failed** | backend lookup が失敗（ネットワークエラー / 404 / parse 失敗） |

ここで使う窓は Step 0 が**そのツールの backend について**解決したものである（backend は Step 1 で判明している）。全ツールを 1 つの数値と突き合わせない。

セーフガード: semver で「downgrade」になる場合は `resolution_failed` 扱い（reason: "potential downgrade"）。

## Step 3. サマリ表示

分類結果を日本語で見出し別にまとめて表示する。例:

```text
ツールバージョン監査結果（窓: backend 別 / ADR 0110 1.1）

✅ 更新候補（backend の窓を満たした / supply-chain quarantine 通過）:
  - golangci-lint: 2.12.2 → 2.13.0 （公開 2026-05-18, 17 日前）
  - sqlc: 1.31.1 → 1.32.0 （公開 2026-04-29, 36 日前）

⚠️ supply-chain quarantine（backend の窓の内側、通知のみ）:
  - air: 1.65.3 → 1.66.0 （公開 2026-06-02, 2 日前）

✓ 既に最新:
  - oapi-codegen 2.7.0
  - lefthook 2.1.8
  ... (省略可)

❌ 取得失敗:
  - pipx:sqlfluff: PyPI への接続失敗
```

## Step 4. 適用候補の per-tool 確認

**eligible** が空ならステップ 6 へスキップし、書き換えは行わない。

そうでなければ `AskUserQuestion` を `multiSelect: true` で呼ぶ。各 option は 1 つの eligible ツールに対応し、description にバージョン差分と公開日を載せる。既定状態: 全選択。

ユーザーは個別 deselect 可能（特定 bump が既知の壊れもの等）。

## Step 5. `mise.toml` の更新

承認された各ツールについて:

- `mise.toml` 内の該当行を特定する
- バージョンリテラルだけを置換する。key（`aqua:owner/repo` / `go:path/to/module` / 短い名前）と、もとが `v` prefix を使っていた場合はその慣習を保持する
- key の並び順を変えない、無関係な key を触らない、`[settings]` table も触らない

全承認分の置換を memory 上で計算したあと、`mise.toml` を **1 回だけ書き出す**（atomic single-pass）。

## Step 6. 承認したバージョンをインストール

`make install-tools` を実行し、固定し直したバージョンを実際に `PATH` 上のものにする。これを回すまでは
`mise.toml` と導入済みツールチェインが食い違い、以降の検証は古いバージョンを検証してしまう。

下流への伝播ステップは無い。`mise.toml` が単一の正であり、バージョンを二重に持つ配信層のファイル
—— Dockerfile もランタイムマニフェストも —— 存在しない（[0003](../../../docs/adr/0003-version-manager.md) /
[0011](../../../docs/adr/0011-no-docker.md)）。

## Step 7. 検証

```sh
pnpm install
pnpm lint:ci
pnpm build
```

結果テーブル（OK / FAIL）をユーザーに報告する。失敗しても自動ロールバックはしない — どう扱うか（修正コミット追加 / revert / そのまま）はユーザーが判断する。

## Step 8. 最終レポート

以下をまとめて報告する。

- 更新したツール数
- quarantine（pending）で見送ったツール数
- 検証結果
- 失敗があれば内容

コミット / stage / push は行わない。ユーザーが working tree をレビューしたうえで `/commit` 等を手動実行する。

## 注意事項

- **supply-chain quarantine の根拠**: Step 0 —— backend ごとの窓は ADR [0110](../../../docs/adr/0110-security-operations.md) 1.1 の決定であって、このスキルのものではなく、動きうる。
- **pre-release の除外**: 常に最新の **stable** リリースを選ぶ。upstream が pre-release タグを出していても latest として選択しない。
- **calendar versioning**: `2024.12.30` のような calendar versioning を使うツールは lexicographic + semver fallback で比較する。downgrade ガードは常時有効。
- **rate limit**: GitHub API は anonymous で 60 req/h（IP 単位）。本スキルは `gh api` を経由して `GITHUB_TOKEN` 認証で 1000 req/h に上げる。
- **idempotency**: 複数回起動しても安全。適用後に再実行すると、適用済みツールは up-to-date として表示される。
- コミット / stage / push は行わない（Step 8）。

## チェックリスト

完了報告時に以下を確認すること。

- [ ] backend 別の窓を ADR 0110 1.1 から読み、`AskUserQuestion` で確認済み
- [ ] `[tools]` 全エントリの backend を resolve（不能なら理由付きで resolution_failed に分類）
- [ ] 各ツールを up-to-date / eligible / pending / resolution_failed のいずれかに分類
- [ ] 分類結果テーブルをユーザーに提示
- [ ] eligible が非空なら、per-tool 適用候補を `AskUserQuestion` で確定
- [ ] `mise.toml` を承認分のみ atomic に書き換え、key 形式と `v` prefix 慣習を保持
- [ ] `mise.toml` を書き換えたら `make install-tools` を実行
- [ ] `pnpm install` + `pnpm lint:ci` + `pnpm build` を実行
- [ ] 最終結果テーブルをユーザーに報告
- [ ] `SKILL.md` 更新時は `SKILL.ja.md` も同期
- [ ] コミット / stage / push は一切実行しない
