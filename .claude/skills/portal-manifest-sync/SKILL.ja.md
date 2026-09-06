> このファイルは `SKILL.md`（canonical / 英語）の日本語参考訳です。直接編集せず、更新は `SKILL.md` 側から流してください。スキルとしては読み込まれません（参考用）。

# Portal Manifest Sync

このスキルは、ドキュメントポータルの構造の単一ソースである
[`docs/portal/manifest.yaml`](../../../docs/portal/manifest.yaml)（[ADR 0141](../../../docs/adr/0141-portal-operations.md)）を、
ディスク上の実在する README と、それを読む生成スクリプトの双方に突き合わせて監査します。

このスキルの日本語参考訳は同じディレクトリの `SKILL.ja.md` にあります（スキルとしては読み込まれません。参考用）。

## 使うとき

- portal のビルドが `manifest が指す src が見つかりません` で落ちた —— README が移動または削除された
- manifest へ追加したのに、サイドバーの想定した位置に出てこない
- portal が公開して**いない** README を、キュレーション判断の材料として知りたい（一括追加のためではない）
- リリース前に、現在の木から portal が組み上がることを確認したい
- 定期的な棚卸しとして

## このスキルを使わないこと

- **portal の生成そのもの** —— `pnpm portal:site`（配信するのと同じ木を手元で見るなら `pnpm portal:preview`）
- **未登録 README の一括追加。** manifest はキュレーション済みの手引きであり、追加は人がファイル単位で下す編集判断です
- **README の内容の書き換え** —— README ↔ ディスクの drift は `sync-readme` が持ちます
- **単一 README の深堀** —— 1 ファイルのフルスコアカードは `readme-review` が出します
- **欠けている対訳の作成** —— ペアの所管は `canonicalize-doc` です

## 前提

### 1. manifest は手引きであって辞書ではない

portal は人間が読むキュレーション済みの叙述です。未登録の README は **drift ではなく**、キュレーション
判断待ちの候補です（ADR 0141）。一括追加はキュレーションを壊し、概念の流れを部品単位のノイズで埋めます。

### 2. 答えの一部は既に 2 つの生成スクリプトが持っている

それらが検査していることを再実装しないでください。実行して、出力を読みます。

| コマンド | 何を決めるか |
| --- | --- |
| `pnpm portal:guides` | 各 `src` を `dst` へ複製する。`src` が無い / `dst` が `docs/portal/guides/` の外を指す / `src` がリポジトリの外を指す とき**非 0 で止まる** |
| `pnpm portal:docs` | `docs/portal/docs.json` を組む。`meta.groups` に無い section、実在しない `meta.subgroups` の guide id、実在しない `meta.reference_links` の section id、section 内の重複パスに対して `⚠` 行を出す |

いずれも書き込み先は追跡外のパス（`docs/portal/guides/` と `docs/portal/docs.json`）だけなので、
実行しても後始末の要る差分は残りません。

### 3. 生成スクリプトが拾わないものが、このスキルの仕事

- **`Other` へ落ちる登録。** section が `meta.subgroups` を持つとき、どの subgroup の items にも無い
  guide id は自動生成の `Other` へ掃き寄せられます。警告は出ません。`subgroups` を伴わずに `layers` へ
  足したエントリは、生きてはいるが誤った場所に置かれています
- **部品リファレンス README。** 1 つの component の表面を書いたもので、portal の答えはそれではなく
  Storybook（既に `meta.reference_links` の常設項目）と component 自身の TSDoc です。これを全部候補として
  並べるとレポートが読めなくなります
- **キュレーション候補。** 残りを `readme-review` の基準で分類したもの

### 4. 判定基準は `readme-review` にある

manual-worthy の定義を**ここへ複製しないこと**。実行時に
[`.claude/skills/readme-review/SKILL.md`](../readme-review/SKILL.md) を読み、その Step 2（positive /
negative の基準と 4 クラスの閾値）と、`src/features/` 配下なら Step 2b の必須節検査を適用します。
基準が変われば向こう 1 つを直すだけで、このスキルは自動的に追随します。

## Step 0. モードを確認する

他の何かを読む前に `AskUserQuestion` を呼びます。

- 「manifest 同期のモードを選んでください」
  - 「検出 + 適用（差分を提示して、承認後に manifest.yaml を更新）」
  - 「検出のみ（dry-run、書き込みなし）」
  - 「キャンセル」

引数の `--dry-run` は 2 番目の推奨であって、確認の代わりにはなりません。

## Step 1. 生成スクリプトを回す

```bash
pnpm portal:guides
pnpm portal:docs
```

