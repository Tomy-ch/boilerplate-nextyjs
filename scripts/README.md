---
test-requirement: unit
coverage-exclusions:
  - "scripts/*/index.ts"
  - "scripts/lighthouse/diagnose.ts"
  - "scripts/openapi/check-generated.ts"
  - "scripts/openapi/extract-limits.ts"
  - "scripts/openapi/fetch-api.ts"
  - "scripts/openapi/gen-api.ts"
  - "scripts/portal/build-site.ts"
  - "scripts/portal/gen-*.ts"
  - "scripts/setup/*/index.ts"
  - "scripts/setup/lib/runtime.ts"
---

# scripts

リポジトリを検査・生成・操作する道具を置く。アプリの振る舞いではないので、suite も CI のジョブも
アプリ本体と分けてある。設定は [`vitest.scripts.config.ts`](../vitest.scripts.config.ts)。

## 負う観点

**`unit`。**値を渡して答えを確かめる。ここに居るのは lint とゲートそのもので、壊れると「違反なし」を
報告する向きに倒れる。だから見るのは分岐が実行されたかではなく、**その分岐に固有の結果が出ているか**
である（[testing-conventions](../docs/testing-conventions.md)）。カバレッジは 100% を課しているので、
数字の側は情報を持たない。

外から来る文書を読むモジュール（Playwright のレポート、`git` の出力、レジストリの応答）は、**形が
崩れた入力を観点に含める。**0 件へ縮退させると「失敗なし」と読めてしまう。

**パスを接頭辞で判定する関数は、接頭辞だけ一致する隣を観点に含める。**`a/b` の内側かを
`startsWith("a/b")` で見ると `a/bc` も内側になる。区切りまで見る実装は正しく書かれていることが
多いが、**無関係なパスを渡すテストではその区切りを 1 度も踏まない**ので、区切りを落としても緑の
ままになる。ここで扱うパスは削除・除外・突き合わせの対象なので、誤判定は消してはいけないものを
消す向きにも、消すべきものを見逃す向きにも倒れる。

**隣を渡すだけでは、先頭の固定（`^`）までは踏めない。**`a/bc` は `a/b` で始まってはいるが、
`a/b` を**内側に**は含まない。先頭の固定を落とした実装を捕まえるのは、接頭辞そのものが文字列の
途中に現れる入力（`xa/b`）である。隣と埋め込みは別の変異を殺すので、両方を観点に持つ。

**組んだ文字列が GitHub 上で公開に読まれるモジュールは、無害化を観点に含める。** issue の本文や
PR のコメントへ載る文字列は、このリポジトリが書いていない散文（抑止の理由、道具の出力）を含む。
生の連結で組むと、mention や偽のリンクが CI の名義で公開の面に載る。該当するモジュールは
[`lib/issue-body.ts`](lib/issue-body.ts) のような共有の窓口を通し、**このリポジトリが書いていない
散文を注入しても記法として解釈されない**ケースを 1 つ持つ。判定の基準は「その文字列の読み手が
GitHub 上の公開の面か」であって、モジュールの置き場ではない。

## 検査から外すもの

宣言は [`lib/untested-modules.ts`](lib/untested-modules.ts) が持ち、カバレッジの母数と 1:1 ゲートが
同じ配列を読む。入口ファイル・契約からの生成物・判定を持たないモジュールの 3 つで、それぞれ理由と
撤去条件を添えてある。**外すのは検査が意味を持たないものだけ**で、「いまは書けていない」は理由に
ならない。

<!-- boilerplate-only:begin -->
## 撤去マーカーを足したら数え直す

`sample` / `boilerplate-only` の撤去マーカーは、**発火してほしい本物**と、**規約を説明するための
例示**とが同じ形をしている。位置でも構文でも区別は付かないので、除去側は「例示だ」という宣言
（`setup/remove-sample/sample-manifest.ts` の `MARKER_LITERAL_FILES` と、走査から外す接頭辞）を持つ。
宣言を忘れたときに起きることは 2 通りで、対応の取れないマーカーなら除去が中断して声が出るが、
**閉じたペアを散文が持っていると、その区間は例外を出さずに消える**。空になったコードフェンスは
有効な Markdown のままなので、撤去後のツリーを lint しても鳴らない。

