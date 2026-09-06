# Git ブランチ・コミット運用方針

本プロジェクトの Git ブランチ戦略、コミット規約、Pull Request 運用、リリース運用を定義する。

リポジトリ設定 (`.github/settings/branch-protection.json`) によりブランチ保護を機械的に強制しているが、本 ADR はその根拠と、人間が日常的に従うべき運用ルール全体を「意思決定」として明文化したものである。

## Status

Accepted

## 採用理由 / 目的

- **環境とブランチを 1:1 で対応** させ、「どのブランチが何に出ているか」を一意にする (production / staging / develop)
- **保護ブランチをリポジトリ設定で機械的に保護** することで、直 push / force push / レビュー忘れの事故を構造的に排除する
- **コミット粒度と PR テンプレートを揃える** ことで、後追いレビューおよびリリースノート生成 (`.github/release/`) のコストを下げる
- boilerplate として fork 先が「最初から踏むべきレール」を辿れるよう、暗黙運用を成文化する

## ブランチ構造

### 環境マッピング

| ブランチ | デプロイ環境 | 役割 |
| --- | --- | --- |
| `production` | 本番環境 | 本番にリリース済みのコード |
| `staging` | 検証環境 | 本番投入前の最終検証 |
| `develop` | 開発環境 | 次回リリースに含める変更の統合先 (PR の base 既定) |
| `release/vX.Y.Z` | (デプロイなし) | リリース単位の作業集約ブランチ |
| `feature/*` | (デプロイなし) | 機能追加の作業ブランチ |
| `bugfix/*` | (デプロイなし) | 通常のバグ修正の作業ブランチ |
| `hotfix/*` | (緊急時のみ) | 本番障害の緊急修正 |

### 派生と昇格のフロー

```text
production  ←(merge)  staging  ←(merge)  develop  ←(merge)  release/vX.Y.Z  ←(merge)  feature/*
                                                                                      bugfix/*
     ↑
     └────────── hotfix/* (本番から派生・本番へ戻す。develop へも反映)
```

| ブランチ | 派生元 | merge 先 |
| --- | --- | --- |
| `release/vX.Y.Z` | `production` | `develop` |
| `feature/*` | **最新の `release/vX.Y.Z`** | 派生元の `release/*` |
| `bugfix/*` | **最新の `release/vX.Y.Z`** | 派生元の `release/*` |
| `hotfix/*` | `production` | `production` (＋ `develop` にも反映) |

### 重要な派生ルール

- `release/*` は **`production` から派生** させる。出荷済みの断面から始めないと、まだ出していない変更をリリース版へ引き連れる。`develop` は統合先であり、作業起点として使わない
- `feature/*` / `bugfix/*` は **`develop` からではなく、現行の `release/vX.Y.Z` から派生** させる
- 1 リリースにつき 1 本の `release/*` ブランチを使う。リリース番号が確定した時点でブランチ名にバージョンを含める (`release/v0.1.0`)
- `hotfix/*` は本番障害の緊急修正専用。`production` へ戻した後、`develop` にも反映して履歴を一致させる

## 保護ブランチ

`.github/settings/branch-protection.json` で対象 (`production` / `staging` / `develop` / `release/**` / `hotfix/**`) に対し、以下を機械的に強制している。

| ルール | 内容 |
| --- | --- |
| Pull Request 必須 | 直接 push 禁止。すべての変更は PR 経由 |
| 必要承認数 | 最低 1 件の approve |
| 古い approve の無効化 | 新しい push が入ると過去の approve は自動的に dismiss される |
| 最終 push の承認必須 | 最後の push に approve が乗っていないと merge できない |
| review thread の resolve 必須 | 未解決の review コメントがあると merge できない |
| force push / 非 fast-forward 禁止 | 履歴書き換えを全面禁止 |
| ブランチ削除禁止 | 保護対象ブランチは削除不可 |
| code quality | `errors` 重大度のチェック失敗で merge ブロック |
| 許可される merge 戦略 | `merge` (merge commit) / `squash` |

これらは「リポジトリが拒否するから守る」のではなく **「運用としてもこの方針が正しいから設定で固めている」** という建付け。設定を緩める変更は本 ADR の改訂と同期させる。

## ブランチ命名規則

```text
feature/<issue-no>-<kebab-description>   例: feature/1234-add-login-form
bugfix/<issue-no>-<kebab-description>    例: bugfix/5678-fix-route-handler
hotfix/<issue-no>-<kebab-description>    例: hotfix/9012-cache-invalidation
release/v<major>.<minor>.<patch>          例: release/v0.1.0
```

- issue 番号が無い場合は省略可。代わりにハイフン区切りの説明的な名称にする (例: `feature/restructure-config`)
- 説明部分は **英小文字 + ハイフン区切り**。コロン・大文字・空白・日本語は含めない
- `release/*` は SemVer (パッチまで) を必ず含める

## コミット規約

### プレフィックス

すべてのコミット件名は以下のいずれかのプレフィックスで始める。形式は **`<Prefix>: <日本語の件名>`** で統一する。

