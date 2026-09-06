# Pre-commit / Pre-push hook 運用方針

本プロジェクトでは、ローカル開発における自動検査の枠組みとして **lefthook** を採用する。
hook の役割は「壊れた状態を CI に到達させない第一段の防御」とし、CI を権威ある最終ガードとする二重化構造を取る。

## Status

Accepted

> 本 ADR は 0.0.x の living document。設計フェーズ中は本文を直接上書きし、逐次改定の履歴は残さない(不可変化 + 改定履歴の規律は v1 凍結時から。[0140](0140-documentation-operations.md))。

## 採用理由 / 目的

- ローカルで lint / format / 型エラーを早期検出し、CI 失敗による待ち時間を削減する
- 「commit / push してから気づく」を構造的に減らす
- 設定ファイル (`.lefthook.yaml`) で hook の挙動を SSOT 化し、`.git/hooks/` への直接書き込みや個別 shell スクリプトの散在を避ける
- boilerplate として fork 先が「最初から品質ゲートが動く」状態を引き継げるようにする

## 採用ツール

[lefthook](https://github.com/evilmartians/lefthook) を採用する。

インストールは npm devDependency 経由 (`pnpm add -D lefthook`)。バージョンは exact pin とする (0004 のコア dev ツール扱い)。

### lefthook を選んだ理由

| 観点 | lefthook | husky |
| --- | --- | --- |
| 設定 | YAML 1 ファイル | shell script ファイル群 |
| 並列実行 | `parallel: true` で標準対応 | 自前で実装 |
| 配布 | npm package 内に単一バイナリ同梱 | node スクリプト |
| 起動コスト | Go 実装で高速 | shell + node |

設定の集約と起動コストの観点で lefthook を採る。`.git/hooks/` への symlink 配置は `pnpm exec lefthook install` で行い、配置自体も再現可能にする。

## hook 段階の責務分担

| 段階 | 目的 | 想定処理 | 速度目標 |
| --- | --- | --- | --- |
| pre-commit | 「壊れた diff を commit に乗せない」 | `pnpm lint:ci` (biome 完全版 = `biome.ci.jsonc` + `--error-on-warnings`。ESLint 導入後は境界検査も直列 — [0002](0002-formatter-linter.md)) / Markdown 検査 (`pnpm md-lint` = markdownlint + mermaid 構文 + `.claude/**` の意味検査 (`skill-lint`)。対象ファイルが staged のときのみ) / ワークフロー検査 (`make actionlint` = 構文 + `run:` のシェル / `make actions-shellcheck` = composite action の `run:` のシェル / `make actions-pin-check` = `uses:` の SHA ピン / `make actions-comment-secret-lint` = PR コメントを投稿するジョブへの secret 混入。ワークフロー / composite action の定義が staged のときのみ — [0153](0153-ci-configuration.md)) | < 5 秒 |
| commit-msg | 「規約外のコミットメッセージを積ませない」 | commitlint ([0150](0150-git-workflow.md) の prefix 11 種を検証) | < 5 秒 |
| pre-push | 「壊れた push・秘密を含む push を上げない」 | 型チェック (`pnpm typecheck` = `tsc --noEmit`) / 秘密スキャン (`make secret-scan` = push 予定コミット範囲) / テスト (整備後) | < 30 秒 |
| post-checkout / post-merge | 「基準画像の実体を、指し先から取り残さない」 | サブモジュールの同期 (`make baseline-sync`)。移動と pull のたび | < 1 秒 |
| (CI) | 権威ある検査 | lint / 型 / test / build / e2e 等 | 制約なし |

- pre-commit で走らせる biome は、エディタ保存時の簡易版ではなく **完全版** (`pnpm lint:ci`)。保存時は軽量・commit 時は厳格という二段構え（プロファイル分割の詳細は [0002-formatter-linter.md](0002-formatter-linter.md)）
- biome は Rust 実装で高速なため、完全版（`noImportCycles` の複数ファイル走査を含む）でも本リポジトリ規模では sub-second に収まり、速度目標を満たす
- pre-push の commands は `parallel: true` で並列実行する。秘密スキャンは型チェックと独立しており、直列化すると速度目標を割るため
- **飽和したホストでは、CI が同じコマンドを持つゲートを CI へ委ねる**。`make load-status` が帯を出し、pre-push の各 command は `gate-*` ターゲット越しに走る(実体は `scripts/load-band/`)。委ねるのは型チェックとテストで、秘密スキャンは帯に関わらず必ず走る(push は不可逆で、CI に対応ワークフローが無い)
  - **帯は実測の使用率(load average / CPU 数)で決める**。飽和したホストではゲートの**失敗自体が信用できなくなる**ため — カバレッジの中間ファイルの取り合いのように、変更とは無関係な理由で落ちる経路が開く。信用できない判定を出すより、権威である CI へ渡すほうが速く、答えも正しい
  - 帯を作業ツリーの数で決めない。放置された古い窓が数に入り、実際には空いているホストを飽和と誤判定する。窓数は **1 窓あたりの CPU 配分**(`LOAD_CPU_SHARE`)の算出にだけ使う
  - **委ねた事実と根拠は必ず出力する**。黙って飛ばすと「検査したつもり」が残る
  - **設定はどの環境でも同一**である。並列数の低い環境や単独の作業ツリーでは帯が `full` に解決され、すべてのゲートが手元で走る。この機構が適応させるのは挙動だけで、設定へ特定の作業環境の事情を焼き込まない
- **秘密スキャンを pre-push に置く理由**は、秘密が push された時点で「リモートに残る」不可逆な事故になるためである。**この段階でしか「送られるコミット範囲」が確定しない**点も pre-push を選ぶ根拠になる。commit 段階では、その commit が最終的に push されるか・後続 commit で消されるかがまだ決まらない（走査対象の決め方そのものは [0110](0110-security-operations.md) が正）
- **依存脆弱性スキャン (`make trivy-fs`) は hook に接続しない**。hook に載せてよいのは「当事者がその場で解消でき、かつ変更と共に結果が決まる」検査に限られる。依存の脆弱性はどちらも満たさない（上流待ちで解消できず、CVE の公開だけで結果が変わる）ため、報告は PR コメント・ブロックは昇格ゲートが持つ（判断の全文は [0110](0110-security-operations.md) 3.1）
- 速度目標は**定常状態の実測**で判断する。各ツールのコールドスタートは初回に限って目標を超えるが、これを理由に目標を緩めない

### 設計原則

- **post-checkout / post-merge は検査ではない。** 壊れを止めるのではなく、git が動かさない実体をブランチの記録へ合わせるだけである。落ちる余地を持たせない —— 取り込んでいない作業ツリーでは何もせず、撮影の前提検査が名指しで案内する側に任せる
- **pre-commit は速さ優先**。重い処理 (テスト全件 / `pnpm build` / e2e) は入れない
- **pre-push は中速まで許容**。push の機会は commit より少ないため
- **CI が権威**。hook は「早く気づく」ための補助層であり、hook 通過 = 正しい状態ではない
- **重複は意図的**。hook と CI で同じ lint を走らせる二重化は冗長ではなく仕様

### なぜ pre-commit に build を入れないか

Next.js の build (`pnpm build`) はキャッシュが効いても数秒〜数十秒かかる。commit のたびにこれを走らせると hook が「邪魔」となり、`--no-verify` の常用を誘発する。build 相当の最終検査は CI に委ねる。

### ESLint 境界検査の pre-commit 組込みと速度目標

[0002](0002-formatter-linter.md) の「biome 優先 + ESLint 補完」方針に基づき、ESLint の層境界検査は導入後 `pnpm lint:ci` の一部として **pre-commit に glob スコープで組み込む**（変更ファイルに関係する層のみを対象にし、リポジトリ全体走査を避ける）。ただし ESLint（TS resolver を伴う boundaries 検査）を加えた結果 pre-commit の速度目標（< 5 秒）を超える場合は、ESLint 実行のみを **pre-push 側へ退避してよい**。これは commands 粒度の調整であり本 ADR の改訂を要しない（後述「改変ルール」）。なお速度目標そのものの引き上げは ADR 改訂を要する。

## bypass ポリシー

### 通常運用

- `git commit --no-verify` / `git push --no-verify` の **常用は禁止**
- やむを得ず bypass した場合は、**直後に同等の検査を手動で実行** する (`pnpm lint:ci` / `pnpm typecheck`)

### 例外: 関連コミットの分割時

1 PR に複数の論理変更を分けて積む過程で「ロジック未完了の中間 commit を一時的に乗せたい」場合は、各個別 commit で `--no-verify` を使ってよい。

ただし以下を守る:

- PR 内のすべての commit を積み終わった時点で、**必ず 1 回 hook 相当の検査をローカルで通す** (`pnpm lint:ci && pnpm typecheck`)
- 「途中の commit が壊れていてもよい」のはあくまでローカル中間状態。push の時点では pre-push が動くため、最終的に検査される

### 禁止される bypass

- ❌ `--no-verify` を shell alias / git alias / IDE デフォルトに組み込むこと
- ❌ CI で hook 相当の検査をスキップすること (CI は権威であり、bypass されてはならない)
- ❌ `.lefthook.yaml` の commands を一時的にコメントアウトして commit すること

## CI との関係

| 役割 | hook | CI |
| --- | --- | --- |
| 失敗時の挙動 | ローカルで止まる | PR が merge できない |
| 権威性 | 補助 | 権威 |
| 設定の所在 | `.lefthook.yaml` | `.github/workflows/` |
| skip 可否 | bypass 可 (例外運用のみ) | bypass 不可 |

- hook と CI で **同じコマンド** (例: `pnpm lint:ci`) を呼ぶ。ローカル ↔ CI で振る舞いを揃える
- hook がローカルでスキップされても CI が拾うため、最終的な品質ガードは CI 側に依拠する
- hook が「うざくて誰も使わない」状態は CI 単独運用と同義であり、避けるべき。本 ADR の速度目標を守ること

## インストールと初期化

```bash
pnpm install                  # devDependency として lefthook が入る
pnpm exec lefthook install    # .git/hooks/ に symlink を配置
```

`postinstall` で `lefthook install` を自動実行する選択肢もあるが、CI ビルド時に不要な hook 配置を避けるため、本リポジトリでは **明示的に `lefthook install` を呼ぶ** 設計とする。README に手順を記載すること。

## 設定の最小構成

**`.lefthook.yaml` が唯一の正**。本 ADR は骨格 (どの段に、いくつの、どういう名前の command を置くか) だけを定め、各 command が実際に実行するコマンド行は転記しない。転記は写しがずれる場所を増やすだけで、hook の挙動を知りたい者は必ず `.lefthook.yaml` を読む。

```yaml
pre-commit:
  parallel: true
  commands:
    lint: ...
    md-lint: ...
    actionlint: ...
    actions-shellcheck: ...
    actions-pin-check: ...
    actions-comment-secret-lint: ...
commit-msg:
  commands:
    commitlint: ...
pre-push:
  parallel: true
  commands:
    typecheck: ...
    secret-scan: ...
```

- 各段の責務と、そこで走らせる検査は上の「hook 段階の責務分担」表が定める
- **1 command = 1 つの関心**。1 つの `run:` に複数の検査をつなげず、command を分けて名前で識別できるようにする (失敗時にどの検査が落ちたか lefthook の出力で分かる)
- pre-commit は `parallel: true`。command 間に順序依存を作らない
- **全 command を素で書く**。`mise exec --` での包み込みは [0003](0003-version-manager.md) で全面禁止しており、hook も例外にしない。ツールは activate 済みの PATH から解決する前提とし、`❌ <tool> が PATH にありません` で落ちた場合は hook の書き方ではなく環境を直す (`make install-tools` + activate)

### 改変ルール

具体的な commands の追加・更新は本 ADR の改訂を伴わずに行ってよい (粒度的な調整であり、方針そのものではないため)。ただし以下の改変は **ADR 改訂を要する** :

- 段階責務 (pre-commit / commit-msg / pre-push) の再定義
- bypass ポリシーの緩和
- lefthook 以外のツールへの移行
- 速度目標 (pre-commit < 5 秒、pre-push < 30 秒) の引き上げ

## 禁止事項

- ❌ pre-commit に重い処理 (`pnpm build` / e2e / 全テスト) を入れること
- ❌ `--no-verify` を git alias / shell alias / IDE 設定で恒常化すること
- ❌ CI 側で hook 相当の検査をスキップすること
- ❌ `.git/hooks/` 配下に直接 shell script を書き込むこと (lefthook 経由のみ)
- ❌ hook 設定 (どの段階でどの command を走らせるか) を `.lefthook.yaml` 以外のファイル (script / Makefile 等) に分散させること。`run:` から `pnpm <script>` / `make <target>` のような既存の実行入口を 1 行で呼ぶのは分散にあたらない (ローカルと CI で同じコマンドを呼ぶための要件でもある)
- ❌ lefthook 自体のバージョンを caret (`^`) で指定すること (0004 のコア dev ツール方針に従い exact pin)

## 補足

- 「hook はあると邪魔、ないと事故」のジレンマを、**速い hook + 権威ある CI** の二重化で解く方針
- lefthook 設定の具体内容 (どの段階でどの command を走らせるか) はリポジトリの肥大化に応じて調整する
- hook の存在は README で利用者向けに案内する (`pnpm exec lefthook install` の必要性)
- 旧運用との差分: 過去は `.git/hooks/` に shell script を直接置く時期もあり得たが、本 ADR 採用以降は lefthook 経由でのみ管理する

## 関連 ADR

- [0002-formatter-linter.md](0002-formatter-linter.md) — `pnpm lint:ci` で呼ばれる biome 完全版 (`biome.ci.jsonc`) と簡易版のプロファイル分割
- [0004-library-management.md](0004-library-management.md) — lefthook を devDependency として exact pin する根拠
- [0110-security-operations.md](0110-security-operations.md) — pre-push で走る秘密スキャンの内容、および脆弱性スキャンを hook に載せない判断
- [0150-git-workflow.md](0150-git-workflow.md) — hook 通過後の commit / PR / リリース運用フロー
