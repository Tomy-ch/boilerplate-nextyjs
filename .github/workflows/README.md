# GitHub Actions ワークフロー

CI / CD のワークフロー定義。設計判断の出所は [ADR 0153](../../docs/adr/0153-ci-configuration.md) で、本書はその実装がどう並んでいるかを示す。

**ワークフロー定義内のコメントは英語で書く** —— このディレクトリと `../actions/` の両方（[AGENTS.md](../../AGENTS.md) 言語規則の明示的な例外。本書を含む `.github/` 配下のドキュメントと道具の設定は日本語）。

## トリガ戦略

| グループ | 走るタイミング | 役割 |
| --- | --- | --- |
| CI Checks | 全 PR | lint / typecheck / build / test / 起動が壊れていればマージを止める。**費用が PR 1 本に見合わない 3 本（`a11y` / `e2e` / `lighthouse`）は重いステップだけが降りる** —— 下記「先送りにする検査」 |
| Security | 全 PR + 週次スケジュール | コード・依存・ワークフロー定義・コミット済みシークレットの脆弱性を可視化する |
| Deployment | 保護ブランチへの push | ビルド成果物の配信 |
| Documentation | portal 配信 | 生成ドキュメントの再生成と配信 |

実体があるのは **CI Checks** / **Security** / **Documentation**。Deployment はアプリ本体の配信先がテンプレートから作った側の決定であるため（[0011](../../docs/adr/0011-no-docker.md)）本リポには置かない。

## ワークフロー一覧（CI Checks）

### 先送りにする検査

`a11y` / `e2e` / `lighthouse` は、**普通の PR では重いステップを走らせない**。実行が回るのは 5 経路
—— 昇格 PR（base が `develop` / `staging` / `production`）/ 保護ブランチへの push / 日次 / ラベル
（`run-a11y` / `run-e2e` / `run-lighthouse`）/ `workflow_dispatch` —— で、判定は
[`../actions/check-trigger`](../actions/check-trigger/action.yaml) 1 箇所が持つ。

**降りるのは `if:` であって `on:` ではない。**job は必ず起動して context を報告する。理由は下記
「`paths:` フィルタを使わない」と同じで、必須 check に登録した context が報告されないと PR は
永久に止まる。

払う代償は検知が 1 マージぶん遅れることで、買うのは「結果がマージの判断をほとんど動かさない検査を、
どの PR も待たない」ことである。その代償を払うべきでない差分は `Deferred Checks` が名指しする。

**ただし `e2e` と `lighthouse` は、待てない差分を自分でも見分ける。** 5 経路に当たらなくても、差分の
構造が下の形に当たればラベル無しで回る。名指しと違って、これは勧告ではなく実行である。

| 検査 | ラベル無しで回る差分 | なぜ待てないか |
| --- | --- | --- |
| `lighthouse` | 画面の宣言 / 器（layout と shell の部品） | 足した画面には比べる先の数値がまだ無く、待つと検出だけでなく比較そのものが遅れる |
| `e2e` | 器（layout と shell の部品）/ 全画面が読む土台の CSS / 画面の宣言 | **直す経路が PR にしか無い。** 基準画像の撮り直しは比較が報告した集合に限られ、報告は PR の実行にしか出ない。merge 後に食い違うと、撮り直す相手を名指しできる PR がもう無い |

`e2e` の線は「画面を動かすか」ではなく**「動かすことが差分の見た目から分かるか」**で引いてある。mock の
応答やジャーニーの宣言も画面を動かすが、それは書いた人に見えているのでラベルの側に残る。この判定のため
に、降りる PR も約 1 分ぶんの道具立てを払う。

**判定そのものが取れなかったときは、回す側へ倒れる。** 差分を読めないことは「回すに値しない差分だ」の
証拠にならないためで、`diff-scope` が読めない差分に当てているのと同じ読み方である。倒れたことは
`::warning::` で残す —— 黙って倒れると、後から見て「差分が要求して回った」実行と区別が付かない。

#### 降りた理由は 2 つあり、書き分ける

降りる判定は 2 段ある。**先送り**（この節の 5 経路にも、差分が自分で回すと決める形にも当たらなかった）
と、**差分が届かない**（`diff-scope` が絵にもジャーニーにも届かないと答えた）である。読み手にとっては別物で、前者は
merge を待てば答えが出るが、後者はいくら待っても何も出ない。**PR コメントはこの 2 つを書き分ける** ——
どちらも「回っていません」で済ませると、ラベルを付けるべき PR と付けても無駄な PR が同じ顔になる。

#### PR の外で落ちたら、issue にする

`pull_request` 以外（保護ブランチへの push / 日次）で落ちた失敗は、赤いチェックを読む場所が無い。
**持ち主のいる形に変える必要があるので issue を立てる。ブランチごとに 1 本で、2 度目は同じ issue へ
コメントする** —— 既に旗の立っているブランチでもう一度落ちたのは、同じ 1 つの未解決の事実である。

同じ形を `a11y` / `e2e` / `lighthouse` / `vrt-guard` / `baseline-prune` が持ち、探して立てる側は
[`../actions/upsert-issue`](../actions/upsert-issue/action.yaml) が 1 つだけ持つ。各ワークフローに
残るのは**本文を組み立てるステップ**で、書き足すのはその検査に固有の一文（axe なら「rule を切って
通さないでください」）だけでよい。

**本文が組めなくても issue は立てる。** 起票するステップは `!cancelled()` を持ち、本文を組み立てる
ステップの成否を見ない。組み立てが落ちたときに何もしなければ、空の issue が立つ。よって組み立ては
道具を通さない固定文へ退化させる —— ここは誰も見ていない実行のための最後の砦であり、黙るより
「本文を組めなかった」と言うほうが読み手に届く。

**本文を安全にするのは呼ぶ側の責務である。**issue の本文は Markdown として描かれ、そこへ流すのは
道具の出力 —— このリポジトリが書いたのではない文字列 —— なので、4 スペース字下げでコードブロックに
するか、markup を作れない文字集合へ濾してから渡す（[0153](../../docs/adr/0153-ci-configuration.md) §5）。

