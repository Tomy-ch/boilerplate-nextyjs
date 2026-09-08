> このファイルは `SKILL.md`（canonical / 英語）の日本語参考訳です。スキルとしては読み込まれません（参考用）。

# Local Review

実装者とは**別モデル**で回す、ローカルの敵対的・低バイアスなコードレビュー。Copilot もクラウド `/code-review` も使わない。実装者自身のモデルには盲点があり、その盲点を別モデルで拾うのが本質。`/code-review` の finder → verify パターンを下敷きにしつつ、すべてローカルで完結させ、さらにモックのコンポーネントテストでは構造的に届かない **build + リクエストのランタイム検証** を足す。

対象は**変更そのもの**だけである。テストのレンズもコメントのレンズも持たず、他のスキルを呼ばない。

## 使うとき

- commit / PR 前に、実装者のモデル単独では出ないセカンドオピニオンが欲しいとき。
- 複数カーネルに跨る変更で、モックのコンポーネントテストは通るが RSC / Client 境界・`src/proxy.ts`・`adapters` のリクエスト経路が未検証のとき。
- バグ・認証/IDOR・レイヤ違反に絞った敵対的パスをかけたいとき。

以下には使わない:

- formatting / style — `pnpm fix` / `pnpm lint:ci`
- 静的な層境界の強制 — `pnpm lint:ci` が `eslint-plugin-boundaries`（ADR [0021](../../../docs/adr/0021-frontend-responsibility.md) Enforcement）と `pnpm check:architecture` を走らせており、import 方向は静的に**ゲートされている**。よって `architecture` レンズはその上に載る*意味的*なパスであり、マトリクスで表現できない違反（正当な import を通って型が漏れている / 責務が別カーネルに置かれている / 名目上だけ依存を反転させた抽象）に使う。ESLint が既に落とすものを再導出することに使わない。網羅的なレイヤ適合監査は専用の監査スキルの仕事だが、**それはまだ実体が無い**（BACKLOG GB-1）
- 修正の適用 — ソースに対して read-only。指摘するだけで、直すのはユーザー
- テスト（`/test-review`）やコメント在庫（`/comment-sweep`）の監査 — 対等な相方であって下位の手順ではない

## 中核アイデア — reviewer ≠ implementer

バイアス低減が設計上の制約であって、おまけではない。よって reviewer は **コードを書いた者とは別モデルの subagent** として動く:

- reviewer エージェント（`adversarial-reviewer` / `review-verifier`）は frontmatter で既定 **`sonnet`**。通常の Opus 実装者と異なる。
- **reviewer のモデルは Step 0 でユーザーが選ぶ。** 選択肢は `fable`（Fable 5）/ `sonnet` / `opus` / `haiku`、および *auto*（実装者と異なるモデルへ解決する既定）。選ばれたモデルは全 reviewer subagent へ `Agent` ツールの `model` 引数で渡す（この引数はエージェント定義の `sonnet` 既定より優先）— 深さなら `opus`、安価な発散なら `haiku`、独立した視点なら `fable`。
- **オーケストレーターは reviewer ≠ implementer を必ず保証する。** ユーザーが本セッションの実装者と同一モデルを選んだ場合、別モデルによるバイアス低減が損なわれる旨を警告し、続行前に確認する。黙って同一モデルにしない。
- reviewer subagent は **read-only**（エージェント定義に Edit/Write 権限なし）— finding を返すだけであり、このスキルはソースを一切書き換えない。何を直すかはレポートを読んだユーザーの判断である。

**このスキルは変更そのものだけを監査する。** テストのレンズもコメントのレンズも持たず、他のスキルを呼ばない。それらは `/test-review` と `/comment-sweep` の主題であり、`AGENTS.md` の Review Phase Protocol に従って、このスキルの傍らでそれぞれ独立に問われ実行される。次を呼びますかと差し出すレビュースキルは、3 つの主題を独立に答えられないものにし、入口の問いのずれが、そこを通った全ての流れから残り 2 つを黙って落とす。