そこで [`marker-baseline/`](marker-baseline/) がファイルごとのマーカー行数を
[`baseline.json`](marker-baseline/baseline.json) に固定し、[`marker-baseline/scan.test.ts`](marker-baseline/scan.test.ts)
が実ツリーと突き合わせる。マーカーを足した / 消した瞬間にしかこの数は動かないので、区間の中の散文を
直しても差分は出ない。数が動いたら、そこが判断の場になる。

同じ入口が**表として成立していない行**も見る。Markdown の表は表の行でない行に出会った時点で終わる
ので、コメント**行**を表の途中へ置くと、それ以降の行が表から落ちて生のパイプを含む段落になる。
行内で完結する `:line` はセルに納まるので安全だが、`begin` / `end` / `replace-*` は行を占めるため
表を割る。**表は 1 行 1 実体にし、消える実体は自分の行を持って `:line` で落とす。**

部分置換のために `replace` で 1 行を囲むと、変えたいのが数文字でも行が丸ごと退避側へ複製される。
退避側は誰も読まないコメントなので、先に腐るのは必ずそちらである。こちらは行数と違って基準値を
持たない —— 0 件が唯一の合格で、数えて固定する対象ではない。

- 本物のマーカーを足した / 消した → `pnpm exec tsx scripts/marker-baseline --write` で引き直す
- マーカーの形を**指示ではなくデータ**として書いた → 引き直す前に除去側へリテラルとして宣言する

<!-- boilerplate-only:end -->

## 実行

| コマンド | いつ |
| --- | --- |
| `make scripts-test-cached` | pre-commit |
| `make scripts-test` | pre-push / CI（`scripts-check`）。カバレッジ 100% を課す |

## 関連する ADR

ここに居る道具が自分の運用で従う決定と、ゲートが `src/` に代わって強制している決定。

- [0010](../docs/adr/0010-standards-and-non-lockin.md) — 送り先を特定の SaaS へ縛らない書き出し
- [0011](../docs/adr/0011-no-docker.md) — container image の参照を持つ面の責務線
- [0021](../docs/adr/0021-frontend-responsibility.md) — 層 README の frontmatter と依存の突合
- [0024](../docs/adr/0024-adapters-server-client-split.md) — server 専用を綴りではなく置き場で表す
- [0027](../docs/adr/0027-directory-structure.md) — 生成物の配置と、規約上の配置を指す表記
- [0028](../docs/adr/0028-naming-convention.md) — 生成対象の名前
- [0029](../docs/adr/0029-type-design-discipline.md) — client へ届くスキーマの入口
- [0030](../docs/adr/0030-environment-variable-management.md) — `process` の直読と server 番人の位置
- [0043](../docs/adr/0043-middleware-policy.md) — 起動 / 境界エントリの分類
- [0054](../docs/adr/0054-ui-catalog-storybook.md) — カタログ専用の差し替え
- [0071](../docs/adr/0071-bff-api-integration.md) — build が要る取得先と、生成 client を使わない判断
- [0072](../docs/adr/0072-api-type-generation.md) — 生成物へ検査を課さない判断
- [0090](../docs/adr/0090-testing-strategy.md) — 層別責務表 / 1:1 対応 / 除外の規律
- [0091](../docs/adr/0091-test-verification-methods.md) — 実ブラウザが負う観点と、単体で回せない範囲
- [0101](../docs/adr/0101-performance-budget.md) — 予算の割り方と、測る指標
- [0102](../docs/adr/0102-browser-support.md) — 数える対象を決める browserslist
- [0110](../docs/adr/0110-security-operations.md) — 監査の閾値 / 抑止の撤回条件 / SAST のルール集合
- [0112](../docs/adr/0112-data-classification-cache-boundary.md) — 取得の口が綴る分類
- [0141](../docs/adr/0141-portal-operations.md) — portal の URL と差し替えマーカーの族
- [0150](../docs/adr/0150-git-workflow.md) — ブランチ命名 / 昇格の連なり / 版の出所
- [0151](../docs/adr/0151-git-hooks.md) — ローカルゲートの帯と bypass の可否
- [0152](../docs/adr/0152-agents-md-policy.md) — boilerplate-only マーカーを独立させる理由 <!-- boilerplate-only:line -->
- [0153](../docs/adr/0153-ci-configuration.md) — job の分割 / SHA ピン / 公開の面へ出す文字集合