| ワークフロー | ファイル | job 名 | 内容 |
| --- | --- | --- | --- |
| Lint | `lint.yaml` | `lint` | biome（full profile）で Markdown を除くリポジトリ全体を検査する（対象範囲は `biome.json` の `files.includes`） |
| Markdown Lint | `md-lint.yaml` | `md-lint` | markdownlint + mermaid 図の構文 + `.claude/**` の意味検査（`skill-lint`）を実行する |
| Typecheck | `typecheck.yaml` | `typecheck` | `tsc --noEmit` で型を検査する |
| Test | `test.yaml` | `test` | アプリ本体（`src` / `docs-viewer` / `tokens` / `mocks`）の Vitest をカバレッジ 100% のハードゲートで実行し、octocov が coverage・差分・実行時間を PR へ報告する |
| Scripts Check | `scripts-check.yaml` | `scripts-check` | 補助スクリプト（`scripts/**`）の Vitest をカバレッジ 100% で実行し、export と describe の 1:1 対応ゲートをリポジトリ全体へ掛ける |
| Build | `build.yaml` | `build` | `next build` が通ることを検査する |
| Bundle Budget | `bundle-budget.yaml` | `bundle-budget` | route ごとに browser が最初に読む client JS を測り、`performance-budget.yaml` の上限と base からの増分に照らす |
| Dead Code | `dead-code.yaml` | `dead-code` | どの入口からも到達しない file / export / dependency を検出する。`src/components/**` は作った側が使う口として入口に宣言し、未使用を問わない |
| Smoke | `smoke.yaml` | `smoke` | `next start` を起動し `/` が応答することを検査する |
| Storybook Build | `storybook-build.yaml` | `storybook-build` | `build-storybook` が通ることを検査する。Vitest は story を直接 import するので addon やビルダーの解決までは見ず、`vrt` の build は「比較の前段」なので失敗が別の意味に読める。配信（`deploy-docs`）とは分けている |
| Purge Verify | `purge-verify.yaml` | `purge-verify` | 使い捨てチェックアウトで同梱サンプルを破棄し、破棄後のツリーで整形・検査・build・test が通ることと、過不足・残留参照が無いことを検査する |
| Strip Verify | `strip-verify.yaml` | `strip-verify` | 使い捨てチェックアウトで boilerplate 限定の記述を剥がし、剥がした後のツリーで整形・検査・build・test が通ることと、マーカーが 1 件も残っていないことを検査する。**剥がしの対象に自分自身を含む**（[`../../scripts/setup/remove-boilerplate-only/manifest.ts`](../../scripts/setup/remove-boilerplate-only/manifest.ts) の `SELF_DESTRUCT_PATHS`）。剥がしは任意ではないので、作った側には検証する相手が残らない <!-- boilerplate-only:line --> |
| Lockfile Drift | `lockfile-drift.yaml` | `lockfile-drift` | ロックファイルが `package.json` と一致し、install が追跡ファイルを書き換えないことを検査する |
| Package Version | `package-version.yaml` | `package-version` | `package.json` の `version` が PR の base が名乗る版と一致するか検査する。版の出所はリリースブランチ名（= タグから数えた次の版）1 つで、焼き込みは `make branch-*` がブランチを切る手順の中で行う。base がリリースブランチでない PR では据え置きとして緑を返す |
| Tokens Drift | `tokens-drift.yaml` | `tokens-drift` | hand-written token SSOT と追跡する CSS 生成物が一致することを検査する |
| Actions Lint | `actions-lint.yaml` | `actions-lint` | actionlint でワークフロー定義自身を検査し（`run:` のシェルは shellcheck 経由）、composite action の `run:` シェルを `make actions-shellcheck` で、追跡下の `*.sh` を `make shellcheck` で、PR コメントを投稿するジョブへの secret 混入を `make actions-comment-secret-lint` で、mise のピンの整合を `make actions-mise-pin-lint` で、必須ステータスチェックの宣言と実体の突合を `make actions-required-check-lint` で、定義そのものの静的解析を `make actions-zizmor` で検査する |
| Actions Pin | `actions-pin.yaml` | `actions-pin` | `uses:` が `.github/actions-pin.toml` 通りに SHA 固定されているか検査する |
| Images Pin | `images-pin.yaml` | `images-pin` | container image 参照が `docker/images-pin.toml` 通りに digest 固定されているか検査する |
| Accessibility | `a11y.yaml` | `a11y` / `a11y-comment` | 全 story に axe を掛ける。撮影と同じ digest 固定コンテナに相乗りするので追加のランナーを入れない（ADR 0091 §3）。**実ブラウザなので色コントラストまで届く** — component テストの `vitest-axe` は jsdom で走るため contrast を無効化している。検査するのは撮影と同じ 1 テーマだけで、片テーマでだけ出る違反は届かない（[`vrt/README.md`](../../vrt/README.md)）。VRT と job を分けるのは、a11y の失敗が撮り直しの対象に入ると、撮り直しても直らないまま基準画像だけが承認済みになるため。省く判定は 3 層ある — **普通の PR ではそもそも回さず**（上記「先送りにする検査」）、回す事由があっても差分が story に届かなければ降り、届いても絵を決める入力が前に通った時点と同じなら axe を省く（[`vrt/README.md`](../../vrt/README.md)）。PR 以外で落ちたときはブランチごとに issue を立てる |
| E2E | `e2e.yaml` | `e2e` / `e2e-comment` | build したアプリを実際のブラウザで動かす。主要ジャーニー・ブラウザが報告する異常（hydration の不一致 / 描画中の例外 / 通信の失敗 / CSP 違反）・帯ごとの出し分けを 3 つの描画エンジンで回し、画面単位の見た目を基準画像と比べる（[`e2e/README.md`](../../e2e/README.md)）。**見ているのは 3 つの描画エンジンだけで、ブラウザの銘柄も版も見ていない** —— モダンブラウザ（[0102](../../docs/adr/0102-browser-support.md)）が実装として畳まれる先が Chromium / Firefox / WebKit であり、版は digest 固定したイメージが決める。アプリはランナーで起動し、コンテナで動かすのはブラウザだけ（`node_modules` は入れた OS と CPU 向けに解決されるため）。巡回のあとに、配信を止めた起動（`make e2e-maintenance`）と索引させる設定の build（`make e2e-metadata`。公開面 —— `robots.txt` / `sitemap.xml` / canonical / OG 画像 —— の成立を見る）を別々に回す。比較とコメントを別ジョブに割る理由は VRT と同じ。**普通の PR では回さない**（上記「先送りにする検査」）。ただし器・土台の CSS・画面の宣言が動いた差分は、ラベル無しでも回る（同節の表）。回す事由があっても、差分が画面に届かなければ降りる |
| Baseline Approval | `baseline-approval.yaml` | `baseline-approval` | 基準画像が動いている PR で `baseline-approve` ラベルを要求する。ラベルの有無だけでなく、付いた時刻がポインタを動かした最後のコミットより後であることを見る（古い承認を新しい一式へ持ち越さない）。PR のレビュー承認を使わないのは、承認の対象が PR 全体ではなく基準画像であるため（[`vrt/README.md`](../../vrt/README.md)） |
| VisualRegressionTest | `vrt.yaml` | `vrt-scope` / `vrt-shard` / `vrt` / `vrt-comment` | Storybook を build し、digest 固定した Playwright コンテナで全 story を基準画像と比較する。差分のあった story を一覧表で PR へ報告し、画像は artifact（`vrt-diff`）で出す。全数実行では、基準画像と撮影対象が 1 対 1 で対応することも併せて検査する。省く判定は 2 層ある — PR の差分が絵に届かなければ CI の入口で丸ごと降り、届いても `make vrt` が絵を決める入力のハッシュを基準画像を撮った時点の値と突き合わせ、一致していれば比較を省く（[`vrt/README.md`](../../vrt/README.md)）。比較とコメントを別ジョブに割るのは、基準画像の置き場が非公開なら比較側が App の secret を持つため（secret を持つジョブにコメント本文を作らせない）。**撮影は `vrt-shard` が 4 台に割る** —— 費用が story 数に比例する一方、1 台の 4 コアは `playwright.config.ts` が既に埋めているため、実時間を縮める手は台数しかない。**必須 context は束ねる側の `vrt` で、matrix の側ではない** —— matrix は `vrt-shard (1)` のように 1 件ずつ報告し、必須 check はその名前を指定できない |
| Deferred Checks | `deferred-checks.yaml` | `deferred-checks` | 先送りにしている 3 本のうち、この PR の差分が要求するものを**名指しして**コメントを 1 件だけ残す。判定は 2 段で、**構造が先** —— どのパスがどのラベルを呼ぶかは [`recommend.ts`](../../scripts/deferred-checks/recommend.ts) が理由付きで宣言する（story が動けば axe、proxy や mock が動けばジャーニー、書体や寸法が動けば計測）。名指しできなければ [`volume.ts`](../../scripts/deferred-checks/volume.ts) の行数に落ち、線（`ALERT_AT`）を超えたときだけ 3 本を並べる。**ゲートではない。**必須 check にも登録しない —— 行数の線に理論的な根拠は無く、マージを止められる場所に根拠の無い数字を置かない。既に付いているラベルは**その検査だけ**落とす（1 枚付いたことで残る 2 本まで黙ると、付けた人が見なかった検査が名指しされないまま消える）。`lighthouse` / `e2e` が自分で回すと決めた差分では、その検査を勧めない。3 本がそれぞれ「回ったか」を自分のコメントで答えるのに対し、ここが答えるのは**「回すべきだったか」**である |

### 並列度に台数を書かない

`a11y` だけが `--workers=100%` を渡し、`vrt` は Playwright の既定（論理コア数の半分）に任せる。`a11y` は違反の有無を見るだけだが、VRT は画素を比較するので、並列度が撮影のタイミングに影響しうる。

どちらも**台数は書かない**。standard runner のコア数は public リポジトリで 4、private で 2 であり、作った側が受け取るのは後者。台数を書けばこのリポジトリの事情がそのまま作った側の既定になる。割合指定なら、その意思だけが渡ってコア数は実行環境が決める。

大きいランナーを使う作った側で調整したい場合の口は `VRT_ARGS` で、`make vrt` / `make a11y` の双方が受け取る（[`.makefiles/testing/vrt.mk`](../../.makefiles/testing/vrt.mk)）。

## ワークフロー一覧（Security）

多層防御（[0110](../../docs/adr/0110-security-operations.md)）。**週次スケジュール + 差分が届く PR** で走る。週次があるのは、
コードが 1 行も動いていない木に対しても CVE が公開されうるためで、変更を入口にした検査だけでは届かない。