## 優先順位 —— 所見は集めるだけでなく順位を持つ

レビュアーは食い違い、重なり、同じ事実を 2 つの語彙で報告する。順位が無ければ、報告は
「命名の些事が、境界の誤った側に置かれたカーネルより上に来る」平らな一覧になる —— finder が
それを "high" と呼んだ、というだけの理由で。Step 2 の表が持つ tier がその順位である。

| Tier | レンズ | 何を決めるか |
| --- | --- | --- |
| 1 | `architecture` | コードが**何であるべきか** |
| 2 | `security` / `correctness` | いま在る形が、動くかどうか |
| 3 | `runtime-gap` / `cohesion` | 実システムで保つか、そしてその単位を人が持ち続けられるか |

**上位の変更は下位へ伝播し、下位は原則として上位に作用しない。** 責務を別のカーネルへ移せば、
元の位置で検証された振る舞いは無効になる。1 ファイルを割るだけの seam が、その責務の移動を
正当化することはない。ここから 4 つの帰結が出る。**どれも提案ではなく規則である。**

1. **tier 順に並べ、tier 内で重大度順に並べる** —— 重大度だけで並べない。tier 3 の `high` は
   architecture の `medium` より下に来る。上位の所見が、下位の所見の対象コードごと消しうるため
2. **依存する上位の所見が未決の間、下位の所見は `保留` と印を付ける。** 報告はする。何を待って
   いるかを書く。着手可能なものとして提示しない。上位の決着後に見直すと、たいてい消えている
3. **2 つの tier が同じ事実を報告したら、上位の framing を残し、下位はその裏付けとして畳む** ——
   1 件であって 2 件ではない。1 つの事実に 2 行あると問題が 2 つあるように読め、変更の risk を
   二重に数える
4. **同 tier のレンズどうしの一致は確度を上げる。下位からの一致は上位の重大度を上げない。**
   tier 2 の 2 レンズが独立に同じ欠陥へ到達したなら強い証拠であり、そう書く。tier 3 が tier 1 に
   同意しても重大度は動かない（裏付けとして引くことはできる）

**例外は緊急度であり、それは気づく仕事であって解決する仕事ではない。** 下位の所見のほうが急ぐ
ことはある —— `runtime-gap` が炙り出した悪用可能な穴は、配置の議論を待たない。下位の所見が上位を
覆すほど critical に見えるときは、**黙って並べ替えず、両方を出して user に問え。** 順位は
「ふつうの食い違いを人手なしに解く」ために在る。順位を破る所見は、まさに人が見るべき場合である。

## Step 0 — スコープ確認

何より先に、この実行が越える境界を打刻する: `.agents/closed-loop/marks.sh reviewStartedAt`。 <!-- boilerplate-only:line -->

即座に `AskUserQuestion`。ベースは `commit` / `submit-pr` と同じ解き方で —— `gh pr view --json baseRefName -q .baseRefName`、PR が無ければ `make -s base-branch`。`gh repo view --json defaultBranchRef` は使わない（理由は `.makefiles/README.md` が持つ。この綴りで解くと diff がリリース 1 世代ぶん黙って広がる）。未マージのコミットがあれば「変更ファイルのみ」を既定、なければ作業ツリー / 指定パスを既定。

```text
質問: どの範囲をレビューしますか？
選択肢:
  - 変更ファイルのみ（ベースブランチとの diff）  ← 未マージのコミットがある場合の既定
  - 作業ツリーの未コミット変更（git status の差分）
  - 特定のパス/ファイルを指定
  - キャンセル
```

### reviewer モデル選択

同じ `AskUserQuestion` 呼び出しの中で（スコープと並ぶ 2 問目として）、reviewer subagent を回すモデルを尋ねる:

```text
質問: レビュアーをどのモデルで実行しますか？（バイアス低減のため 実装者 ≠ レビュアー を推奨）
選択肢:
  - 自動（実装者と異なるモデルを既定選択）  ← 既定
  - fable（Fable 5）
  - sonnet
  - opus（深掘り）
  - haiku（安価・高速な発散パス）
```