`portal:guides` が非 0 で止まったら、そこに並んだ `src` の一覧が **stale の集合そのもの**です。Step 5 へ
持っていき、stale 検出のためのディスク突合は省きます。成功したなら stale はありません。

`portal:docs` が出した `⚠` 行をすべて集めます。1 行 1 件の確定した構造の所見なので、言い換えずそのまま
報告します。

## Step 2. どの警告も見ていない配置を検査する

manifest を読みます。`meta.subgroups` に登録のある section ごとに、

1. その section に登録された `dst` の guide id を取る —— basename から `.md`（または `.ja.md`）を落とした
   もので、`scripts/portal/docs-json.ts` と同じ規則
2. その section の subgroups の `items` を合併する
3. (1) にあって (2) に無い guide id をすべて報告する。それらは `Other` へ落ちる

併せて、manifest の各 section キーが `meta.groups[].sections` のちょうど 1 つに現れること、
`meta.section_titles` の各キーが実在する section を指していることを確認します。前者は `portal:docs` が
警告しますが、後者は無言で、何にも付かない見出しが残ります。

## Step 3. ディスクを列挙する

```bash
git ls-files '*README*.md'
```

`find` ではなく `git ls-files` を使うのは、除外リストを二重に持たずに ignore 済み・未追跡のものを外す
ためです。結果から次を落とします。

- `docs/**` —— `docs/<dir>/` 直下は `scripts/portal/gen-docs-json.ts` の FS スキャンが発見するので、
  既に portal に載っています。登録すると二重に公開されます
- `.claude/**` —— エージェントの設定であって portal の内容ではありません

残りが候補の母集団です。登録済みの `src` 集合を引くと、未キュレーションの集合になります。

## Step 4. 未キュレーション集合を絞り、分類する

順に適用します。以下の「形」は変わりうる規約なので、いずれも仮定せず木から導き直します。

### 4a. 部品リファレンス

`readme-review` の N1 を、そこに書かれているとおりに適用します —— N1 が名指しする節の形と、
役割・設計・実行機序の内容が実質的にあれば外れる、という但し書きの両方です。ここで形を書き写したり、
木から導き直したりしないこと。定義の場所は N1 であり、2 つ目の導出を持つと、同じファイルが
どちらのスキルから入ったかで違う分類になります。

当てはまったものの報告は**件数だけ**にし、その内容が住んでいる場所として Storybook と component の
TSDoc を名指しします。内容が弱いのではなく、別の面が持っているという意味です。

### 4b. feature slice

`src/features/` 配下の README（層 README である `src/features/README.md` を除く）は、
[`docs/templates/feature-readme.md`](../../../docs/templates/feature-readme.md) が宣言する必須節に対して
`readme-review` の Step 2b で採点します。必須節の欠落・薄さがあれば `borderline` が上限です。
節の一覧を焼き込まず、テンプレートを読みます。

### 4c. それ以外

残る各ファイルへ `readme-review` の Step 2 の基準を当て、判定と、それを決めた基準を名指しした 1 行の根拠を
記録します。ファイルを読んで判断し、パスから判断しないこと。

すべてを `manual-worthy` にして省かないこと。この分類がレポートの価値そのものです。

## Step 5. 追加候補の group と dst を導く

`manual-worthy` と `borderline` に限り、かつレポートのためだけに行います —— 追加の提案ではありません。

1. manifest の section ごとに、その `src` 群の最長共通パス接頭辞を取る
2. 各候補を最長一致の接頭辞へ当てて section を推定する。どれにも当たらなければ `unmatched` と印を付ける
   —— 新しい section は人の判断であり、そもそも見えるようにするには `meta.groups` と `section_titles` の
   両方への登録が要ります
3. その section が既に `dst` をどう名付けているかを読み、そのまま倣う。独自の名前を使っている section へ
   機械的な改名を持ち込まないこと

## Step 6. 報告する

日本語で出します。3 部構成 —— 壊れているもの、候補、件数だけのもの。

```text
Portal Manifest Sync 結果

== 修正対象 ==

[stale] N 件（portal:guides が非 0 で止まる）
  - [layers] src/foo/README.md

[構造] N 件
  - ⚠ どの group にも入っていない section (bar) を "Uncategorized" へまとめました
  - layers の baz が meta.subgroups のどの items にも無い → "Other" へ落ちる（警告は出ない）

== キュレーション候補 ==

[manual-worthy] N 件（自動追加はしません。追加は人の判断です）
  vrt/README.md → section=operations 推定, dst=docs/portal/guides/vrt.md
    根拠: 役割と境界 + 運用 + 索引。散文 10832 字

[borderline] N 件（あと 1 節で manual-worthy。/readme-review で個別に深堀できます）
[not-yet-manual-grade] N 件（README 側の充実が先）

== 情報のみ ==

[部品リファレンス] N 件 — Storybook と各 component の TSDoc が持つ領域
[feature slice] N 件 — 必須節の充足は /readme-review が個別に見ます
```

