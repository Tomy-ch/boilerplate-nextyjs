# Make コマンド一覧

## 役割

`.makefiles/` は本リポジトリで使用するすべての `make` ターゲットの中央レジストリです。各 `.mk` ファイルは関連
ターゲットを領域別にグルーピングし、トップレベルの `Makefile` はそれらを `include` するだけなので、既存領域への
ターゲット追加はトップレベル編集なしで完結します。

ターゲットは以下の単位で整理されています。

- `.makefiles/github` : GitHub 初期設定 / リリース / ラベル / ルール設定 / ワークフロー Lint
- `.makefiles/tools` : 開発ツールの管理（mise）/ コミットメッセージ検証 / GitHub Actions の SHA ピン
- `.makefiles/security` : シークレット / 依存脆弱性のスキャン
- `.makefiles/testing` : テストの高速実行とカバレッジ付き完全実行

アプリケーション側のコマンド（`dev` / `build` / `lint` / `typecheck`）は make ターゲットでは**なく**、
`package.json` の scripts に置き pnpm から実行します（[ADR 0001](../docs/adr/0001-package-manager.md)）。テストだけは
hook / CI の二層実行を明示するため `make` が入口となり、内部で pnpm script を呼びます。

## 規約

- ターゲット名はハイフン区切りの小文字（`make install-tools`、`make setup-repo`）
- すべて `.PHONY` 指定し、末尾 `## <説明>` コメントを付けて `make help` の一覧に載せること。説明コメントの無い
  `.PHONY` 行は `make help` が警告する（一覧に出ないターゲットは利用者から見えないため）
- 自明でないロジックはインラインシェルではなく `scripts/*.ts` に置き `pnpm exec tsx` から実行する。TypeScript に
  置けば `pnpm typecheck` と biome の検査対象に入り、実行環境ごとのシェル差異も持ち込まずに済む
- **外から来る値を make の変数として recipe 行へ展開しない。**`$(VAR)` はシェルへ渡る前にテキスト置換されるので、
  `"` や `;` を含む値でクォートが破れ、任意のコマンドが走る。ブランチ名は `git check-ref-format` が両方の文字を
  許すため、これは想定上の入力ではなく実在する入力である。`export <NAME>` で環境変数として渡し、受け取る側が
  `process.env` から読む形にすれば、値はシェルの構文解析を一度も通らない。**この規約を機械検査するものは無い**
  —— `make actions-shellcheck` が見るのは composite action の `run:` で、`make shellcheck` が見るのは追跡下の
  `*.sh` であり、どちらも `.mk` の recipe を読まない
- 一回限りのリポジトリ運用コマンド（`make setup-repo` とその補助）は `.makefiles/github/operation/` 配下に置き、
  開発者向けターゲットと分離する。GitHub 設定を**適用する**ターゲットは `setting/`、何も変更せずファイルを
  **検査する**ターゲットは `lint/` へ置く

## ターゲットの一覧表示

```bash
make help
```

`make help` は `.makefiles/` 配下の `.PHONY: <target> ## <説明>` 行を収集し、各ファイルの `## <カテゴリ>` 見出し
ごとにグルーピングして出力します。

## `.makefiles/github` 系

### GitHub 設定関連

| コマンド | 説明 | 補足 |
| --- | --- | --- |
| `make gh-login` | `gh` コマンドで GitHub にログインします。 | ブラウザ認証方式でログインを行います。 |
| `make delete-all-labels` | GitHub リポジトリ上の既存ラベルをすべて削除します。 | なし |
| `make create-default-labels` | `.github/settings/labels.json` をもとに、デフォルトラベルを作成します。 | 宣言の読み取りと、宣言と実在の差分は [`scripts/github-settings/labels.ts`](../scripts/github-settings/labels.ts) が持ちます。名前が実在するラベルは色や説明が宣言と違っても触りません。 |
| `make apply-branch-protection` | `.github/settings/branch-protection.json` をもとに、対象リポジトリへブランチルールセットを適用します。 | なし |

### GitHub リポジトリ初期化関連

#### `make setup-repo`

フォーク直後のリポジトリ初期化処理をまとめて実行します。以下を順に行います。破壊的な手順を含むため、
フォーク直後以外で実行する前に必ず内容を確認してください。

- `gh` ログイン
- **既存タグの全削除**（ローカルと `origin` の両方）と初期タグ `v0.0.0` の作成 / push
- `develop` / `staging` / `production` ブランチの作成
- GitHub デフォルトブランチの設定
- ブランチルールセット適用
- ラベル初期化
- **`.github/release/` 配下のリリースノートを `v0.0.0.md` を除いて全削除**
- **`upstream` リモートの削除**

#### セットアップ補助コマンド

| コマンド | 説明 | 補足 |
| --- | --- | --- |
| `make setup-replace-license-copyright COPYRIGHT_HOLDER=<name> [COPYRIGHT_YEAR=<year>]` | LICENSE の著作権表記を更新します。 | 年は省略可能です。 |
| `make setup-replace-repository-reference REPOSITORY=<owner>/<repo> [PORTAL_URL=<url>]` | GitHub リポジトリ参照とプロジェクト名（`package.json` の `name`）、およびドキュメントポータルへのリンクをフォーク先へ置換します。 | `PORTAL_URL` を省くと GitHub Pages の配信先（`https://<owner>.github.io/<repo>/`）を組み立てます。custom domain のときだけ渡します。`docs/` / `.claude/` / `scripts/setup/` / ビルド成果物（`.next` / `dist` / `build` / `tmp`）/ ロックファイルは対象外です。 |
| `make setup-remove-boilerplate-only` | boilerplate 限定の記述（配る側にしか意味を持たない規則・注記）を剥がします。 | 剥がし終えると道具自身も消えます。飛ばす選択肢はありません（[0152](../docs/adr/0152-agents-md-policy.md)）。 <!-- boilerplate-only:line --> |