*auto* は、実装者が `sonnet` でなければエージェント定義の既定（`sonnet`）へ、`sonnet` なら別ティアへ解決する。ユーザーが実装者自身のモデルを選んだ場合は中核アイデアに従って警告し、続行前に確認する。選ばれたモデルは Step 2 / Step 3 の全 `adversarial-reviewer` / `review-verifier` の `Agent` 呼び出しへ `model` 引数で渡す。

**問いは 2 つで、それ以上は置かない。** テストの問いもコメントの問いもここには無い —— それらは `/test-review` と `/comment-sweep` の主題で、ユーザーが別に問う（中核アイデア「このスキルは変更そのものだけを監査する」）。

### フラグ

- `--no-comment` — Step 6 を抑止（PR へ投稿しない）。ローカルレポートのみを出す。**既定は opt-out**: 現ブランチに open な PR があれば、このフラグが無い限り Step 6 が残った finding をインラインレビューコメントとして投稿する。

## Step 1 — コンテキスト収集

- ベース ref を解決しレビュー対象を作る: `git diff <base>...HEAD`（未コミットなら `git diff`）+ 変更ファイル一覧（`git diff --name-only ...`）。
- どの**カーネル / element** が触られたか検出する。何が在るかは ADR [0027](../../../docs/adr/0027-directory-structure.md) の物理レイアウト、各々が何を import してよいかは ADR [0021](../../../docs/adr/0021-frontend-responsibility.md) の依存マトリクスが正: `src/app/**`（3 element — route-segment `page`/`layout` / route-handler `route.ts` / metadata）、`src/features/<name>/**`、`src/model/**`、`src/components/**`、`src/adapters/server/**`・`src/adapters/client/**`、`src/capabilities/**`、`src/stores/**`、`src/config/**`、`src/errors/**`、`src/logging/**`、`src/observability/**` — に加えて**カーネルの外側にある起動 / ビルド境界エントリ**: `src/proxy.ts`、`src/instrumentation.ts`、`next.config.ts`。いくつかのカーネルはまだディスク上に無い（ADR 0027 は対応決定が下りた時点で作成する）ので、全部揃っている前提を置かず実在するものを検出する。
- **リクエスト時の seam** が触られたか — Route Handler（`src/app/**/route.ts`）/ Server Action（`src/features/<name>/actions.ts`）/ `src/proxy.ts` / レスポンスヘッダ設定（`next.config.ts` の `headers()`）/ **layout shell・Provider 合成**（`src/app/**/layout.tsx` — ADR [0026](../../../docs/adr/0026-layout-shell-mount.md)。Provider の欠落は当該ルートが実際に描画されて初めて落ちる）。Step 4-2 を回すかの判定。 <!-- skill-lint-ignore -->
- **生成 API 成果物**（`**/gen/**` — ADR [0072](../../../docs/adr/0072-api-type-generation.md) の型 / zod スキーマ）が触られたか。再生成は全 consumer に波及するので、変更ファイルだけでなくそれを import する `adapters` 変換と feature までレビュー範囲を広げる。

## Step 2 — Finder の fan-out（別モデル、並列）

全 finder を並列起動（`Agent` 呼び出しを1メッセージにまとめる）。Step 0 でユーザーが選んだ reviewer モデルを全 `Agent` 呼び出しへ `model` 引数で渡す（*auto* がエージェント定義の既定へ解決する場合のみ省略可）。finder はすべて `adversarial-reviewer` — レンズごとに1体、`agentType: "adversarial-reviewer"`、`label` は `find:security` のように。

| Finder | エージェント | 起動条件 |
| --- | --- | --- |
| `correctness` | 2 | adversarial-reviewer | 常時 |
| `security` | 2 | adversarial-reviewer | 常時（Route Handler / Server Action / `src/proxy.ts` / auth / 生成 API のリクエスト・レスポンス型が触られた時は特に） |
| `architecture` | 1 | adversarial-reviewer | 常時 |
| `cohesion` | 3 | adversarial-reviewer | 常時 |
| `runtime-gap` | 3 | adversarial-reviewer | Route Handler / Server Action / `src/proxy.ts` / Provider マウント / 生成 API 成果物が触られた時 — モックのコンポーネントテストが通らない継ぎ目 |