**そして週次があるからこそ、PR 側は絞れる。** 各 job は `diff-scope` で「自分に届かない差分」を判定して降りる
（下記「`paths:` フィルタを使わない」）。降りた分の走査が消えるのではなく、**週次へ回る**というのが絞りの正確な意味で、
週次を止めればこの絞りは成立しなくなる。required status check には 1 つも登録していないため、降りても PR は止まらない。

| ワークフロー | ファイル | job 名 | 内容 |
| --- | --- | --- | --- |
| Secret Scan | `gitleaks.yaml` | `secret-scan` | PR が足したコミットを gitleaks で走査する。週次は履歴全体。検出は fail-closed |
| SAST | `sast.yaml` | `sast` | 自分が書いたコードを opengrep で見る。**0 件の baseline を保つ**ので検出で落ちる。許容する所見はソースの `// nosemgrep:` に理由付きで置く。**ルールはレジストリから引かず**、`opengrep/opengrep-rules` の commit を固定して読む（下記「SAST のルールをレジストリから引かない」） |
| CodeQL Scan | `codeql.yaml` | `codeql` | 同じ問いに GitHub 側の解析で答える。high の検出でマージを止めるのは code scanning 側の設定で、この job が落ちるのは解析そのものが走らなかったときだけ <!-- boilerplate-only:line --> |
| Dependency Scan | `dependency-scan.yaml` | `dependency-scan` / `dependency-audit` / `dependency-gate` | 依存の脆弱性を Trivy と `pnpm audit` で。同じ対象に 3 つの異なる判定を掛ける（下記） |
| OSV Scan | `osv-scan.yaml` | `osv-scan` / `osv-gate` | 同じ依存を OSV データベースで読む。報告と昇格ゲートの二段は Trivy と同じ形 |
| Dependency Review | `dependency-review.yaml` | `dependency-review` | **この PR が増やした依存**だけを見る。他の依存スキャナが見るのは木の現状で、持ち越しと増分を区別できない。**このリポジトリの運用にだけ置く**（呼ぶ API が無料なのは public のときだけで、private では Code Security のライセンスを要求するため） <!-- boilerplate-only:line --> |
| Bearer Scan | `bearer.yaml` | `bearer` | 値がプロセスの外へ出る地点を、その値の分類と併せて見る。**落とさない**（下記） |
| DevSkim Scan | `devskim.yaml` | `devskim` | 言語フロントエンドを持たない regex 検査。**構文木を組む検査が開かないファイル**を読む。**落とさない**（下記） |
| Tools Cooldown | `tools-cooldown.yaml` | `tools-cooldown` | `mise.toml` の pin が配布経路ごとの冷却期間を満たすかを、版の公開日時を上流から引いて見る。PR では**差分で動いた pin だけ**、週次は全 pin。公開日時を引けない backend は「違反なし」ではなく検査不成立として落ちる。免除は pin の直上のコメント（[`scripts/tools-cooldown/README.md`](../../scripts/tools-cooldown/README.md)） |
| OpenSSF Scorecard | `scorecard.yaml` | `scorecard` | リポジトリ自身の設定を測る。PR では走らない |
| SonarQube Cloud Scan | `sonarcloud.yaml` | `preflight` / `sonarcloud` / `report` / `unconfigured-notice` | **外部アカウントを要する唯一の検査。** `SONAR_TOKEN` が無ければ走らず、緑のまま「未設定」を PR へ述べる。剥がしの対象 <!-- boilerplate-only:line --> |
| DAST | `dast.yaml` | `dast` | **ここだけが応答を読む。** アプリを立てて OWASP ZAP で HTTP を撃ち、配信面を見る。既知の欠落は `.github/zap/rules.tsv` の一覧が持ち、**一覧に無い所見は赤にする** |

### 配信面の既知の欠落は「一覧」として持つ

`dast` は初日からゲートである。**ただし恒常的に赤い必須チェックは全 PR を止め、その一覧を縮める PR 自身も止める。** 壁が壁として機能するには通れる形が要る。

そこで、いま出ている所見だけを [`../zap/rules.tsv`](../zap/rules.tsv) に `IGNORE` で並べ、**一覧に無い所見は赤にする**。ZAP は `IGNORE` にした規則も件数・規則名・URL を出力に残すので、これは黙殺ではなく severity の引き下げにあたる（[0110](../../docs/adr/0110-security-operations.md) 3.4）。

各行に撤回条件が書いてある。条件が満たされた行は削除する —— 一覧が空になることが目標であって、一覧そのものは成果物ではない。CSP と同伴ヘッダ（[0111](../../docs/adr/0111-csp-security-headers.md)）は載っており、ZAP が読むのはそのヘッダである。ヘッダをブラウザが enforce した結果は `e2e` の見張りが見る。

**測る側を先に入れているのは、後入れだと測る側の導入が実装の完了に従属するため。** 実装が終わるまで計測が入らない形にすると、何が足りないかの一覧が最後まで手に入らない。

### 落とさない層がある

**すべての層をゲートにしていない。** ゲートにしてよいのは baseline を 0 件に保てる層か、「この変更が増やしたか」だけを問う層に限る（[0110](../../docs/adr/0110-security-operations.md) 3.2）。それ以外を赤にすると赤が常態になり、赤を見て手を止める習慣のほうが先に壊れる。

| 配線 | 該当 job | 何が赤にするか |
| --- | --- | --- |
| ゲート | `secret-scan` / `sast` / `dependency-audit` / `dependency-gate` / `osv-gate` / `dast` | job の exit code |
| ゲート | `dependency-review` | job の exit code <!-- boilerplate-only:line --> |
| 報告専用 | `dependency-scan` / `osv-scan` | 何も赤にしない（スキャナが走らなかったときだけ落ちる） |
| code scanning へ送る | `bearer` / `devskim` | **差分が新しく持ち込んだ alert** に対する GitHub 側のチェック |
| code scanning へ送る | `codeql` / `sonarcloud` | 同上 <!-- boilerplate-only:line --> |

**「落とさない」のは所見に対してだけで、機構が壊れたら落ちる。** `bearer` / `devskim` / `scorecard` は報告が出力のすべてなので、走らなかった走査・書かれなかった SARIF・届かなかったアップロードは、いずれも綺麗な結果と同じ緑になってしまう。**検査しない gate は「違反なし」と見分けが付かない**（下記「`paths:` フィルタを使わない」）。

3 つ目は「落とさない」と「見せない」を分けるための配線で、job は緑を返すが差分が持ち込んだ alert は PR を赤にする。

### 依存の脆弱性は、3 つの判定が同じ対象を見る

| job | 手段 | 落ちる条件 |
| --- | --- | --- |
| `dependency-scan` | `make trivy-fs` | **検出では落ちない。** スキャナが走らなかったときだけ落ちる |
| `dependency-audit` | `make audit` | 修正版のある `high` / `critical` が 1 件でもあれば落ちる |
| `dependency-gate` | `make trivy-fs-release` | 保護ブランチ宛 PR でだけ起動し、検出があれば落ちる |

**報告専用の job が要るのは、脆弱性が「変更の作者がその場で解消できない」うえ「変更と独立に状態が変わる」ため。**
それでゲートを組むと `--no-verify` と同じ経路を CI 側に作る。止める場所は昇格（保護ブランチ宛 PR）の一点で、
そこは誰かがリスクを引き受けて判断する場面である（[0110](../../docs/adr/0110-security-operations.md) 3.1）。

**Trivy と `pnpm audit` の件数は一致しない。突合して差分を潰そうとしない。** 集計単位（CVE / advisory）も参照する
DB も違うので、片方だけを正とするとそのツールが見ない領域が恒久的な死角になる。**和集合が正**で、どちらか一方でも
閾値に達したものを blocking として扱う。

`dependency-gate` が `branches:` フィルタではなく `if:` で降りるのは required check の都合による（下記「required status check」）。

## ワークフロー一覧（Components）

design system の部品（`src/components/**`）を対象にした検査。走るのは他の CI Checks と同じく**全 PR**で、
どちらも required status check に登録している。

| ワークフロー | ファイル | job 名 | 内容 |
| --- | --- | --- | --- |
| Component Classes | `component-classes.yaml` | `component-classes` | Tailwind が出力しない未定義 class を検出する |
| shadcn Drift | `shadcn-drift.yaml` | `shadcn-manifest` / `upstream` | 取り込み台帳と実体の乖離（`shadcn-manifest`）、および上流の更新（`upstream`）を検出する |