いずれの補助コマンドも `DRY_RUN=1` を付けると、書き換えずに変更予定だけを出力します。有効値は `1` のみで、
それ以外（`DRY_RUN=0` や変数の省略）はすべて実際に書き換えます。

### VRT 基準画像の置き場関連

基準画像は別リポジトリに置き、`baseline/images` からサブモジュールとして参照します
（[`vrt/README.md`](../vrt/README.md)）。置き場側は workflow を持たないので、操作はすべてここから出ます。

| コマンド | 説明 | 補足 |
| --- | --- | --- |
| `make setup-baseline-store` | 置き場を用意し、`baseline/images` へ配線します。 | 既存リポジトリの指定を先に問います（組織では新規作成が権限で縛られていることがあるため）。新規作成時は README を置く初期コミットまで作ります。配線済みなら張り替えるので、組織の移動やリポジトリ名の変更でも同じコマンドで済みます。 |
| `make setup-baseline-app` | 撮り直しに使う GitHub App を `BASELINE_APP_ID` / `BASELINE_APP_PRIVATE_KEY` へ登録します。 | App の作成と鍵の生成は自動化できません。App ID は slug から解決するので控える必要はなく、秘密鍵は標準入力へ貼るのでディスクにも履歴にも残りません。 |
| `make baseline-prune [DRY_RUN=1]` | 生きた ref から指されていない基準画像の一式を置き場から消します。 | 取り消せません。実行を促すのは月次の [`baseline-prune.yaml`](../.github/workflows/baseline-prune.yaml) で、閾値を超えたときだけ issue を立てます。保持の条件は [`scripts/baseline-store/retention.ts`](../scripts/baseline-store/retention.ts)。 |

### GitHub Actions Lint 関連

| コマンド | 説明 | 補足 |
| --- | --- | --- |
| `make actionlint` | `.github/workflows` のワークフロー定義を actionlint で検査します。 | ディレクトリが存在しない場合はスキップします。 |
| `make actions-shellcheck` | composite action（`.github/actions/**/action.yaml`）の `run:` シェルを shellcheck で検査します。 | 指摘は `action.yaml` の行・列で報告します。`bash` / `sh` 以外の `shell:` は検査せず、位置と方言を添えて skip として出力します。 |
| `make actions-mise-pin-lint` | `setup-mise` の版 / digest / キャッシュキーが揃っているか検査します。 | mise 自身の版は `mise.toml` に書けないため composite action が宣言を持ち、`with:` から `env:` を参照できない制約でキャッシュキーが同じ値を二度目に持ちます。片方だけ直した状態は落ちますが原因が遠いので検査します。整合違反は exit 1、検査が成立していない状態は exit 2。 |
| `make actions-comment-secret-lint` | PR コメントを投稿するジョブに `GITHUB_TOKEN` 以外の secret が渡っていないか検査します。 | 規約違反は exit 1、検査そのものが成立していない状態は exit 2 で区別します。 |
| `make actions-required-check-lint` | required status check に登録した context が、すべての PR で報告されるか検査します。 | 判定に要るのが ruleset の宣言とワークフロー定義の 2 ファイルなので actionlint では表現できません。宣言違反は exit 1、検査が成立していない状態は exit 2 で区別します。 |
| `make actions-zizmor` | workflows と composite action の定義を zizmor で静的解析します。 | actionlint / `actions-shellcheck` が shellcheck へ渡す前に `${{ … }}` を潰すため見えない観点（`run:` での未クオートな式展開など）を担います。落とすのは high の所見だけで、抑止は `.github/zizmor.yml` に理由付きで宣言します。hook / CI とも `--offline` で走ります。 |
| `make shellcheck` | 追跡下の `*.sh` を shellcheck で検査します。 | 対象は「依存の導入前に走る必要があってシェルで書くしかないもの」（ADR 0155 の例外）です。TypeScript ではないので 1:1 ゲートもカバレッジも掛からず、`.github` の外なので actionlint も届きません。shellcheck が無ければ検査範囲が黙って縮むため落とします。 |

actionlint は `run:` ステップのシェルも shellcheck 経由で検査するため、両バイナリを `mise.toml` で版固定して
います（[ADR 0003](../docs/adr/0003-version-manager.md)）。先に `make install-tools` を実行してください。

composite action は actionlint の走査対象に含めていません（`action.yaml` を渡すと workflow として解釈され、
必ず構文エラーになります）。その代わり `run:` のシェルは `make actions-shellcheck` が担い、両者を合わせて
pre-commit hook と CI の `actions-lint` job が実行します。actionlint 側に何が残るかは
[ADR 0153](../docs/adr/0153-ci-configuration.md) を参照してください。