**ここにテストやコメントを監査するレンズは無い**（中核アイデア「このスキルは変更そのものだけを監査する」）。未テストの変更やコメントの内容にレンズがついでに気づいたなら、補足の節に観察として書き、所管するスキル名を添える —— レンズを生やしてはならない。

各 `adversarial-reviewer` プロンプトに必ず含める: レンズ名 + その定義、ベース ref + 変更ファイル一覧 + diff、`AGENTS.md` / 該当 `README.md` / 根拠となる ADR へのポインタ。

**`cohesion` レンズの定義。** `architecture` が問うのは*どの層が持つか*、`cohesion` が問うのは*同じ関数やファイルに何種類の依頼が降ってくるか*である。両者は重ならず、その間に実際の隙間がある — ある単位が寸分違わず正しいカーネルに座り、`eslint-plugin-boundaries` も `pnpm check:architecture` も通ったうえで、エラー文言を直したい人にネットワークを叩くコードを読ませ続けることがある。ツールチェーンのどれもそれを見ておらず、きれいさ・保守性を実際に持っている `full-verify` の `impl-verifier` はリポジトリ全体の監査でしか走らない。このレンズが無いと、その指摘は「持ち込んだ diff」ではなく「いつかの監査」まで待つことになる。

好みに堕ちないための規律: すべての finding が **異なる 2 つの変更理由と、それぞれを誰が依頼するか**を名指しし、そのうえで継ぎ目を名指しする。そう書けない finding は落とす — 失敗する入力を示せない `correctness` の finding を落とすのと同じである。分割は無料ではなく、継ぎ目が 1 つ増えるたびに全体を見るために開くファイルが 1 つ増える。その代金を払うのが 2 つの理由である。長さそのものは finding にならない。

## Step 3 — 敵対的 verify

全 finding を集め、(file, line, claim) で **dedup**。2 つのレンズが同じ事実を報告したら両方を残さず、下位 tier の項を上位 tier の framing へ裏付けとして畳む —— 1 つの事実は 1 件のままにする。残った finding ごとに `review-verifier` subagent を1体（並列）起動し、単一 finding + ベース ref を渡す。`agentType: "review-verifier"`、`label` は `verify:<file>`、`model` は Step 0 でユーザーが選んだ reviewer モデル（reviewer ≠ implementer の規則は同じ）。

- **CONFIRMED** と **PLAUSIBLE** を残す。**REFUTED** は落とす（件数はレポート用に保持）。
- critical/high で単一判定が頼りないときは verifier を 2〜3 体立て多数決。重要な finding ほど単一意見より多様性。

## Step 4 — ランタイム検証（build + リクエスト）

subagent ではなく **オーケストレーター（メインセッション）** が行う（対話的 bash・実サーバープロセス・ユーザー確認が要るため）。Step 2 の `runtime-gap` レンズが *予測* したものを、実地で確証するか落とすかを決める場 — ただし本ステージが届く範囲に限る（4-2 の「本ステージが届かない範囲」を参照）。ゲートの異なる 2 段構成。

### 4-1 build 検証 — アプリコードが触られたら常時

ゲート: diff が `src/**` / `next.config.ts` / `src/proxy.ts` / `src/instrumentation.ts` に触れている。

`pnpm build` を実行する。これは遅い `pnpm lint:ci` / `pnpm typecheck` ではない。あちらはファイル単位であり、build が組み上げるモジュールグラフを構造的に見られない:

- **RSC / Client 境界違反** — `server-only` モジュールが client グラフから到達可能、server config を import するモジュールへの `"use client"`、`adapters/server` への client hook 混入（ADR [0024](../../../docs/adr/0024-adapters-server-client-split.md)）。
- **secret の client バンドル漏洩** — client 側の層から server config へ到達している。ADR [0030](../../../docs/adr/0030-environment-variable-management.md) が越境を許すのは `NEXT_PUBLIC_` リテラルのみで、違反が実体化するのはバンドルの中。
- **ビルド時 config 検証** — `next.config.ts` がスキーマを import して全量評価する（ADR 0030）ため、変数の欠落・不正はここで初めて落ちる。なお ADR 0030 の*もう一方*の検証点 `src/instrumentation.ts` の `register()` は**サーバ起動時**に 1 回走るものでビルド時には走らない。到達するのは Step 4-2 のみ。
- App Router 自身の生成型でしか出ない route / metadata の型エラー。

build 失敗は **それ自体が CONFIRMED な finding**。出力付きで報告する。ここで直さない（コードレンズは read-only）。

### 4-2 リクエスト検証 — リクエスト時 seam が触られた時のみ

ゲート: Step 1 が**リクエスト時の seam**の変更を検出している（一覧は Step 1 が持つ）。

1. 4-1 でビルドしたアプリを起動: `pnpm start --port <3000+N>`。並行 worktree のサーバーを叩いてしまわないよう、他と異なるポートを使う。バックグラウンドで走らせ、終わったら止める。
2. 対象パスへ `curl -i` し検証する:
   - 正常系のステータスとボディ形。
   - **生の上流ステータスを漏らしていないこと** — バックエンド障害は素通しの 4xx/5xx ではなく正規化された `errors` 分類として現れねばならない（ADR [0071](../../../docs/adr/0071-bff-api-integration.md)）。
   - 変更が生むはずのセキュリティヘッダ / CSP（ADR [0111](../../../docs/adr/0111-csp-security-headers.md) — 既定 seam は `next.config.ts` の `headers()`。nonce CSP は全経路を dynamic に倒すので、意図していなければそれ自体が finding）。
   - 変更が保護するつもりのパスについて、資格情報なしのリクエストが実際に拒否されること — ハンドラを読んで推測せず、証明する。
3. **`src/proxy.ts` の変更:** `matcher` が選ぶパスと除外するパスの両方を叩く。matcher の退行は単体テストにも build にも映らない（ADR [0043](../../../docs/adr/0043-middleware-policy.md)）。
4. **layout shell・Provider の変更:** 変更した layout の配下のルートを 1 つ要求し、描画されることを確認する。shell から落ちた Provider は hook から context を奪い、build 失敗ではなくランタイムエラーやエラーバウンダリとして現れる（ADR [0026](../../../docs/adr/0026-layout-shell-mount.md)）。

**本ステージが届かない範囲。** アサートするのは上記 4 点と matcher / shell の確認だけで、それ以外は見ない。`runtime-gap` レンズは本ステージが今日実行できないカテゴリを挙げうる — 主に**キャッシュ / 再検証**（ミューテーションが tag を無効化しない）と**リトライ / 冪等性 / breaker のセマンティクス**で、いずれも `adapters` 層とバックエンドを要し、ADR 0071 は具体形を実装 PR へ委ねている。これらの finding は 到達不能 として報告し、走らせていない検査を合格扱いにしない。

**本リポジトリにバックエンドは無い** — DB / 認証 / 業務ロジックは別サービスの責務（ADR [0011](../../../docs/adr/0011-no-docker.md) / [0070](../../../docs/adr/0070-backend-role-separation.md)）なので、スタブを構成しない限り Route Handler の上流呼び出しは失敗する。それは本ステージを飛ばす理由にならない。その*失敗*経路こそ ADR 0071 のエラー正規化が所有するものなので、そこをアサートする。バックエンド無しでは本当に到達できないもの（実際の成功レスポンス、別 subject への認可）は **Step 5 のレポートに 到達不能 と明記する**。決して模擬せず、合格として報告しない。

**破壊ガード:** Server Action は実バックエンドの状態を変えうる。対象に含まれ、実行が共有環境への書き込みになる場合は、事前にユーザーへ確認し（作業ツリーの外へ届く手順を持つスキルに ADR [0154](../../../docs/adr/0154-claude-skills-operations.md)「商用操作前のユーザ確認」が課す要件）復旧手段を述べる。