`upstream` はネットワークに出るため PR では降ろしており（`if:`）、週次スケジュールでだけ走る。**登録しない** —
上流が動いたという、PR の著者に直せない理由で作業を止めるため。

## ワークフロー一覧（イベント駆動）

PR ごとには走らず、ラベルや保護ブランチへの push で起動する。**required status check には登録しない**（起動しない PR では context が報告されないため）。

> **`workflow_run` で起動するものは、既定ブランチの定義で走る。** `baseline-retake` がこれに当たる。
> job は PR のブランチを checkout するので**コードは PR のもの**だが、**ワークフロー定義そのもの
> （`env:` や `uses:` を含む）は既定ブランチのもの**が使われる。PR のブランチで定義を直しても、
> その PR に対する実行には効かない — 既定ブランチへ入るまで反映されない。定義の修正が要る
> ときは、その PR とは別に既定ブランチへ入れる必要がある。

| ワークフロー | ファイル | job 名 | 内容 |
| --- | --- | --- | --- |
| Baseline Retake | `baseline-retake.yaml` | `retake` / `report` | VRT または E2E の**完了**で発火し、`baseline-retake` ラベルが付いていれば、**story と画面の基準画像をまとめて**撮り直し、置き場へ push してサブモジュールのポインタを進める。story も画面も**報告された差分だけ**が対象で、報告はそれぞれの実行の artifact（`vrt-report` / `e2e-report`）から引く。画面の報告が無いときは撮らない —— 全数へ落とすと、コメントが誰にも見せていない画素を正にしてしまう。両方が赤いときは E2E 側の実行が VRT 側へ譲る —— 片方だけでラベルを使い切らないためで、これが「1 ラベル 1 撮り直し」を保つ。ラベルはトリガではなく条件なので、PR 作成時に付けておける（VRT の完了を待つ必要がない）。**絵を動かしうるチェック**（`baseline-retake.yaml` の `DECIDES_PIXELS` が名指しする）が落ちている間は撮らずに見送り、ラベルを残す（次の実行で自動的に再開する）。見るのは各チェックの最新の試行だけで、名指しは allowlist である — 落ちているもの全部を数えると、撮るまで存在しない画像を待つ `baseline-approval` と互いに待ち合う。`revert-` で始まるブランチではラベル無しで全数を撮り直す（掃除で復帰先の一式が消えているため）。ポインタの push は `GITHUB_TOKEN` ではなく App のトークンで行う（`GITHUB_TOKEN` の push は実行を起こさないため、確認用の VRT が走らない）。**承認ではない** — 画素の判断は、コメントが並べる動いた画像の前後を見て PR レビューで行う |
| VRT Guard | `vrt-guard.yaml` | `guard` | 保護ブランチへの push 後に story の比較をやり直す。通常は鳴らない（PR はマージ結果に対して判定され、ブランチは最新であることを要求されるため）。鳴ったら前提が崩れた合図として issue を立てる。**基準画像は撮り直さない** |
| Lighthouse | `lighthouse.yaml` | `lighthouse` | 保護ブランチへの push と毎日 1 回、`e2e/lib/screens.ts` が宣言する画面を 1 枚ずつ Lighthouse で開き、LCP / CLS / TBT を `performance-budget.yaml` の上限と照らす（[0101](../../docs/adr/0101-performance-budget.md)）。落ちたら issue を立てる（ブランチごとに 1 本、2 度目は同じ issue へコメント）。**performance スコアは見ない** —— 5 指標の加重平均は、下がったときにどれが下がったかを答えられない。INP は実ユーザの操作を要して lab では測れないため TBT が代わる。撮影（`vrt` / `a11y` / `e2e`）と違ってブラウザをコンテナへ閉じ込めないのは、比べるのが画素ではなく数値だから —— 固定すべきはフォントのラスタライズではなくブラウザの版で、それは lockfile が担う。**PR でも起動はするが、測るのは差分が要求したときだけ** —— 画面の宣言か器が動いていれば待たずに測る。**この job が見るのは、自分で測ると決められる構造だけ**で、ラベルで回すべき差分の名指しは `Deferred Checks` が 3 本ぶんまとめて行う。ラベル（`run-lighthouse`）でも回る。**全量を PR で回さない理由は実測にある** —— 計測は直列でしか成立せず（同時に測ると並列度そのものが数値へ混ざる）、23 画面 × 3 試行 × 約 14 秒 ≒ 16 分に対し build は約 1 分。費用は `画面数 × 試行回数` に張り付いており、試行を削れば runner のぶれを吸う中央値を失い、画面を削れば宣言から全数を引く意味を失う。**削るなら網羅ではなく頻度**という判断で、払う代償は上記「先送りにする検査」と同じ、買うのは PR が 1 秒も待たないことである |
| Baseline Prune | `baseline-prune.yaml` | `report` | 月次で基準画像の置き場を測り、閾値を超えたときだけ掃除を促す issue を立てる。**消さない** — 履歴の書き換えは取り消せないので、実行は人が `make baseline-prune` で起こす |

## ワークフロー一覧（Documentation）

| ワークフロー | ファイル | job 名 | 内容 |
| --- | --- | --- | --- |
| Deploy Docs | `deploy-docs.yaml` | `docs-build` / `docs-deploy` | 生成 HTML のドキュメントサイトを組んで GitHub Pages へ配信する（[0141](../../docs/adr/0141-portal-operations.md)） |

サイトは**単一のツリーに複数の生成物を同居させる**形を採る。GitHub Pages はリポジトリに 1 サイトしか持てないため、Storybook・portal・coverage のような生成 HTML はそれぞれサイト直下の兄弟パスへ入り、ルートは入口へ転送するだけの薄い層（[`../../docs/index.html`](../../docs/index.html)）に留める。

| パス | 中身 |
| --- | --- |
| `/` | 入口（`/portal/`）への転送 |
| `/portal/` | docs portal（[0141](../../docs/adr/0141-portal-operations.md)）。`pnpm portal:build` の出力 |
| `/storybook/` | Storybook（`pnpm build-storybook` の出力） |
| `/<dir>/`, `/*.md` | `docs/` の内容そのまま。portal のカードが `../<dir>/<file>` で参照する |

`docs/` をサイトルートへ写すのは、走査で自動発見したドキュメントへの相対経路（`../<dir>/<file>`）を成立させるため。ここを削ると自動発見のカードが全て死にリンクになる。

配信の発火は `production` への push（＋任意 ref から回すための `workflow_dispatch`）。`paths:` フィルタは付けない — 理由は下記「`paths:` フィルタを使わない」と同じではなく、リリースが間接的な経路（token・依存更新・設定）で見た目を変えうるため、対象パスを予測して並べる保守コストのほうが高いという判断による。

この workflow 自身を編集する PR では、`build` だけが自己検査として走る（`deploy` は `pull_request` を除外している）。配信の壊れは、それを必要とするリリースまで気付けないため。この PR 用の実行は **required status check へ登録しない** — 当該ファイルに触れない PR では context が報告されず、必須待ちで止まる。

**GitHub Pages の有効化はユーザが Settings で実施する**（ワークフロー側で `actions/configure-pages` による自動有効化はしない）。有効化前に走った実行は deploy job で失敗する。

## required status check

[`../settings/branch-protection.json`](../settings/branch-protection.json) が **CI Checks 群を必須**にし、`strict` でブランチが最新であることを要求する。これは VRT が成立する条件でもある — 判定しているのは base へマージした結果の木（`refs/pull/N/merge`）なので、base が動いた後の緑をそのまま通すと、基準画像が「実際にマージされる木」とずれる。

**登録してよいのは、すべての PR でその名前を報告し続ける job だけ。**報告されない context を登録すると PR は永久に止まる（下記「`paths:` フィルタを使わない」）。`deploy-docs` の `docs-build` は `paths:` で自分自身の変更に絞ってあるため登録しない。

この条件は `make actions-required-check-lint` が機械検査する（`actions-lint` job と pre-commit が回す）。落ちる条件は `.makefiles/README.md` が持つ（[`.makefiles/README.md`](../../.makefiles/README.md)）。

`diff-scope` で降りる job は登録してよい。job 名も context の報告も変わらず、変わるのは中のステップが走るかどうかだけであるため（下記「`paths:` フィルタを使わない」）。