| Prefix | 用途 |
| --- | --- |
| `Feat` | 新機能の追加 |
| `Fix` | バグ修正 |
| `Refactor` | 振る舞いを変えない内部改善 |
| `Perf` | パフォーマンス改善 |
| `Docs` | ドキュメントのみの変更 |
| `Test` | テスト追加・修正のみ |
| `Build` | ビルド構成・依存関係の変更 (`package.json` / `mise.toml` 等) |
| `CI` | CI / GitHub Actions の変更 |
| `Chore` | その他雑務 (ファイル移動・コメント整理など) |
| `Style` | フォーマッタ自動修正など、ロジックに影響しない整形 |
| `Revert` | コミットの取り消し |

### メッセージ規則

- 件名は **日本語** で書く。本文も日本語を基本とする (技術用語の英表記は許容)
- 件名は 1 行で完結させ、句点 (`。`) は打たない
- 件名だけで why が伝わらないコミットは本文に背景を残す
- 件名は概ね 72 文字以内を目安にする

#### 機械強制の範囲

commit-msg hook ([0151](0151-git-hooks.md)) が機械強制するのは次の 3 点に限る。

- プレフィックスが上表の 11 種のいずれかであること
- 件名が空でないこと
- 件名が句点 (`。`) で終わらないこと

**残りは散文の指針にとどめ、機械強制しない**。日本語であること・72 文字の目安・why を本文に残すことは、いずれも判定が主観に依存するか、機械的に判定すると誤検知が出る。誤検知する hook は `--no-verify` の常用を招き、機械強制していた 3 点まで一緒に無効化される。**強制範囲を広げることは、強制の実効性を下げうる**。

同じ理由で、件名の内容そのもの (空白のみ・意味を持たない文字列など) は規約化しない。`Feat:` の後ろが空白のみの件名は現行の検査を通過するが、これを塞ぐには件名の形を正規表現で定義することになり、上の指針と衝突する。この範囲を変えるときは本 ADR を先に改訂し、`commitlint.config.ts` はそれに従わせる (逆順にしない)。

例:

```text
Docs: ADR 0011 を Type A / Type B 区別で補強
Build: Dockerfile を削除し pnpm 採用方針と整合させる
Fix: route handler の query 取得を Next.js 16 API に合わせる
```

### スコープ分割の原則

- **1 PR に複数の論理変更が混ざる場合はコミットを分割** する (例: Refactor + Feat、Docs + Fix)
- メジャー依存の更新 (`next` / `react` / `@biomejs/biome` 等のメジャーアップ) は他の機能変更と同じコミット・PR に混ぜない (0004 と整合)
- フォーマッタ起因の大量変更は `Style:` で別コミットに切り出し、レビュアーがロジック差分に集中できるようにする
- 生成物 (`pnpm-lock.yaml` 等) の変更は原因コミットと同じコミットに含める (lockfile だけ別コミットにしない)

## Pull Request 運用

### テンプレート

`.github/pull_request_template.md` の以下セクションは固定で残す。空欄のままでは merge しない。

| セクション | 記載内容 |
| --- | --- |
| `概要` | この PR で何を追加・変更・修正したか (1〜3 行) |
| `変更内容` | 主要な diff の論理単位を箇条書き |
| `動作確認方法` | 再現手順 (例: `pnpm dev` で起動して X を確認) |

PR タイトルも日本語で書き、関連 issue / ADR を本文末尾に記載する。

### Merge 戦略

- **既定: merge commit** (`Create a merge commit`)
  - 履歴に PR 単位の境界が残るため、後追いの reviewer / リリースノート生成側で「どこからどこまでが 1 つの変更か」を辿りやすい
- **`squash merge` は例外運用** — 履歴を 1 行に潰す必要が明確な場合 (機械生成物の大量更新 PR など) のみ、PR 本文で明示してから使う
- **`rebase merge` は使用しない** (保護設定でも未許可)
- 既存 PR ブランチに新たな push を入れた場合、保護設定により approve は自動的に dismiss されるため、改めてレビューを依頼する

### 既存 PR ブランチの更新フロー

承認済み PR ブランチに対して追加修正を入れる場合は次の順序を守る。

1. ローカルで修正・コミットする
2. push する前に PR 上にコメントで「何を直したか」を簡潔に追記する
3. push する (古い approve は dismiss される)
4. レビュアーに再 review を依頼する

履歴書き換え (`git commit --amend` 後の force push、`git rebase`) は保護設定で物理的に拒否されるため、追加修正は **常に新規コミット** で積む。

## リリース運用

1. 次バージョン (`v<X.Y.Z>`) を決め、`production` から `release/v<X.Y.Z>` を作る (`make branch-patch` / `branch-minor` / `branch-major`)
2. このブランチに `feature/*` / `bugfix/*` を PR 経由で merge していく
3. リリース対象が揃ったら `release/v<X.Y.Z>` → `develop` の PR を作る (タイトル例: `Release v<X.Y.Z>`)
4. `.github/release/` に該当バージョンのリリースノートを Markdown で追加する (本リポの慣例。フォーマットは既存ファイルを参照)
5. `develop` → `staging` → `production` の昇格はそれぞれ別 PR で行い、保護ルールに従う
6. `production` HEAD で `make tag-patch` / `tag-minor` / `tag-major` を実行する
   - 直近のリリースタグから SemVer の次バージョンを計算し、`production` HEAD にタグを打つ
   - `.github/release/<v>.md` を `--notes-file` として `gh release create` を行い、GitHub Release を生成する
   - 対応するリリースノート Markdown が存在しない場合、コマンドは失敗する (タグ・Release の整合性担保のため)

