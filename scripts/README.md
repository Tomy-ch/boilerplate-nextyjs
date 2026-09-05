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
アプリ本体と分けてある（[0090](../docs/adr/0090-testing-strategy.md)）。設定は
[`vitest.scripts.config.ts`](../vitest.scripts.config.ts)。

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

- 本物のマーカーを足した / 消した → `pnpm exec tsx scripts/marker-baseline --write` で引き直す
- マーカーの形を**指示ではなくデータ**として書いた → 引き直す前に除去側へリテラルとして宣言する

<!-- boilerplate-only:end -->

## 実行

| コマンド | いつ |
| --- | --- |
| `make scripts-test-cached` | pre-commit |
| `make scripts-test` | pre-push / CI（`scripts-check`）。カバレッジ 100% を課す |