`make actions-shellcheck` は、次のいずれかでも異常終了します。検査範囲が黙って縮んだまま緑になる状態を
作らないためのもので、判定はファイル単位です（合計で見ると 1 ファイルの抽出失敗が他ファイルの成功に隠れます）。

- **抽出数が合わない** — パーサ自身の変換で数えた `runs.steps[].run` の件数と、実際に抽出できた件数が食い違う
  （`using:` の綴りを取り違えた action もここで落ちます）
- `runs.using: composite` なのに `runs.steps` がリストとして読めない
- `run:` ステップに `shell:` が無い / 参照先の無い alias がある / YAML として壊れている

`run:` の本文は**リテラル（`|`）で書いてください**。ブロック折り畳み（`>`）は隣接する行を空白へ畳むため
指摘の位置を写し戻せず、畳まれた行がソースに無い構文を作って誤検知も生むため、error になります。

`make actions-comment-secret-lint` は、検査ログをそのまま公開 PR コメントへ複製する `upsert-pr-comment` の
性質上守らなければならない規約 — **本文を作るジョブに secret を渡さない**（[ADR 0153](../docs/adr/0153-ci-configuration.md)）—
を機械検査します。走査単位はステップではなく**ジョブ**で、`upsert-pr-comment` を内側で呼ぶローカル action を
経由するジョブも対象に含めます。

参照を探す対象はソースの範囲ではなく**パース済みスカラーの値**です。範囲で切ると、YAML コメントに書いた
例示が実参照として拾われ、閉じない `${{` があればそこから次の `}}` までが 1 つの式と見なされて間にある
本物の参照を呑み込み、alias で他のジョブへ退避させた値は逆に対象から外れます。

検出できるのは `${{ }}` 式に現れる secrets コンテキストの直接参照だけです。別ジョブで読んで
`needs.<job>.outputs` 経由で渡す間接参照は静的に追えないため検査を通ります。**規約が正であり、この検査は
規約が将来 `env:` 1 行で破られることへの退行ガード**です。

異常終了は 2 通りに分かれます。

- **exit 1** — 規約違反（投稿ジョブ、またはワークフロー全体に及ぶ位置に `GITHUB_TOKEN` 以外の secret がある）
- **exit 2** — 検査そのものが成立していない。ワークフローが 1 件も見つからない（リポジトリルート以外での実行）/
  `jobs:` がマッピングとして読めない / `upsert-pr-comment` の定義があるのに、それを使うジョブが 1 つも
  見つからない（参照の同定が壊れている）/ ジョブが reusable workflow を呼び出している（呼び出し先へ
  `with:` で渡る secret を追えないため未対応）

`make actions-required-check-lint` は、[`../.github/settings/branch-protection.json`](../.github/settings/branch-protection.json)
が必須にしている context ごとに、**その名前を報告し続ける job がちょうど 1 つあること**を検査します。報告
されない context は「必須チェック待ち」のまま永久にマージできず、壊れたと分かるのは原因を入れた PR では
なく次に上がってきた PR です。

落とすのは次の 6 つ。いずれも登録した時点では緑に見え、条件を満たさない PR が来た瞬間にマージ不能へ変わ
ります。

- その名前を宣言する job が無い（job の rename が典型）
- 複数の job が同じ名前を宣言している（どちらの結果を必須にしているのか決まらない）
- その workflow が `pull_request` で走らない
- `pull_request` が `paths` / `paths-ignore` / `branches` / `branches-ignore` で絞られている
- `types:` を絞っていて `opened` / `synchronize` を含まない
- context 名が実行時に枝分かれする（`strategy.matrix` / reusable workflow の呼び出し）

`if:` で降りる job は落としません。降りた job は `skipped` を報告し、必須チェックはそれを成功として数える
ため、報告そのものは途切れないからです。

ワークフローの列挙と `jobs:` へ降りるまでの読み取りは [`../scripts/lib/workflow-files.ts`](../scripts/lib/workflow-files.ts)
が持ちます。**同じ判断を検査ごとに書き起こすと、片方だけが直った状態が黙って生まれる**ため、
`make actions-comment-secret-lint` と共有します。

### リリースブランチ関連

いずれも取り消せない操作（`origin` への push / デフォルトブランチの張り替え）を含みます。何をどの順で
実行するかの判断は [`scripts/release/branch.ts`](../scripts/release/branch.ts) が持ち、ターゲットは
入口を呼ぶだけです。

| コマンド | 説明 | 補足 |
| --- | --- | --- |
| `make hotfix-patch` | `production` から hotfix ブランチを作成し、GitHub のデフォルトブランチに設定します。 | 現在の最新タグを基準に patch を 1 つ進めます。同名ブランチが既に在るとき、作業ツリーが汚れているときは何もせず終了します。 |
| `make branch-patch` | `production` から patch リリース用ブランチを作成し、デフォルトブランチに設定します。 | 現在の最新タグを基準に patch バージョンを進めます。 |
| `make branch-minor` | `production` から minor リリース用ブランチを作成し、デフォルトブランチに設定します。 | 現在の最新タグを基準に minor バージョンを進めます。 |
| `make branch-major` | `production` から major リリース用ブランチを作成し、デフォルトブランチに設定します。 | 現在の最新タグを基準に major バージョンを進めます。 |

### 版の焼き込み関連