context 名は**ワークフロー名ではなく job 名**である点に注意。job の rename は required status check の設定を黙って無効化する。同じ理由で、**PR で報告されうる job には、別々のワークフローで同じ名前を置かない** — 報告される check run が 1 つの名前に 2 つ並び、必須がどちらを指すのか決まらなくなる。`deploy-docs` の job が `docs-build` / `docs-deploy` と配信先で名乗るのはこのため。

**PR に context を報告しない job はこの制約の外**にある。`notify-failure` / `notify-detection` はスケジュール実行でしか起動せず、10 本のワークフローで同じ名前を名乗る —— これは重複ではなく、**同じ役割に同じ名前が付いている**状態である。名前を workflow ごとに割ると、通知という 1 つの関心事が 10 個の別物に見える。`baseline-prune` / `baseline-retake` の `report` も同じ理由で並んでいる。

<!-- boilerplate-only:replace-begin -->
**作った側の初期化を生き延びないジョブ（`purge-verify` / `strip-verify`）も登録しない。** `strip-verify` は剥がしで自分ごと消え、消えた後は context を報告しない。`purge-verify` は残るが、破棄を済ませた作った側では「破棄済みなのでこのワークフローを消せ」と赤で止まる設計であり、指示どおり消せば同じく報告されなくなる。`branch-protection.json` は JSON でコメントを持てず削除のマーカーを置けないので、登録すると初期化を済ませた作った側のすべての PR が必須待ちで止まる。
<!-- boilerplate-only:replace-with -->
<!-- = **`purge-verify` は登録しない。** サンプルを破棄した後は「破棄済みなのでこのワークフローを消せ」と赤で止まる設計で、指示どおり消せば context を報告しなくなる。`branch-protection.json` は JSON でコメントを持てず削除のマーカーを置けないので、登録すると破棄を済ませた後のすべての PR が必須待ちで止まる。 -->
<!-- boilerplate-only:replace-end -->

## mise の導入

Node / pnpm などの供給は composite action [`../actions/setup-mise`](../actions/setup-mise/action.yaml) が行う。全ジョブが mise を必要とするため、**取得は必ずリトライを持ち、一度取ったものは再利用できなければならない** — 配信側の一時的な不調が、そのまま全ジョブの失敗になる位置にある。

この action が持つもの:

| | |
| --- | --- |
| リトライ | `curl --retry 5 --retry-all-errors`。取得はファイルへ落としてから検証する（パイプのままだと部分受信分がシェルへ流れ込む） |
| キャッシュ | 固定した版と digest をキーにバイナリを保持する |
| **digest の照合** | 復元・取得のどちらの経路でも、実行前に SHA256 を照合する。合わなければ捨てて取り直し、それでも合わなければ落とす |

**照合が要るのは、Actions のキャッシュが信頼境界ではないから。**キャッシュはブランチを跨いで共有され、push 権限があれば中身を差し替えられる。そこに置くのが実行可能バイナリなので、照合を挟まなければキャッシュ汚染がそのまま CI 内の任意コード実行になる。`uses:` を SHA で、container image を digest で固定しているのと同じ理由・同じ形。

### mise の版を上げる

1. 上流の `SHASUMS256.txt` から `mise-v<版>-linux-x64` の SHA256 を取る

   ```bash
   curl -sSL "https://github.com/jdx/mise/releases/download/v<版>/SHASUMS256.txt" | grep 'linux-x64$'
   ```

2. [`../actions/setup-mise/action.yaml`](../actions/setup-mise/action.yaml) の `MISE_VERSION` / `MISE_SHA256` と、キャッシュキーの版・digest 接頭辞を揃えて直す

## hooks mirror CI

`lint` / `md-lint` / `typecheck` / `actions-lint` / `actions-pin` / `images-pin` の 6 本は、[lefthook](../../.lefthook.yaml) が回すのと**同じコマンド**を実行する。`test` は二層実行で、pre-commit の `make test-cached` に対し、pre-push と CI は `make test-full` を実行する。hook は高速な第一段、CI は権威という二層（[0153](../../docs/adr/0153-ci-configuration.md) §4 / [0151](../../docs/adr/0151-git-hooks.md)）。

残りは片側にしか無い。**どちらが持つかは意図的な配置**であって、揃えるべき漏れではない。

| 検査 | 持っている側 | 理由 |
| --- | --- | --- |
| `build` / `smoke` | CI のみ | フルビルドは hook の速度目標（30 秒）に収まらない。収めようとすれば `--no-verify` の常用を招く |
| `bundle-budget` | CI のみ | 同上。しかも base ブランチの build も要るため、手元では 2 回分かかる |
| `lighthouse` | CI のみ | 同上に加えて、画面数 × 試行回数だけブラウザを回すため hook の速度目標から桁で外れる。**PR では走らない**（下の「イベント駆動」を参照）。手元の入口は `make lighthouse` |
| `dead-code` | CI のみ | 到達可能性はワークスペース全体を解決してから判定する。作業中のツリーでは書きかけの import が未使用として鳴り、hook で止めると押し切る癖が付く |
| `test` | pre-push + CI | pre-commit は開発中の反復を優先して cache を使い、push 前と CI は coverage を含む完全実行で gate を掛ける |
| `scripts-check` | pre-push + CI | `test` と同じ二層。job を `test` と分けるのは、`scripts/` に居るのが検査機構そのもので、壊れると「違反なし」を報告する向きに倒れるため。赤の意味を「機構が壊れた」と「アプリが退行した」で取り違えない |
| `purge-verify` | CI のみ | 破棄は取り消せないので、hook では走らせない。使い捨てチェックアウトを前提にした検査であり、手元のツリーで回すと作業中のサンプルが消える |
| `strip-verify` | CI のみ | 同上。手元のツリーで回すと boilerplate 限定の記述が剥がれ、剥がしの道具ごと消える <!-- boilerplate-only:line --> |
| `lockfile-drift` | CI のみ | install が追跡ファイルを書き換えたことは、手元では「自分が触った変更」と区別が付かない。第三者の目で見る CI が持つ |
| commitlint | hook のみ | コミット件名の検査。作り直しがコミット単位でしか効かず、PR 到達後に落としても直す手段が rebase になる |
| secret-scan | hook + CI | 同じ `make secret-scan` を呼ぶが、**走査範囲の決まり方が違う**。hook の既定は「どのリモートにも無いコミット」で、PR のブランチは既に push 済みなので CI では 0 件になる。CI は `SECRET_SCAN_LOG_OPTS` で base からの範囲を渡す。履歴全体は週次だけ（`make secret-scan-history`） |
| 依存の脆弱性 | CI のみ | 上記「依存の脆弱性は、3 つの判定が同じ対象を見る」と同じ理由で、hook に載せると `--no-verify` の常用を教える |
| `sast` | CI のみ | 走査に 1 分前後かかり hook の速度目標に収まらない。手元で確かめるなら `make sast` がそのまま同じ検査を回す |
| `sonarcloud` | CI のみ | 解析を実行するのは SonarCloud 側で、手元には結果を読む口しか無い。そもそも `SONAR_TOKEN` を開発者の環境へ配らない <!-- boilerplate-only:line --> |
| `dast` | CI のみ | build と起動を伴うので hook には収まらない。手元で確かめるなら `pnpm start` したものへ `DAST_TARGET=http://host.docker.internal:3000 make dast` を当てる |

## 共通の骨格

全ワークフローが以下を守る。逸脱する場合は ADR の改定が要る。ステップ構成の参照実装は `lint.yaml` で、各ステップが何のためにあるかのコメントもそこに置いてある。

