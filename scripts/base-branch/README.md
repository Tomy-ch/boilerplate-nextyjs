# base-branch

フィーチャーブランチの分岐元 —— 最新のリリースライン（`release/vX.Y.Z`）—— のブランチ名を 1 行で出す。
`make base-branch` の実体。

## 出所は origin の実状態だけ

答えは `git ls-remote --heads origin 'refs/heads/release/*'` から作り、**ローカルの参照は読まない。**
分岐元を答えられそうな参照は他にもあるが、どれも警告を出さずに古い答えを返す。

- `refs/remotes/origin/HEAD` は clone 時に一度決まったきりで、`git fetch` では更新されない（更新には
  `git remote set-head` が要る）。エージェントの harness が提示する "Main branch" もこの参照を読んでいる
- GitHub のデフォルトブランチは張り替えられて初めて動く設定で、最新のリリースラインと一致している保証が無い
- 手元の `release/*` は、取り込んでいなければ無い

origin を直接読むので、これらが陳腐化していても答えは変わらない。git はホストの認証情報を使うため、
ホストで実行する（`scripts/release` と同じ扱い）。

## 「最新」は版の数値比較

`major` / `minor` / `patch` を数として比べる。判定は [`../semver/latest.ts`](../semver/latest.ts) と共有し、
リリースラインを切る側（`scripts/release`）が次の版を決める基準と揃える —— 作る側と解決する側で「最新」が
食い違わない。

- **コミット日時では選ばない。** 古いラインへの hotfix や base の取り込みで、日時の並びは版の並びと食い違う
- **文字列順でも選ばない。** `v1.10.0` が `v1.9.0` より前に並ぶ

## 1 本も無ければ失敗する

`release/vX.Y.Z` の形のブランチが origin に 1 本も無ければ exit 1 で止まり、空文字を出さない。取得自体は
成功しうる（まだ切っていない、参照の書式が変わった）ので、空を「最新」として返すと、呼び出し側は解決できな
かったことに気付かないまま空のベースで進む。

対象は `release/*` だけで、`hotfix/*` は候補にしない。解決しているのは「feature / bugfix は最新の
`release/*` から切る」規則であり、hotfix の分岐元は人がその場で決める。

## 実行

| コマンド | いつ |
| --- | --- |
| `make base-branch` | ブランチを切るとき、PR の base を決めるとき。`BASE=$(make -s base-branch)` で受ける |
| `pnpm exec tsx scripts/base-branch` | 同じ。引数は取らない |

PR が既にあるなら、その `baseRefName` が正で、こちらは PR が無いときの答えである。

## 構成

| ファイル | 役割 |
| --- | --- |
| [`index.ts`](index.ts) | 入口。git を呼び、答えを 1 行出す |
| [`resolve.ts`](resolve.ts) | 判定。`ls-remote` の出力から最新のリリースラインを選ぶ |

## 関連する ADR

- [0150](../../docs/adr/0150-git-workflow.md) — feature / bugfix の分岐元は最新の `release/vX.Y.Z`
- [0157](../../docs/adr/0157-inspection-declaration-discipline.md) — 解決できない状態を空の答えへ倒さない
- [0159](../../docs/adr/0159-script-structure.md) — 入口と判定の分離