版の出所はリリースブランチ名（= タグから数えた次の版）1 つで、`package.json` はそこから導かれる側に
置きます。焼き込みはブランチを切る手順（上記）の中で走るため、通常これらを直に叩くことはありません。
何を書くか・何を落とすかの判断は [`scripts/package-version/version.ts`](../scripts/package-version/version.ts)
が持ちます。

`REF` は recipe 行へ展開せず、環境変数 `PACKAGE_VERSION_REF` としてスクリプトへ渡します（理由は上記
「規約」）。`REF` 省略時の取り回し（`GITHUB_REF_NAME` → 手元の現在ブランチ）はスクリプトが持ちます。

| コマンド | 説明 | 補足 |
| --- | --- | --- |
| `make version-stamp [REF=<ref>]` | `package.json` の `version` をブランチ名の版へ書き換えます。 | `release/vX.Y.Z` / `hotfix/vX.Y.Z` 以外の ref では何もせず正常終了します。コミットはしません。 |
| `make version-stamp-commit [REF=<ref>]` | 同じ焼き込みを、**書き換えが起きたときだけ**コミットまで行います。 | リリースブランチを切る手順が使います。既に名乗りどおりのときにコミットへ進むと、ステージが空のまま `git commit` が落ち、手順が push の手前で止まります。 |
| `make version-stamp-check [REF=<ref>]` | `package.json` の `version` がブランチ名と一致するか検査します。 | 書き換えません。食い違いで落ちます（`package-version` job が pull request の base を渡して回します）。 |

### リリースタグ関連

判断は [`scripts/release/tag.ts`](../scripts/release/tag.ts) が持ちます。基準にする最新タグの選定は
[`scripts/semver/latest.ts`](../scripts/semver/latest.ts) が一箇所で担い、`pnpm exec tsx scripts/semver latest`
としても引けます。

| コマンド | 説明 | 補足 |
| --- | --- | --- |
| `make tag-patch` | patch バージョンを 1 つ進めたタグを作成し、GitHub Release を作成します。 | 現在の最新タグを基準とし、リリースノートには `.github/release/<version>.md` を使用します。ノートが無ければタグも Release も作りません。 |
| `make tag-minor` | minor バージョンを進めたタグを作成し、GitHub Release を作成します。 | 現在の最新タグを基準にします。 |
| `make tag-major` | major バージョンを進めたタグを作成し、GitHub Release を作成します。 | 現在の最新タグを基準にします。 |

## `.makefiles/tools` 系

### ツールバージョン管理関連

| コマンド | 説明 | 補足 |
| --- | --- | --- |
| `make install-tools` | `mise.toml` の `[tools]`（Node.js / pnpm / actionlint / shellcheck / zizmor / gitleaks / Trivy）をインストールします。 | mise の事前インストールが必要。全エントリが backend を明示します。詳細は [ADR 0003](../docs/adr/0003-version-manager.md) 参照 |

### コミットメッセージ検証関連

| コマンド | 説明 | 補足 |
| --- | --- | --- |
| `make commitlint [COMMIT_MSG_FILE=<path>]` | コミットメッセージを commitlint で検証します。 | `.lefthook.yaml` の commit-msg hook から呼ばれます。`COMMIT_MSG_FILE` 省略時は編集中のコミットメッセージを対象にします。規約は [ADR 0150](../docs/adr/0150-git-workflow.md) 参照 |

### GitHub Actions の SHA ピン関連

`uses:` を moving tag のまま置くと、上流が tag を付け替えた時点で CI が実行する内容が黙って変わります。
これを防ぐため、参照は commit SHA へ固定し、tag → SHA の対応を `.github/actions-pin.toml` が持ちます
（[ADR 0153](../docs/adr/0153-ci-configuration.md)）。**版の SSOT は `uses:` 行末尾のコメント tag** であり、
`@` 側の SHA ではありません。

| コマンド | 説明 | 補足 |
| --- | --- | --- |
| `make actions-pin-resolve [ACTIONS_PIN_MIN_AGE_DAYS=<days>] [ACTIONS_PIN_ALLOW_MOVED="<key>..."]` | コメント tag を `git ls-remote` で SHA へ解決し、ロックファイルを再生成します。 | 3 つのうち唯一ネットワークへ出ます。既定の検疫日数は 14。不変を宣言した tag の解決先が変わると exit 1（下記）。GitHub API のレート制限に掛かる場合は `GITHUB_TOKEN`（または `GH_TOKEN`）を設定してください。 |
| `make actions-pin-apply` | ロックファイルを元に `uses:` の `@<sha>` を書き換えます。 | コメント tag は保持します。 |
| `make actions-pin-check` | `uses:` がロックファイル通りに固定されているか検査します。 | 書き換えず、ネットワークにも出ません。pre-commit hook と CI の `actions-pin` job が実行します。未登録の参照 / 未固定・不一致の SHA / 壊れたロックファイル / 参照されなくなったエントリ / 解釈できない `uses:` 記法を検出して exit 1（fail-closed）。 |
| `make egress-apply` | `.github/egress.yaml` を workflow の harden-runner へ反映します。 | 許可した宛先以外への外向き通信は遮断されます（`egress-policy: block`）。**足す根拠は実測**（`audit` が記録した `domain resolved:` 行）に置いてください。記録が揃っていない workflow は宣言側で `audit` に留め、理由と外す条件を書きます。 |
| `make egress-check` | workflow が宣言どおり固定済みかを検査します。 | 書き換えず、ネットワークにも出ません。pre-commit hook と CI の `actions-lint` job が実行します。宣言との差分 / 想定外の記述 / 参照されなくなったエントリを検出して exit 1（fail-closed）。 |