ランタイムで確証した不具合は CONFIRMED として build 出力 / curl 証拠付きでレポートに統合。

## Step 5 — レポート合成（日本語）

日本語のレポートを 1 つ出す:

```text
## ローカルレビュー結果（reviewer: <model> / implementer: <model>）

スコープ: <base>...HEAD（<N> files） / lens: correctness, security, architecture, cohesion, runtime-gap
未監査の観点: テスト（/test-review）・コメント（/comment-sweep）は本スキルの対象外
ランタイム検証: 4-1 build 実施 / 4-2 リクエスト検証 実施（curl）・対象外（リクエスト時 seam の変更なし）・到達不能（バックエンド不在で未検証の経路: <経路>）

### CONFIRMED（要対応）
- [重大度] タイトル — path:行
  - 問題 / 根拠 / 修正案
  - 検証: verifier 判定（+ 該当すれば build / curl 結果）

### PLAUSIBLE（要確認・判断保留）
- ...

### 補足
- REFUTED: <n> 件（finder が挙げたが verifier が否定）
- ランタイム検証でカバーした経路 / スキップした経路
- 他スキルが所管する観点として気づいた点（あれば。所管スキル名を添える）
```

`lens:` 行には実際に走ったレンズだけを並べる。

**`未監査の観点:` 行は必須**であり、定型文ではない。このスキルが監査するのは 3 つのレビュー主題のうち 1 つだけで、残り 2 つについて何も言わないレポートは、それらを回していない読み手には全体レビューとして読める。テストとコメントをここでは見ていないことを平明に述べ、`lens:` 行に現れなかったという事実からの推測にしない。推奨の形に和らげないこと —— 残り 2 つを回すかは Review Phase Protocol の下でユーザーが決めることであり、この行が記録するのはこの実行が覆わなかった範囲だけである。

tier 順に、tier 内で重大度順、CONFIRMED を PLAUSIBLE より先に —— 重大度だけで並べない。未決の上位所見に待たされている所見は `保留` と印を付け、何を待っているかを書く。ランタイムで何を検査し何をスキップしたかは必ず明記する（黙って省くと「全部見た」と誤読される）。

## Step 6 — finding を PR インラインコメントとして投稿（既定。`--no-comment` で opt out）

既定では、残った **CONFIRMED + PLAUSIBLE** の finding を、現ブランチの PR へ **インラインレビューコメント**として投稿する — 1 つの巨大コメントではなく、finding ごとに 1 件、その `path:line` へアンカーする。**REFUTED は決して投稿しない。** Step 5 のローカルレポートはいずれにせよ出力する。本ステップは追加分。

投稿するのはこのスキル自身の finding だけである —— `/test-review` と `/comment-sweep` はそれぞれ自分の出力を持つ（中核アイデア「このスキルは変更そのものだけを監査する」）。

以下の場合は本ステップを丸ごとスキップ:

- `--no-comment` 付きで起動された、または
- 現ブランチに open な PR が無い（`gh pr view` が何も返さない）— ローカルレポートのみとし、必要なら PR 作成を提案する。

GitHub への投稿は外向きの操作なので、投稿前に **1 度だけ** 確認する — 件数と対象 PR を示す（`AskUserQuestion`: 「<N> 件の指摘を PR #<番号> にインラインコメントとして投稿しますか？」/「投稿する」「投稿しない（ローカルレポートのみ）」）。

**投稿前に伏せ字化する。** 本リポジトリは public であり、`security` の finding は指摘対象そのもの — 漏れたトークン、ハードコードされた認証情報、PII の実例 — を引用する。それをそのまま投稿すると、取り消せない場所へ秘密を再公開することになる。payload を組む前に、各 finding 本文を「証拠を再現する」形から「証拠を説明する」形へ書き換える: 秘密らしき具体値は `***REDACTED***` に置換し、代わりに `path:line` を示す。伏せ字化すると意味を失う finding（値そのものが指摘である場合）はローカルレポート限りとし、投稿せずサマリでその旨を述べる。