どのクラスにも何も無ければ、その旨を 1 行で述べて終わります。

## Step 7. 確認して適用する

このスキルが自ら変更を提案するのは **stale** クラスだけです。

- 「manifest に残っているが実体のない N 件を削除しますか？」/「すべて削除」「一部のみ削除」「スキップ」

stale の削除はたいてい安全ですが、それでも確認します —— リファクタの途中で一時的に消えているだけで、
エントリを残したい場合があります。

追加は、レポートを読んだユーザが**自分でファイルを名指ししたときだけ**行います。そのうえでファイルごとに、
推定した section と `dst` を提示し、確認を取ってから適用します。

YAML は**その場で**編集します —— 対象 section の最後のエントリを見つけ、同じ字下げでその後ろへ 2 行を
挿入します。文書全体を書き直さないこと。manifest のコメントは ADR 0141 の根拠を持っており、
往復させると落ちます。

**`meta.subgroups` を持つ section への追加は、新しい guide id をどれかの subgroup の items へ載せるまで
終わっていません。** そうしないとエントリは `Other` へ公開され、それは Step 2 が拾おうとしている
無言の誤配置そのものです。推測せず、どの subgroup かを尋ねます。

## Step 8. 検証する

```bash
pnpm portal:guides
pnpm portal:docs
git diff docs/portal/manifest.yaml
git status --porcelain docs/portal
```

前 2 つは、新しい `⚠` 行を出さずに成功する必要があります。最後は何も出力しない必要があります ——
生成される `docs/portal/guides/**` と `docs/portal/docs.json` は追跡外（ADR 0141: 生成物は配信時に
組み立て、追跡しない）なので、そこに何か現れたら、書いてはいけないものが書かれたということです。

manifest の差分を見せて終わります。このスキルはコミットしません。必要なら `/commit` へ繋いでください。

## AI Modification Scope

この実行の間だけ、次へ限って緩和されます。

- `docs/portal/manifest.yaml` —— このスキルが書き込む唯一のファイル

この実行中も保護されるもの。

- `AGENTS.md` / `CLAUDE.md`
- Accepted な ADR 本文と `LICENSE`
- `.claude/settings.json` の `permissions.deny` に載っているパス
- `docs/portal/guides/**` と `docs/portal/docs.json`（生成物）
- 元の README 群
- それ以外すべて

## 禁止事項

- ❌ どのクラスであれ候補を一括追加すること —— manifest はキュレーション済みで、追加はユーザの判断
- ❌ 未登録 README を「直すべき drift」として扱うこと
- ❌ `readme-review` の基準をここへ複製すること —— 実行時に読む
- ❌ section 一覧・`dst` の命名・component README の形を焼き込むこと —— いずれも木から導く
- ❌ `portal:guides` / `portal:docs` が既に決めていることを再実装すること
- ❌ YAML 全体を書き直すこと（manifest のコメントが落ちる）
- ❌ subgroup を持つ section へ、guide id を subgroup へ置かずに追加すること
- ❌ `docs/portal/guides/**` と `docs/portal/docs.json` に触れること
- ❌ モード確認を飛ばすこと、確認なしに適用すること
- ❌ commit / push すること
- ✅ ユーザ向け出力は日本語
- ✅ `manifest.yaml` はその場で、字下げとコメントを保って編集する
- ✅ 書き込んだあとに両方の生成スクリプトを回し直す

## チェックリスト

- [ ] `AskUserQuestion` でモードを確認した
- [ ] 生成スクリプトを両方回し、その出力を仮定せず読んだ
- [ ] subgroup を持つ全 section について配置を検査した
- [ ] ディスク列挙に `git ls-files` を使い、`docs/**` と `.claude/**` を除外した
- [ ] 絞り込みの前に component README の形を木から導き直した
- [ ] `readme-review` の基準を実行時に読み、ファイルごとに根拠付きで適用した
- [ ] feature slice を `docs/templates/feature-readme.md` に対して採点した（焼き込んだ一覧ではなく）
- [ ] section と `dst` を manifest から導いた（創作していない）
- [ ] stale の削除は確認を取った。どの候補も自動追加していない
- [ ] manifest はその場で編集し、コメントが残っている
- [ ] 生成スクリプトを回し直し、`git status --porcelain docs/portal` が何も出さなかった
- [ ] commit / push をしていない
- [ ] レポートは日本語で、クラス別の内訳を持っている