`uses:` は **1 行 1 ステップのブロック記法**で書いてください。YAML の flow mapping
（`- {name: X, uses: owner/repo@v1}`）は検査の網に入らないため、素通りではなく error になります。

`ACTIONS_PIN_MIN_AGE_DAYS` は供給網検疫の窓です。解決先が公開から指定日数に満たない場合、既存のピンがあれば
それを維持し、無ければ採用を見送ります。公開直後の（侵害されている可能性のある）リリースを、上流が検知・
取り下げるより先に取り込まないための猶予です。`0` を渡すと検疫は無効になります。

検疫が見る経過日数は、Release の `published_at` と commit の日付のうち**新しい方**です。Release は tag 名に
紐づくだけで tag の付け替えでは動かず、commit の日付は発行者が任意に書けるため、どちらも単独では解決先の
新しさを表しません。ただし新しい方を採ってもなお、**検疫は自動化された乗っ取りに対して時間を稼ぐ仕組みで
あり、日付の偽装に耐える保証ではありません**。tag 付け替えそのものの検知は下記の fail-closed が担います。

#### tag 付け替えの検知

`make actions-pin-resolve` は、**不変を宣言した tag の解決先が変わった時点で exit 1 になり、ロックファイルを
書きません**（承認済みの移動や他のエントリを含め、一切書きません）。付け替えられた SHA が一度ロックファイルへ
入れば、以降 `make actions-pin-check` は「整合している」と答え続けるためです。

`# v6` のような **bare な major 番号だけを moving**（前進してよい）とみなします。`# v6.1.0` / `# v6.1` / `# main`
はすべて不変として扱われ、解決先が動けば落ちます。上流が `v6.1` のような moving minor tag を持つ場合は誤検知
しますが、その向きの誤りは停止で済みます。

意図した更新であれば、ロックファイルのキーを空白区切りで並べて承認します。

```bash
make actions-pin-resolve ACTIONS_PIN_ALLOW_MOVED="actions/cache@v6.1.0"
```

承認は 1 回の移動に対して与えるものです。移動していないキーを承認に残していると次の付け替えを黙って通すため、
その場合は「承認は不要でした」と表示されます。承認しても検疫は独立に掛かります。

検知の失敗出力は、キーを埋め込んだ承認コマンドを組み立てません。キーは 1 行ずつ上に並ぶので、承認する分だけを
自分で並べ直してください。

更新の運用手順は `actions-pin` スキルが持ちます。

> Rationale: [0153](../docs/adr/0153-ci-configuration.md) 決定 3

### container image の digest ピン関連

registry の tag は、同じ名前のまま別の中身を指せます。`image:` / `FROM` / `uses: docker://` を tag の
ままにしておくと、指し先が差し替わったことに気づかないまま新しい中身を引きます。そこで参照は
digest へ固定し、`image:tag` → digest の対応を `docker/images-pin.toml` が持ちます。**版の SSOT は
tag 側**であり、digest ではありません。走査対象は `docker-compose*.{yml,yaml}`、
`docker/<用途>/Dockerfile`、そして `.github/workflows/**` / `.github/actions/**` の
`uses: docker://<image>:<tag>` です。

最後のものは `uses:` の行ですが参照先は registry なので、SHA ピンを担う actions-pin ではなくこちらが
固定します（actions-pin は tag を `git ls-remote` で commit へ解決する機構で、registry には効きません）。
両機構は同じファイルを走査しますが、掴む行は重なりません。

| コマンド | 説明 | 補足 |
| --- | --- | --- |
| `make images-pin-resolve [IMAGES_PIN_MIN_AGE_DAYS=<days>]` | tag を `docker buildx imagetools inspect` で digest へ解決し、ロックファイルを再生成します。 | 3 つのうち唯一ネットワークへ出ます（docker の認証情報を使います）。既定の検疫日数は 14。 |
| `make images-pin-apply` | ロックファイルを元に参照を `image:tag@sha256:...` へ書き換えます。 | tag と行末コメントは保持します。 |
| `make images-pin-check` | 参照がロックファイル通りに固定されているか検査します。 | 書き換えず、ネットワークにも出ません。pre-commit hook と CI の `images-pin` job が実行します。未登録 / 未固定・不一致 / 参照されなくなったエントリ / 解釈できない記法を検出して exit 1（fail-closed）。 |

参照は **1 行 1 件・引用符なし・tag 明示**で書いてください。`image: "alpine:3.24"` のような記法や、
tag を省いた `uses: docker://alpine`（＝`:latest`）は検査の網に入らないため、素通りではなく error に
なります。

`IMAGES_PIN_MIN_AGE_DAYS` は供給網検疫の窓で、経過日数は image config の `created` から見ます
（マルチアーキでは最も古いものを採ります）。既存のピンがあればそれを維持し、無ければ tag のまま
残さず失敗させます。tag だけの運用を許すと、未検証の digest をそのまま引くためです。

**tag の付け替えは検知しません。** base image の tag は patch 版が出るたび前進するのが通例で、
「解決先が変わったら止める」を入れると日常的な更新と区別が付かなくなります（Actions の SHA ピンとは
ここだけ運用が異なります）。image に対して働く防壁は検疫と固定の 2 つです。