- **actions の SHA ピン** — `uses: owner/repo@<40hex> # <tag>`。moving tag は禁止。**版の SSOT は末尾コメントの tag** であり、tag → SHA の対応は [`../actions-pin.toml`](../actions-pin.toml) が持つ。`make actions-pin-resolve` で解決、`make actions-pin-apply` で反映、`make actions-pin-check` で検査する（`actions-pin` job と pre-commit hook が回す。詳細は [`.makefiles/README.md`](../../.makefiles/README.md)）
- **最小 permissions** — トップレベルは `contents: read`。PR コメントを書く job だけが `pull-requests: write` を加算する
- **concurrency** — `${{ github.workflow }}-${{ github.ref }}` / `cancel-in-progress: true`。同一 PR への連続 push で古い実行を積まない。**配信系だけは例外**で、group に共有リソース名（`pages`）を置き `cancel-in-progress: false` とする（[0153](../../docs/adr/0153-ci-configuration.md) §3）。配信先は ref ごとに存在せず 1 つしかなく、走行中の deploy を切ると公開中のサイトが途中まで転送された成果物を配る。**保護ブランチの検査を積むために `false` へ倒すのも禁じる** — 古い木の結果が新しい木の結果を追い越して報告される。打ち切られた実行を失敗と読まないのは、条件式側（`!cancelled()`）の責任である
- **harden-runner** — 全 job 冒頭で外向き通信を**遮断**する（`block`）。許可した宛先の SSOT は [`../egress.yaml`](../egress.yaml) 1 枚で、`make egress-apply` が反映し `make egress-check` が差分で落とす（`actions-pin` と同形。composite action へ寄せられない理由は [0153](../../docs/adr/0153-ci-configuration.md) §3）。**宛先を足す根拠は実測**で、記録が揃っていないものは宣言で `audit` に留める
- **絵を動かしうる検査は撮り直しへ登録する** — 落ちたときに story の見た目が変わりうる job を足したら、[`baseline-retake.yaml`](baseline-retake.yaml) の `DECIDES_PIXELS` へその job 名を加える。**job を改名するときは新旧の両方を置く** — この配列を読むのは `workflow_run` で起動する撮り直し側であり、そこで使われるのは既定ブランチの定義である（上記）。改名した PR が既定ブランチへ入るまで、照合されるのは旧名のままになる。旧名は既定ブランチが追いついてから外す。該当する check run が無い名前は、単に一致しないだけで害を持たない。**書き漏らすと、壊れた木から撮った絵が基準画像になる**（allowlist なので、登録されていないものは黙って無視される）。逆に、落ちても絵が変わらない検査は入れない — 撮り直しが止まるだけで、止まった理由は撮り直しの側からは説明できない
- **版数の SSOT は `mise.toml`** — Node / pnpm / actionlint / shellcheck / zizmor の版はワークフロー側に書かない。[`../actions/setup-mise`](../actions/setup-mise/action.yaml) が `mise.toml` から供給する（[0003](../../docs/adr/0003-version-manager.md)）。`matrix` を**版や OS の掛け合わせには使わず**、`ubuntu-latest` 単一とする。仕事を割るための `matrix` は別で、費用が件数に比例し 1 台の並列度を使い切っている検査だけが使う。その場合も **required check にするのは束ねる側の単独 job**で、matrix の側ではない（[0153](../../docs/adr/0153-ci-configuration.md) §6）
- **例外は mise CLI 自身の版** — `mise.toml` は mise が解決する対象を宣言するもので、mise 自身の版を宣言できない。この 1 つだけは `setup-mise` の中に**版と SHA256 の対で**書かれている（[下記](#mise-の導入)）

## `paths:` フィルタを使わない

CI Checks のワークフローには `paths:` / `paths-ignore:` を付けない。

`paths:` で絞られたワークフローは、条件に合わない PR では**実行されず、status context も報告しない**。required check に指定した context が報告されないと、GitHub はその PR を「必須チェック待ち」のまま永久にブロックする。埋めるには、同名 job を即成功させる guard ワークフロー（`paths-ignore` に本体の `paths` を裏返しで書いたもの）を対で置くことになる。

本リポの CI Checks はどれも数分で終わり、実行コストよりも「本体と guard の 2 ファイルを常に裏返しの関係に保つ」保守コストのほうが高い。よってフィルタを付けず、全 PR で全 job を走らせる。

将来 `paths:` で絞りたくなるほど重い job（e2e 等）を足す場合は、**guard を対で用意するか、required check から外すか**のどちらかを必ず選ぶこと。片方だけを入れると即座にマージ不能になる。

**第 3 の道が [`../actions/diff-scope`](../actions/diff-scope/action.yaml)。** job は必ず起動して context を報告し、重いステップだけを `if:` で落とす。job 名が変わらないので required check も guard も触らずに済み、無関係な PR で消えるのは checkout と判定の数十秒だけになる。`bundle-budget` / `vrt` / `a11y` が使っている。

渡すのは「**自分に影響しえないもの**」の一覧であって、影響するものの一覧ではない。書き漏らしは無駄な 1 回で済むが、書き間違いは job が黙って何も検査しなくなる方向へ倒れる。**検査しない gate は「違反なし」と見分けが付かない**。判定の実装はこの action を共有し、job ごとに書き起こさないこと — 3 本に割れた判定は必ずずれ、ずれは黙って進む。

**一覧そのものは共有しない。**呼び出し側が書いた一覧だけが効き、action は既定値を持たない。`bundle-budget` が `*.css` / `tokens/*` / `.storybook/*` / `*.stories.tsx` / `*.test.ts` を外せるのは測るのが `.js` の量だけだからで、同じ行を `vrt` / `a11y` へ持ち込めば絵が変わる PR で検査が止まる。既定値を置けば、呼び出し側が一度も書いていない行が gate を黙らせうる — 一覧は「この job には届かない」という **job ごとの主張**であって、共有できる事実ではない。

| job | 外している範囲 |
| --- | --- |
| `bundle-budget` | ドキュメントと AI エージェント設定 + 絵にしか効かないもの（CSS / token / story / テスト） |
| `vrt` / `a11y` | ドキュメントと AI エージェント設定だけ |
| `sast` / `devskim` | ドキュメントと AI エージェント設定（+ SAST は `public/`） |
| `bearer` | 同上 + `src` の外にあるもの（カタログ / 基準画像 / 生成されるドキュメントサイト） |
| `dast` | 同上 + 配信される応答に現れないもの（story / テスト / CSS / token） |

### 依存スキャナだけは「影響しうるもの」の側を書く

`dependency-scan` / `dependency-audit` / `osv-scan` / `tools-cooldown` は `ignore:` ではなく **`only:`** を渡す。依存の脆弱性を決めているのは lockfile、pin の公開日時を決めているのは `mise.toml` であって、ソースをいくら動かしてもスキャナの答えは変わらない。「影響しえないもの」を列挙する側で書こうとすると、それは「lockfile 以外のすべて」になり、書ける形にならない。

**許可リストが許されるのはここだけで、条件が 2 つある。**

1. **job の対象がツリーそのものでないこと。** 依存スキャナが読むのは lockfile で、ソースはその入力ではない
2. **週次のスケジュールがツリー全体を走査していること。** 許可リストの書き漏らしは「1 週間は走らない」で済み、恒久の死角にはならない

条件 2 が無いと、書き漏らしがそのまま **「何も検査しない gate」** になる。`diff-scope` 側にも同じ注記を置いてある。

`dependency-gate` / `osv-gate`（昇格ゲート）は**降りない**。昇格は誰かがツリーの現状を引き受けて判断する場面であり、その PR の差分が lockfile に触れていないことは、ツリーが持っている脆弱性を引き受けない理由にならない。一方 `dependency-audit` は降りる —— base から引き継いだ判定は変更の作者がその場で解消できず、それを赤にするのは [0110](../../docs/adr/0110-security-operations.md) 3.1 が禁じている形そのものである。

`codeql` には掛けていない。code scanning の alert は「後の解析がもう報告しない」ことでしか閉じず、PR ごとに解析を省くと閉じる契機を落としうる。**GitHub 側の仕組みに judgement を預けている検査なので、こちらの都合で走行回数を減らさない。** <!-- boilerplate-only:line -->

**一覧の実体は各 workflow の `ignore:` ブロックが正**（[`bundle-budget.yaml`](bundle-budget.yaml) / [`vrt.yaml`](vrt.yaml) / [`a11y.yaml`](a11y.yaml)）。この表はどの範囲を外しているかを示すだけで、パスを書き写さない — 書き写せば実体と黙ってずれる側が 1 つ増える。

`vrt` / `a11y` はこの門の内側にもう 1 つ、絵を決める入力のハッシュで比較だけを省く判定を持つ。2 層がそれぞれ何を落とすかは [`../../vrt/README.md`](../../vrt/README.md) の「絵が変わり得ないときは撮らない」にまとめてある。

`paths:` を持つのは `deploy-docs` だけで、これは**後者（required check から外す）を選んでいる** — 走るのは自分自身を編集する PR だけなので、絞りを外すと全 PR で Pages 用のサイトを組み立てることになる。

`component-classes` / `shadcn-drift` は絞りを外して全 PR で走らせている。どちらも `pnpm install` とスクリプト 1 本で、`diff-scope` を噛ませていないのは、あの action が受け取るのが「**自分に影響しえないもの**」の一覧であるため — この 2 本が持つ狭い allow-list を裏返すと、書き間違いが「何も検査しない gate」の側へ倒れる。

## PR コメント（検査ログ: upsert-pr-comment）

coverage 以外の各 job は検査結果を即 fail させず、いったん capture して [`../actions/upsert-pr-comment`](../actions/upsert-pr-comment/action.yaml) で PR コメントを upsert し、最後に fail-closed で落とす。

- コメントは HTML マーカー（`<!-- lint-result -->` 等）で同定し、**同一 PR では増やさず更新する**。マーカーは job ごとに一意
- **緑のときはコメントを作らない。** 呼び出し側が `status:` に判定を渡し、`success` のときだけ新規作成を抑止する。すべての job が毎回コメントを残すと、PR の会話は 20 件を超える「PASS」で埋まり、その中に混ざった 1 件の FAIL が読み手に届かない。**通知の価値は件数ではなく信号対雑音比**で決まる
- **ただし抑止するのは「作ること」だけで、「更新すること」は抑止しない。** 既にコメントがあれば `success` でも上書きする。FAIL → PASS で直したときに古い FAIL が残るのを避けるためで、これは「緑のときは何もしない」では達成できない
- **REST を叩くジョブは App の installation token を使う。** `GITHUB_TOKEN` の上限は **1,000 req/h・リポジトリ単位**で、全ワークフローと開いている全 PR で共有する。installation token は 5,000 req/h。`baseline-retake` は VRT / E2E の完了ごとに発火して 1 回あたり約 10 回叩くため最初に枯れる側で、実際に `API rate limit exceeded for installation` で撮り直しが止まった。鋳造時の権限は**そのジョブの呼び出しが要るものだけ**を名指しする（push 用の鋳造は `setup-baselines` の側にあり、別の権限で別に取る）。**鋳造は落ちてよい**（`continue-on-error`）—— installation が許可していない権限を求めると 422 になり、そのままではジョブごと落ちる。避けようとした枠切れより悪い。落ちれば出力が空になり、呼び出しは `GITHUB_TOKEN` へ落ちて撮り直しは進む。App を登録していない作った側も同じ経路で動き続ける —— 枠が小さいだけである。**コメントを投稿するジョブはこの対象外**：長命の秘密鍵が本文を作るジョブへ入ることになり、下の「`secrets.*` を `env:` で渡さない」に反する。`a11y` / `e2e` が既にコメントを別ジョブへ割ってあるのはこの形で、issue を開く側だけがトークンを持つ。`lighthouse` は同じジョブで両方をやるため寄せられていない —— 寄せるならジョブを割る
- **本文ファイルが無いことは、投稿ステップの失敗ではなく job の打ち切りとして扱う。** 打ち切られた job は本文を書くステップまで到達しない。ここで失敗させると、結果が出ていないだけの実行で投稿ステップだけが赤くなる。**何も投稿せずに戻る** —— 打ち切られたことはチェック一覧が示しており、コメントはそれを言い換えるだけである。加えて費用の形が悪い：打ち切りは判定を持たないため `success` の抑止を通り抜けて必ず書き込みを起こし、それが出る状況（job の中断）は push が連続している状況と重なるので、**API の枠が一番苦しいときに消費が跳ねる**
- **`diff-scope` で降りたときは `status: success` を渡して更新する。**降りた job は緑を報告するので、投稿ごと落とすと前の push が出した FAIL コメントが緑チェックの隣に残り続ける。赤くした変更を base と同一内容へ戻す直し方（履歴を書き換えないこのリポジトリでは、これが正）で必ず踏む経路である。降りたことを述べる本文を書いて upsert すれば、コメントが無い PR には何も付かず、赤が残っている PR ではそれが置き換わる
- **報告専用のスキャナは、判定を「走ったか」ではなく「見つかったか」で渡す。** `dependency-scan` / `osv-scan` の job は検出で落ちない設計なので、`status` に job の成否をそのまま渡すと、脆弱性を見つけた実行が `success` としてコメントを抑止する。3 値（`success` / `findings` / `failure`）に割り、スキャナの exit code で区別する（`TRIVY_FS_DETECT_EXIT` / `OSV_DETECT_EXIT`）
- 投稿ステップは `continue-on-error: true`。fork からの PR はトークンが read-only で投稿できないが、それで検査の判定を落とさない
- **検査コマンドに `secrets.*` を `env:` で渡さない**。Actions のシークレットマスキングはランナーがログ表示用に捕捉する経路にしか効かず、`tee` でファイルへ落とした内容は素通りする。そのファイルがこのリポジトリ（public）の PR コメントへそのまま載る。`GITHUB_TOKEN` だけが例外（投稿そのものに要る短命トークン）。この規約は `make actions-comment-secret-lint` が機械検査するが、追えるのは `${{ }}` 式の直接参照までで、`needs.<job>.outputs` 経由の間接渡しは検査を通る — **規約が正であり、検査は退行ガード**。**もう 1 つの死角が `gh pr comment` を直接叩くジョブ**で、検査は `upsert-pr-comment` へ到達するジョブしか対象に取らない。`baseline-retake` の `retake` がそれに当たり、App トークンを持ちながら PR へ投稿する唯一のジョブなので、本文はすべてワークフローに書いたリテラルに保つ（ジョブ側にも同じことを書いてある）
- **既存コメントの同定は「bot 投稿者」と「マーカーで始まること」の両方を要求する**。public リポジトリでは第三者がマーカー入りのコメントを先に投稿でき、かつ全ワークフローが同じ bot で投稿するため、どちらか片方では同定にならない（別ワークフローのマーカーを検査ログへ出力させれば、そのワークフローを誤ったコメントへ誘導できる）。この前提として `github-token` には **bot として投稿するトークンを渡す** — 個人の PAT では投稿できても二度と更新できない
- **本文の折り畳みに使うフェンスは本文から決める**。検査ログには linter やコンパイラがソース行をそのまま出力するので、その中身は PR 提出者が制御できる。固定の 3 連バッククォートで囲むと本文自身がフェンスを閉じ、以降が生 Markdown としてレンダリングされる（mention による第三者への通知、偽の見出しやリンクが CI bot の名義で載る）。呼び出し側は自前でフェンスを組み立てず `details-summary` を使うこと（撤回条件 W18）
- **`title` と `details-summary` には静的リテラルだけを渡す**。無害化が効くのは本文（`body-file`）だけで、`title` は生 Markdown、`details-summary` は生 HTML としてフェンスの**外**に置かれる。ログの中身を要約して `title` に載せるような変更を入れると、フェンスで塞いだ注入が外側から復活する

カバレッジだけは、行単位の coverage と基準ブランチとの差分を構造化して報告する必要があるため、`test.yaml` の octocov が専用コメントを投稿する。**これは判定ではなく計測値なので、緑でも投稿し続ける** —— 上の「緑では作らない」が対象にしているのは「PASS」としか言わないコメントである。ただし**積み上げてはいけない**ので `.octocov.yaml` に `updatePrevious: true` を置いてある（既定は push のたびに新しいコメントを作る）。テストの失敗内容そのものは octocov ではなくこの upsert 基盤が投稿する —— octocov は coverage しか報告せず、どのテストが落ちたかを言わない。ほかの検査ログ（セキュリティスキャン結果 / 生成物 drift を含む）はこの composite action に乗せる。

## SAST のルールをレジストリから引かない

`make sast` が読むルールは、`opengrep/opengrep-rules` の **commit を固定**して取り出したものである。`--config p/javascript` のようなレジストリ参照は使わない。

**理由はライセンスにある。** `p/*` が返す集合（`semgrep/semgrep-rules`）は **Semgrep Rules License v1.0** で、OSI 承認ライセンスではない。

> You may use the rules only for your own internal business purposes.
> This license does not allow you to distribute the rules, or to make them available to others as a service.

エンジンに OSS fork の opengrep を採った判断は「作った側へライセンスの判断を渡さない」ことだった（[0110](../../docs/adr/0110-security-operations.md) 3）。**ルールをレジストリから引いている限り、その判断は成立しない** —— エンジンが LGPL でも、走らせているルールが内部利用限定なら、判断は層をずれて渡されているだけである。

| | 取得元 | ライセンス |
| --- | --- | --- |
| エンジン | mise が固定する opengrep | LGPL-2.1-or-later |
| ルール（レジストリ `p/*`、採らない） | 走査のたびに semgrep.dev | **Semgrep Rules License v1.0** |
| ルール（採用） | 固定した commit の `opengrep/opengrep-rules` | LGPL-2.1 + Commons Clause |

### 取り出し方は 3 つの制約で決まっている

**1. 検体を 1 つもディスクへ置かない。** 置き場はルールとほぼ同数の**検体**（意図的に脆弱なソース）を抱えており、`java/` `php/` には本物の webshell が含まれる。そのまま展開すると開発者のマシンとランナーへ置かれ、ウイルス対策が反応する。よって**言語で絞ったうえで、アーカイブから YAML だけを名指しで取り出す** —— 「全部展開してから消す」では同じ集合になっても途中でディスクへ出る。

**2. `audit` 分類を取らない。** `security/` を丸ごと採ると `audit` の所見で 0 件 baseline が保てない。レジストリの `p/javascript` も既定では含めていない分類で、**読んで判断するための所見**であってゲートに載る前提ではない。同じ規則を [`eslint.config.ts`](../../eslint.config.ts) の security でも落としており、理由も同じ。

**3. 照合はアーカイブではなく取り出したものに掛ける。** GitHub が自動生成する tarball はバイト単位で不変ではない（gzip の設定が変われば同じ commit でも digest が動く）。照合したいのは「走らせるルールが固定したものと同じか」であって包み方ではないので、**取り出した YAML の集合に対して digest を取る**。一致しなければ**何も置かずに**落ちる —— 置いてから照合すると、落ちた後のツリーに照合できなかったルールが残り、次の実行がそれを「固定済み」と読む。

実体は [`../../scripts/opengrep-rules/`](../../scripts/opengrep-rules/) で、固定値は [`../../opengrep-rules-pin.toml`](../../opengrep-rules-pin.toml) が持つ —— `.github/actions-pin.toml` / `docker/images-pin.toml` と同じ形である。**digest をソースへ書かないのは、人が写す工程を作らないため**で、`pnpm exec tsx scripts/opengrep-rules --resolve --commit <sha>` がロックファイルを書き直す。**rule id は置き場のパスを接頭辞に持つ**（`tmp.opengrep-rules.javascript.…`）ので、置き場を動かすと code scanning の既存 alert が一斉に別物になる。抑止（`// nosemgrep:`）は接頭辞なしの素の id で効く。

### 引き換えに失うもの

**ルール数が減る。** 固定した commit から取り出す集合は、レジストリの 3 パックより小さい。`p/owasp-top-ten` は複数言語を跨ぐパックで、その大半はこのリポジトリに対象が無いが、**それを差し引いても減っている**。

<!-- boilerplate-only:replace-begin -->
**ルールが更新されない。** `opengrep/opengrep-rules` はライセンス変更直前（2024-12-13）の fork で、上流の動きは鈍い。新しい規則は入ってこない。**この層の鮮度は CodeQL が補っている**（GitHub 側が更新し続ける）ため、SAST 全体が固まるわけではない。
<!-- boilerplate-only:replace-with -->
<!-- = **ルールが更新されない。** `opengrep/opengrep-rules` はライセンス変更直前（2024-12-13）の fork で、上流の動きは鈍い。新しい規則は入ってこない。**固定した commit を上げるまで、この層の鮮度は動かない。** -->
<!-- boilerplate-only:replace-end -->

この判断を見直すのは、レジストリのルールが OSI 承認ライセンスへ戻ったときか、固定先が更新を止めて**他の層でも補えない面**が実測で見つかったときである。**ルールが少ないこと・上流の更新が鈍いことだけでは条件にならない** —— 減ること自体は承知のうえで選んでおり、条件は「減った分がどこにも無い」と実測で言えることである。

## Related ADRs

The decisions the workflows here follow. **Comments in the workflow definitions do not cite an ADR
directly — they come here instead.** An ADR's number, section and owning record all move, while this
README moves with the workflows, so the movement never reaches the definitions
（[docs/rules.md](../../docs/rules.md)「コメントと文書」）。

- [0004](../../docs/adr/0004-library-management.md) — dependency update policy: majors go in their own PR
- [0011](../../docs/adr/0011-no-docker.md) — what the delivery boundary does and does not promise
- [0051](../../docs/adr/0051-styling-system.md) — the responsive bands the screen checks read
- [0054](../../docs/adr/0054-ui-catalog-storybook.md) — the catalogue the visual and a11y checks ride on
- [0072](../../docs/adr/0072-api-type-generation.md) — generated artefacts carry no findings of their own
- [0082](../../docs/adr/0082-client-observability.md) — which metrics are collected from real users
- [0090](../../docs/adr/0090-testing-strategy.md) / [0091](../../docs/adr/0091-test-verification-methods.md) — the framework split and what a real browser owns
- [0101](../../docs/adr/0101-performance-budget.md) — the budget and the metrics it is written against
- [0102](../../docs/adr/0102-browser-support.md) — the support matrix the checks are run against
- [0110](../../docs/adr/0110-security-operations.md) — scan thresholds, suppression format, fail-closed gates
- [0140](../../docs/adr/0140-documentation-operations.md) — what a document must carry
- [0141](../../docs/adr/0141-portal-operations.md) — what the documentation site publishes
- [0150](../../docs/adr/0150-git-workflow.md) — the branches an environment is deployed from
- [0153](../../docs/adr/0153-ci-configuration.md) — job partitioning, SHA pinning, secrets, the character set the public surface may carry
- [0155](../../docs/adr/0155-claude-skills-development.md) — shell as the exception to TypeScript
- [0157](../../docs/adr/0157-inspection-declaration-discipline.md) — report a gate as it reported itself; never through a filter that classifies by vocabulary
- [0160](../../docs/adr/0160-agent-environment-loop.md) — the re-measurement step and what the loop may read <!-- boilerplate-only:line -->

## 通知

**通知するのはスケジュール実行だけ。** PR ではどちらの出来事も既に作者へ届いている —— チェックが赤くなるか、PR コメントが所見を述べるかのどちらかである。そこで通知を足すのは、作者が今見ているものをチャットへ複製することにしかならない。週次の実行には作者が居ない。**誰も触っていないツリーに対して起きた出来事**こそ、リポジトリ側から押し出す価値がある。

宛先は reusable workflow [`notify.yaml`](notify.yaml) が持ち、2 つのモードで呼ぶ。

| モード | 呼ぶ側 | 何を伝えるか |
| --- | --- | --- |
| failure | 週次で走る全セキュリティ検査 | job が落ちた（または打ち切られた）こと。**走査の出力は載せない** —— 実行 URL だけを渡すので、秘密や脆弱性の詳細が通知先へ届く経路が無い |
| detection | `dependency-scan` / `osv-scan` | **落とさない設計の検査が何かを見つけた**こと。job は緑で終わるので failure では永久に発火しない |

detection は「何が見つかったか」を言えなければ、報告している出来事を特定できない。そこで本文を持つが、**載せるのは識別子だけ**とする（[`../actions/notify-detail`](../actions/notify-detail/action.yaml) が advisory 識別子の形をした文字列だけをログから抜く）。「先頭 N 行」のような規則にすると、いつかは値そのものを運ぶ。`secret-scan` に detection モードを与えていないのも同じ理由で、あちらのログに載りうるのは検出された秘密そのものである。

**打ち切り（`cancelled`）を失敗として数える。** 週次の実行が打ち切られるのは、通常は前の実行が残っているか runner が落ちたときで、いずれも「走らなかった」ことに変わりはない。緑と区別できないまま放置すると、走っていない週が積み上がる。

`SLACK_WEBHOOK_URL` が未設定なら配送を飛ばして緑のままにする。**webhook が無いことは検査の結果ではなく設定の欠落**であり、報告しようとした出来事のほうを隠してはいけない。送信先の差し替えは `notify.yaml` の後半 2 ステップと各呼び出し側の `secrets:` 行だけで済む（前半は transport 非依存）。

**これがリポジトリ唯一の `workflow_call`。** 他の共有物は composite action だが、composite action は呼び出し元の job の中で動くため、webhook が「たった今スキャンした依存ツリーを展開したランナー」に載る。`workflow_call` は必ず自前のランナーを取り、このファイルはリポジトリを checkout しない。

なお `make actions-comment-secret-lint` は、この呼び出しを**呼び出し先が投稿するかどうか**で判定する（`notify.yaml` は投稿しないので、呼び出し元は投稿ジョブにならない）。リモートの reusable workflow は解決できないため、従来どおり exit 2 で落ちる。