**`package.json` の `version` はリリースブランチ名から導く。**`package.json` は版を決める側ではなく、
ブランチ名の名乗りに従う側に置く。人が両方を書くと、出荷した版と名乗る版が黙ってずれる。焼き込むのは
上の手順 1 の `make branch-*` で、切ったブランチの上に version を合わせるコミットが 1 本乗る (既に
名乗りどおりなら何も書かず、コミットも作らない)。PR の base が名乗る版と一致するかは CI
(`package-version`) が同じ規則で導き直して見る。手で直すときは `make version-stamp`。

**検査が届くのは「ブランチ名と `package.json` の一致」までで、ブランチ名そのものの正しさではない。**
ブランチ名が最新タグから 1 段進んだ版であることを保証するのは `make branch-*` が切る瞬間だけで、手で
切った `release/v9.9.9` は誰も咎めない。同じ理由で、`hotfix/<issue>-<desc>` の形で切った hotfix には
版が含まれないため焼き込みは何もせず、CI も据え置きとして緑を返す。版を載せたい hotfix は
`make hotfix-patch` (`hotfix/v<X.Y.Z>`) で切る。

### Hotfix 運用

1. `production` から `hotfix/<issue>-<desc>` を切る (`make hotfix-patch` を使うと `hotfix/v<X.Y.Z>` になり、`version` の焼き込みもリリースブランチと同じに揃う)
2. 修正・テストの上、`hotfix/*` → `production` の PR を作る
3. merge 後、同じ修正を `develop` にも反映する PR を作る (cherry-pick または同等の変更)
4. 必要に応じて `staging` にも反映し、3 環境間の差分を解消する

## 禁止事項

- ❌ 保護ブランチ (`production` / `staging` / `develop` / `release/**` / `hotfix/**`) への直接 push
- ❌ 保護ブランチへの force push / 非 fast-forward push / ブランチ削除
- ❌ `feature/*` / `bugfix/*` を `develop` / `staging` / `production` から派生させること (必ず最新の `release/*` から)
- ❌ プレフィックスなしの commit メッセージ (`update`, `wip` 等)
- ❌ メジャー依存更新を他のコミット (機能追加 / バグ修正等) と同じコミット・PR に混ぜること
- ❌ 既存 PR ブランチへの履歴書き換え (`commit --amend` + force push、`rebase` 等)。追加修正は常に新規コミットで積む
- ❌ PR テンプレートのセクション (`概要` / `変更内容` / `動作確認方法`) を削除・空欄のまま merge すること
- ❌ コミット・PR メッセージで英語を既定とすること (日本語が既定。技術用語の英表記は許容)
- ❌ ブランチ保護設定 (`.github/settings/branch-protection.json`) を本 ADR の改訂なしに緩めること

## 補足

- 「最新の `release/*` から派生する」ルールがあるため、複数の `release/*` が並行する期間は **どの release に乗せるかを issue / PR 段階で決める**。曖昧な場合は最新の `release/*` を採る
- **GitHub のデフォルトブランチは最新の `release/vX.Y.Z`** とする。リポジトリを開いた人が「現在作業中のリリース」を最初に見る形にするためで、go-boilerplate と同形式。デフォルトブランチはリリースを切るたびに新しい `release/*` へ張り替える
- **派生元と PR の base は、どちらもデフォルトブランチが指す `release/vX.Y.Z`。** 現行の `release/*` は `gh repo view --json defaultBranchRef` で引ける。デフォルトブランチが正しく張られていれば、`git switch -c <branch> origin/<release>` の宛先と、GitHub が PR で最初に提示する base が一致する
- **`develop` を base に取ってよいのは `release/*` → `develop` の統合 PR だけ。** `feature/*` / `bugfix/*` の PR が `develop` を向いていたら、派生元を取り違えている。`develop` は統合先であり、開いている `release/*` より必ず後ろにいるため、そこを起点にすると既に載っている変更を差分として引き連れる
- 本 ADR ではブランチ命名・保護対象・コミット粒度のみを宣言する。CI ジョブの具体構成 (どの job をどのブランチで走らせるか) や自動デプロイ連携の詳細は別 ADR で扱う

## 関連 ADR

- [0001-package-manager.md](0001-package-manager.md) — `pnpm-lock.yaml` を commit する方針 (lockfile の手動編集禁止)
- [0004-library-management.md](0004-library-management.md) — 依存ライブラリ更新 PR の粒度 (メジャー更新は別 PR)
- [0151-git-hooks.md](0151-git-hooks.md) — pre-commit / pre-push hook の運用方針