## `.makefiles/testing` 系

| コマンド | 説明 | 補足 |
| --- | --- | --- |
| `make test-cached` | Vitest を cache 利用で実行します。 | pre-commit 用の高速フィードバック。coverage gate は実行しません。 |
| `make test-full` | Vitest を cache 無効・coverage 付きで実行します。 | pre-push / CI 用。Statements / Branches / Functions / Lines の各 100% を下回ると失敗します。 |
| `make scripts-test-cached` | 補助スクリプト（`scripts/**`）の suite を cache 利用で実行します。 | pre-commit 用。export と describe の 1:1 ゲートを含みます。 |
| `make scripts-test` | 補助スクリプトの suite を cache 無効・coverage 付きで実行します。 | pre-push / CI（`scripts-check`）用。アプリ本体の suite と分けるのは、`scripts/` に居るのが検査機構そのもので、落ちた理由を取り違えないためです（[0090](../docs/adr/0090-testing-strategy.md)）。 |
| `make build-storybook` | Storybook を静的に build します。 | VRT の撮影対象。`make vrt` / `make vrt-update` が前段で呼びます。 |
| `make vrt [VRT_SHARD=<i>/<N>] [VRT_ARGS=<args>]` | 全 story を基準画像と比較します。`VRT_SHARD` は撮影対象の何分割目かで、渡すのは CI だけです。 | digest 固定した Playwright コンテナ内で実行します（[`vrt/README.md`](../vrt/README.md)）。ホスト直実行は比較の前に落ちます。 |
| `make vrt-retake [VRT_ONLY=<id>,<id>] [VRT_ARGS=<args>] [BASELINE_BRANCH=<branch>]` | 基準画像を撮り直して置き場へ送ります（`vrt-update` → `baseline-push`）。 | 手元から撮り直す入口はこれです。撮って送らないと親の gitlink が古いままになり、手元の `make vrt` は通るのに CI だけ落ちます。 |
| `make vrt-update [VRT_ONLY=<id>,<id>] [VRT_ARGS=<args>]` | 基準画像を撮り直します（置き場へは送りません）。 | `VRT_ONLY` は撮り直す story を id で絞ります（該当 0 件なら失敗）。CI 側の同じ操作は `baseline-retake` ラベルが起動し、直前の実行が報告した story だけを対象にします。撮り直しは承認ではなく、見た目の判断は置き場の compare ビューを見て PR レビューで行います。 |
| `make baseline-sync` | 基準画像の実体を、いま居るブランチが指す版へ合わせます。 | hook (post-checkout / post-merge) が呼びます。git はブランチを移っても実体を動かさないため、放っておくと指し先から取り残され、その汚れを commit すると間違った指し先が載ります。取り込んでいない作業ツリーでは何もしません。 |
| `make baseline-push [BASELINE_BRANCH=<branch>]` | 撮り直した一式を置き場へ送り、サブモジュールのポインタを進めます。 | 置き場へ送る経路はここだけです。サブモジュールの中で直接コミットすると撮り直しどうしが繋がり、掃除でどれも落とせなくなります。`BASELINE_BRANCH` の既定は現在のブランチ。 |
| `make vrt-gate` | 比較を省いてよいかだけを答えます（`run` / `skip`）。 | **`build-storybook` の後でしか答えられません** —— 絵を決める入力に `storybook-static` が入っているためで、CI が「先に判定してから撮影を割る」形を取れない理由もこれです。 |
| `make vrt-record-verified` | 検査が通った時点の入力のハッシュを記録します。 | CI が呼びます。割った実行では**全 shard が緑になってから**書きます（`vrt.yaml`）。 |
| `make vrt-report` | 直前の実行の HTML レポートを開きます。 | 出力は `tmp/vrt/`（追跡対象外）。 |
| `make e2e [E2E_ARGS=<args>] [E2E_PORT=<port>] [E2E_HOSTNAME=<addr>]` | build したアプリを実際のブラウザで動かし、主要ジャーニー・ブラウザが報告する異常・帯ごとの出し分けを 3 つの描画エンジンで回して、画面単位の見た目を基準画像と比べます。 | **アプリはホスト、ブラウザはコンテナ**で動きます（[`e2e/README.md`](../e2e/README.md)）。`node_modules` は入れた OS と CPU 向けに解決されるため、コンテナ内で `next start` は起動できません。起動と後片付けもこのターゲットが持ちます。待ち受けるアドレスはコンテナが到達に使う経路 1 本へ絞ります —— この起動が使う `APP_ENV=ci` ではテスト専用の session 発行の口が開いているため、全インターフェースで待ち受けると LAN から叩ける状態になります。 |
| `make e2e-maintenance [E2E_PORT=<port>] [E2E_HOSTNAME=<addr>]` | `APP_MAINTENANCE_MODE=on` でアプリを起動し、全ルートが停止画面へ差し替わること・生存確認が通ること・状態を変える要求が 503 で断られることを確かめます。 | `make e2e` と同じ立て付け（build → 起動 → コンテナのブラウザから当てる → 片付け）に、起動の環境と当てる設定だけを差し替えて乗せています。**基準画像を撮らない**ので置き場（submodule）を要求しません。停止は全ルートに効き、切り替えに起動し直しが要るため、通常の巡回へ混ぜられません（[`e2e/README.md`](../e2e/README.md)）。 |
| `make e2e-metadata [E2E_PORT=<port>] [E2E_HOSTNAME=<addr>]` | `SITE_INDEXABLE=on` でアプリを build して起動し、`robots.txt` が巡回を許すこと・`sitemap.xml` が挙げる URL が実在し自分を正規 URL として名乗ること・アイコンと OG 画像が絵として返ることを確かめます。 | `make e2e-maintenance` と同じ立て付けですが、**build から差し替えます** —— 静的に描かれる画面の metadata は build 時の設定で焼き込まれるためです（[`src/config/site/site.server.ts`](../src/config/site/site.server.ts)）。外から見た origin にはコンテナから見たアプリの場所を渡し、画面が名乗る URL と開いた URL を同じ綴りにします。索引させない側は通常の巡回が見ます（[`e2e/README.md`](../e2e/README.md)）。 |
| `make e2e-update [E2E_ARGS=<args>]` | 画面の基準画像を撮り直します（置き場へは送りません）。 | 送るのは `make baseline-push` です。画面の基準画像も story と同じ置き場の `screen/` 区画に入ります。撮り直しは承認ではありません。 |
| `make e2e-report` | 直前の実行の HTML レポートを開きます。 | 出力は `tmp/e2e/`（追跡対象外）。trace も同じ場所に出ます。 |
| `make lighthouse [E2E_PORT=<port>]` | `e2e/lib/screens.ts` が宣言する画面を 1 枚ずつ Lighthouse で開き、LCP / CLS / TBT を `performance-budget.yaml` の上限と照らします。 | 起動は `make e2e` と同じ仕組みを使い、**ブラウザだけホストで動かします** —— 比べるのが画素ではなく数値なので、固定すべきはフォントのラスタライズではなくブラウザの版で、それは lockfile の `@playwright/test` が担います。画面ごとに複数回測って中央値を採り、回数も同じ宣言が持ちます（[ADR 0101](../docs/adr/0101-performance-budget.md)）。 |
| `make lighthouse-gate` | 測定を省いてよいかだけを答えます（`run` / `skip`）。 | 数える入力は build 生成物ではなく元なので、**台を割る前の段で 1 度だけ引けます**。撮影側（`vrt-gate`）が台ごとに引くのは `storybook-static` を数えているためで、こちらにその制約はありません。 |
| `make lighthouse-record-verified` | 予算を通った時点の入力のハッシュを記録します。 | CI が呼びます。割った実行では**全台の結果を知っている束ねる側**が書きます（`lighthouse.yaml`）。 |
| `make lighthouse-report` | 直前の実行が残した LHR から、動いた要素・押し下げの量・重い script を引きます。 | 出力は `tmp/lighthouse/`（追跡対象外）。 |
| `make vrt-review BRANCH=<branch> VRT_ONLY=<id>,<id> [RUN=<run-id>] [VRT_REVIEW_PORT=<port>]` | CI が落とした story を、使い捨ての作業ツリーで立てた Storybook に並べます。 | 引数は PR コメントがコピー用の 1 行として書き出します。**手元の作業ツリーは動かしません** —— `tmp/review/vrt/<ブランチ>` に `origin/<ブランチ>` を切り離して展開します。`RUN` を渡すと `vrt-diff` も落として隣のポートで配ります（`gh` が要る）。ここで見えるのは「なぜ変わったか」であって画素の一致ではありません（ホストのフォントで描くため）。 |
| `make e2e-review BRANCH=<branch> E2E_ONLY=<name>,<name> [RUN=<run-id>] [E2E_REVIEW_PORT=<port>]` | CI が落とした画面を、使い捨ての作業ツリーで起動したアプリに並べます。 | 起動するのは**本番ビルド**です（画面の基準画像がそれで撮られているため）。役割の要る画面は行き先を持たせた開発用 session の面を経由します。待ち受けは loopback へ絞ります —— `APP_ENV=ci` で session 発行の口が開いているためです。 |
| `make review-clean` | 上の 2 つが生やした作業ツリーを、git の登録ごと片付けます。 | 作業ツリーは Ctrl-C では消えず、`node_modules` と build 生成物を抱えたまま `tmp/review/` に溜まります。ディレクトリを直接消すと実体を失った登録が残り、次の `git worktree add` がそこで断られるため、片付けはこの入口から行います。 |