**`gh api` はこの呼び出しに使える。** `.claude/settings.json` は `Bash(gh api *)` を allow し、コミット済みの作業を失う形だけを deny している — `DELETE` を含むもの、および ref 操作（`git/refs`。その `force` 更新は API 側の force push にあたる）。レビュー投稿はどちらでもないので実行される。これらの deny はスキル実行中も有効なので、必要な呼び出しがブロックされたらその事実を提示しユーザーに判断させる。ブロックされたリクエストを `python3` / `pnpm exec tsx` など許可済みインタプリタ経由で送り直さない（ガードを満たすのではなく無効化する行為）。`permissions.deny` を自分で編集して解除することも決してしない。

権限層がこれを安全にしているのではない — パターン規則は助言的レビューと破壊的書き込みを区別できない。効いている統制は上の 1 度の確認なので、「コマンドが許可されているから」を理由にそれを省かない。

**API 呼び出しが失敗した場合のフォールバック:** `gh pr comment` でサマリコメントを 1 件投稿する — 真の行アンカーの代わりに `path:line` 参照付きでファイルごとにまとめる — そして Step 5 のレポートに「インラインではなくサマリにまとめた」ことを明記する。

### 手順

1. PR 番号・リポジトリ・コメントのアンカー先コミットを解決する:

   ```sh
   gh pr view --json number,url -q '.number'        # PR 番号
   gh repo view --json nameWithOwner -q '.nameWithOwner'
   git rev-parse HEAD                                # アンカー SHA
   git rev-parse @{u}                                # push 済み head — HEAD と異なれば警告
   ```

   アンカーコミットは PR へ push 済みのコミットでなければならない。ローカル `HEAD` ≠ `@{u}` なら先に push するようユーザーへ警告する（PR 上に無い `commit_id` のコメントは API が拒否する）。

2. どの finding をインラインにできるか判定する。GitHub のインラインコメントは PR diff に存在する行しか対象にできない。diff ハンクを解析する（`gh pr diff <PR> --patch` または `git diff <base>...HEAD`）:
   - 追加行/文脈行のハンク内の `(path, line)` → インラインコメント、`side: "RIGHT"`。
   - 削除行の `(path, line)` → インラインコメント、`side: "LEFT"`。
   - diff 外（reviewer が未変更の文脈を参照した）→ インライン **不可**。レビューサマリの `body` へ畳み込む。

3. 1 つの review を組み立て、全コメントをまとめて投稿する（N 件の単独コメントではなく、単一の review として）:

   ```sh
   gh api --method POST repos/<owner>/<repo>/pulls/<PR>/reviews --input payload.json
   ```

   `payload.json`: <!-- skill-lint-ignore -->

   ```json
   {
     "commit_id": "<SHA>",
     "event": "COMMENT",
     "body": "🔎 impl-review (reviewer: <model>) — CONFIRMED <n> / PLAUSIBLE <m>\n\ndiff 外で行アンカー不可の指摘:\n- <path>: <要約>",
     "comments": [
       {
         "path": "<file>",
         "line": "<行番号>",
         "side": "RIGHT",
         "body": "🔎 [CONFIRMED · high] <問題の要約>\n\n根拠: <...>\n修正案: <...>\n検証: <verifier 判定>"
       }
     ]
   }
   ```

   `event: "COMMENT"` を使う — これは助言的なレビューであり、`REQUEST_CHANGES` / `APPROVE` は使わない。人間のレビューと区別できるよう、各コメント本文の先頭に `🔎 impl-review`（または `🔎 [判定 · 重大度]` タグ）を付ける。

4. 頑健性: API がバッチを拒否したら（422 — diff に無い行）、該当コメントをサマリ `body` へ移して再試行する。事後に、何をインライン投稿し何をサマリへ回したかを報告する — finding を黙って落とさない。

## やる / やらない

- ✅ reviewer モデル ≠ implementer モデルを保証（Step 0 でユーザーが選択。実装者のモデルを選んだら警告 + 確認）。
- ✅ finder は並列（1メッセージ・複数 `Agent` 呼び出し）。すべて `adversarial-reviewer` で、レンズごとに 1 体。
- ✅ レポート前に全 finding を独立 verify、REFUTED は落とす。
- ✅ アプリコードが触られたら `pnpm build`（Step 4-1）、リクエスト時 seam が触られたらリクエスト検証（Step 4-2）。
- ✅ 生成成果物が変更されたら、それを import する全 consumer まで *finder* の読解範囲（Step 1）を広げる — Step 4 は広げない。届く経路を検証するだけ。
- ✅ バックエンド不在で塞がっている経路は 到達不能 と明言する — 模擬しない、合格と呼ばない。
- ✅ 共有バックエンドの状態を変える Server Action の実行は事前にユーザー確認。
- ✅ どのレポートでも `未監査の観点:` 行に、テストとコメント在庫をここでは監査していないと明記。
- ✅ 既定で CONFIRMED + PLAUSIBLE を PR へインラインレビューコメントとして投稿（Step 6）。`--no-comment` または open な PR が無い場合は抑止。
- ✅ PR 投稿（外向き操作）の前に 1 度だけ確認。各コメントは `path:line` へアンカーし、diff 外の finding はレビューサマリへ畳む。
- ✅ 投稿前に各 finding 本文から秘密らしき具体値を伏せ字化する — 本リポジトリは public で、投稿は取り消せない。
- ❌ `gh api` が許可されているからと Step 6 の確認を省く — 安全性を担保しているのは権限規則ではなく確認のほう。
- ❌ deny されたコマンドを許可済みインタプリタ経由で送り直す / `permissions.deny` を編集して解除する — ブロックを提示し、サマリコメントのフォールバックを提案すること。
- ✅ どのレンズが動かなかったか・なぜかをレポートに明記。
- ❌ REFUTED を投稿する / `REQUEST_CHANGES` / `APPROVE` を使う — 投稿するレビューは助言的な `COMMENT` のみ。
- ❌ ソースを一切書き換える — レンズは指摘までで、直すのはユーザー。
- ❌ テストやコメントを監査するレンズを生やす / ここから `/test-review` や `/comment-sweep` を呼ぶ。Review Phase Protocol の下では対等な相方であり、気づいたことは補足に観察として書き、所管スキル名を添える。
- ❌ reviewer を implementer と同一モデルで回す。
- ❌ 思いつきの style nit を finding として出す / 網羅に見せるための水増し。
- ❌ verify 中に生成ファイルや deny リスト対象を編集する。

## チェックリスト

- [ ] `AskUserQuestion` でスコープ確認、ベース ref 解決。
- [ ] Step 0 で reviewer モデルを選択し、implementer と異なることを確認（同一なら警告 + 確認）。
- [ ] finder を並列 fan-out: レンズごとに `adversarial-reviewer` 1 体。テストのレンズもコメントのレンズも無い。
- [ ] この実行から他のスキルを呼んでいない。
- [ ] 全 finding を独立 verify、REFUTED は除外（件数は保持）。
- [ ] アプリコードが触られたら Step 4-1 `pnpm build` 実施、リクエスト時 seam が触られたら Step 4-2 curl 実施。到達不能な経路は明記済み、状態を変える Server Action は事前確認済み。
- [ ] 委譲したときは Step 6 を実行（`scope` / `mode`（`apply` は渡さない）/ `base_ref` / `hold` / `claimed` を渡す）。
- [ ] 1つの日本語レポート: CONFIRMED → PLAUSIBLE、ランタイムのカバー範囲を明記、`未監査の観点:` 行が存在。
- [ ] `--no-comment` / PR 無しでない限り: 1 度確認のうえコードレンズの CONFIRMED + PLAUSIBLE をインライン PR コメントとして投稿（diff 外はサマリ本文へ）。REFUTED は除外、`event: COMMENT`。