## `.makefiles/security` 系

シークレットの混入と脆弱な依存をローカルで検知するためのスキャンです（[ADR 0110](../docs/adr/0110-security-operations.md)）。

抑止は `.gitleaks.toml` / `.gitleaksignore` / `.trivyignore.yaml` に限定し、各ファイル冒頭の抑止ポリシーに従って理由付きで記録します。**`make audit` だけは抑止ファイルを持ちません** —— 閾値が「修正版がある」ことなので、抑止するくらいなら上げられる、という前提で組んであります。上流が脆弱な版を厳密固定していると、この前提は崩れます。

| コマンド | 説明 | 補足 |
| --- | --- | --- |
| `make secret-scan` | push 予定のコミット範囲を gitleaks でスキャンします。 | pre-push hook から実行されます。対象は「`HEAD` から辿れてどのリモートにも無いコミット」。検出時は exit 1 で失敗します（fail-closed）。検出値は `--redact` で出力しません。 |
| `make secret-scan-history` | コミット履歴全体を gitleaks でスキャンします。 | CI の週次実行だけが呼びます。マージ済みの履歴に埋もれた秘密を拾う用途で、走査時間がコミット数に比例して伸びるため hook には載せません（撤回条件 W4）。 |
| `make trivy-fs` | 依存ライブラリの脆弱性を Trivy fs でスキャンします。 | 手動実行専用で、**意図的に hook へ接続していません**。exit code でも落としません。脆弱性は push する当事者がその場で解消できず、diff と独立に状態が変わるためです。ブロックは昇格ゲートが持ちます（[ADR 0110](../docs/adr/0110-security-operations.md) 3.1）。 **CI だけが `TRIVY_FS_DETECT_EXIT=1` を渡し**、検出を exit code で受け取ってコメントの要否を決めます（手元の既定は 0 で、従来どおり落ちません）。 |
| `make trivy-fs-release` | 昇格前の依存脆弱性を Trivy fs で厳格にスキャンします。 | 保護ブランチ宛 PR で CI が呼ぶゲート。上の報告専用との差分は `--ignore-unfixed` を外すことだけで、severity の範囲は同じです。検出で exit 1。 |
| `make opengrep-rules` | SAST のルールを固定した commit から取り出します。 | `make sast` / `make sast-sarif` の前段で自動的に走ります。レジストリ（semgrep.dev）を引かない理由と、検体を置かない取り出し方は [`.github/workflows/README.md`](../.github/workflows/README.md) の「SAST のルールをレジストリから引かない」が持ちます。固定値は `opengrep-rules-pin.toml`（`.github/actions-pin.toml` と同じ形）が持ち、commit を上げるときは `pnpm exec tsx scripts/opengrep-rules --resolve --commit <sha>` が書き直します。 |
| `make sast` | 自分が書いたコードの脆弱なパターンを opengrep で検査します。 | **0 件の baseline を前提にしたゲート**で、所見があれば exit 1。許容する所見はソースへ `// nosemgrep: <rule-id>` を理由付きで置きます。CodeQL と重複しますが、あちらは GitHub の外へ持ち出せないため、持ち出せる SAST を別に持ちます。 |
| `make sast-sarif` | 同じ検査を SARIF で書き出します。 | code scanning への取り込み用。**検査条件は `make sast` と同じ変数を読む** —— ゲートと Security タブの一覧が違う走査を指すと、どちらも信用できなくなります。書き出したあと `scripts/sarif` が整えます —— `// nosemgrep:` で抑止した所見は SARIF に残るため、落とさないと Security タブにだけ積み上がります。 |
| `make osv-scan` | 依存の脆弱性を OSV データベースで見ます。 | 報告専用。Trivy とも `pnpm audit` とも参照先が違うので件数は一致しません。**CI だけが `OSV_DETECT_EXIT=1` を渡し**、検出を exit code で受け取ってコメントの要否を決めます（手元の既定は 0 で、従来どおり落ちません）。 |
| `make osv-scan-release` | 昇格前の依存脆弱性を OSV で見ます。 | 保護ブランチ宛 PR で CI が呼ぶゲート。検出で exit 1。抑止は `osv-scanner.toml` が持ち、**フィルタした所見は理由付きで出力に残ります**。 |
| `make dast` | 走っているアプリへ HTTP を撃ち、配信面を検査します。 | **ここだけが成果物ではなく応答を読みます。** 撃つ相手は `DAST_TARGET` で渡します（既定はコンテナから見たホストの :3000）。既知の欠落は `.github/zap/rules.tsv` の一覧が持ち、**一覧に無い所見は exit 1**。ZAP は `IGNORE` にした規則も出力に残すので、黙殺と区別が付きます。 |
| `make bearer-scan` | 値がプロセスの外へ出る地点を、その値の分類と併せて見ます。 | **落としません。** 誤検知の傾向が強く、fail-closed にすると規則単位の無効化へ寄っていくためです（それは禁止）。所見は code scanning へ送り、差分が持ち込んだものを GitHub 側のチェックが赤にします。個別の誤検知は `bearer.ignore` がフィンガープリントで受けます。 |
| `make bearer-sarif` | 同じ検査を SARIF で書き出します。 | code scanning への取り込み用。所見が 0 件のとき Bearer は `results: null` を書きますが SARIF にその値は無いため、`scripts/sarif` が配列へ揃えます。揃えないと取り込みが弾かれ、「所見が無い」と「報告できていない」が見分けられなくなります。 |
| `make audit` | 依存監査ゲート（`pnpm audit`）。 | 修正版のある `high` / `critical` が 1 件でもあれば exit 1。判定と表の組み立ては `scripts/audit-gate` が持ちます。Trivy とは集計単位も参照する DB も違うため件数は一致せず、**突合して差分を潰そうとしません** —— どちらか一方でも閾値に達したものを blocking として扱います（[ADR 0110](../docs/adr/0110-security-operations.md) 3）。 |

## 補足

- 既存グループファイルへのターゲット追加ならトップレベル編集は不要。ただし**新規** `.mk` ファイルを追加する場合は、
  トップレベル `Makefile` へ `include` 行の追記が必要（ワイルドカードではなく個別 include のため）
- リリースブランチ / タグ系のターゲットは GitHub のデフォルトブランチを操作し `origin` へ push します。実行前に
  [ADR 0150](../docs/adr/0150-git-workflow.md) を確認してください
