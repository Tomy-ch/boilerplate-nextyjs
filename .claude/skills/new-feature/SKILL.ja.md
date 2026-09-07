> **このファイルは `SKILL.md` の日本語訳です。**
> 直接編集しないでください。内容の変更が必要な場合は canonical な `SKILL.md`（英語版）を更新し、その後この日本語訳を同期してください。
> Claude Code のスキルとしては `SKILL.md` のみが読み込まれます。このファイルはスキル本体ではなく、レビューや学習用の翻訳ドキュメントです。

# New Feature

このリポジトリが既に持っているレールを繋いで、画面 1 枚を端から端まで作る。画面を足す人が置き場を
毎回発見し直さなくて済むようにするためのもので、このスキル自身が持つのは**順序**と**受け渡し**だけ
である。適用する規則はすべて、それを所有する文書から実行時に読む。

## 使うとき

- 新しい画面 / feature スライスを足すところで、ディレクション（何を出すか）が既にあるか、これから
  決まる。
- 置き場・feature README の必須節・`docs/spec/route/**` の仕様書・テストがどれも未作成で、手戻りを
  生まない順序で作りたい。

## このスキルを使わないとき

- **既存 feature の変更** —— 直接編集する。このスキルは何も無いところから始まる前提で書かれている。
- **`src/components/**` / `src/adapters/**` / `src/model/**` / `src/stores/**` / `src/capabilities/**`
  配下への追加** —— これらはカーネルなので `pnpm gen <kind> <name>` を直接叩き、story 先行の順序は
  踏まない。あの順序は画面の見た目を確定させる場面にしか要らない。
- **既にあるコードへのテスト作成** —— それは `scaffold-test` の仕事である。
- **レビュー** —— `impl-review` / `test-review` / `comment-sweep` は `AGENTS.md` の Review Phase
  Protocol における peers である。このスキルは判断を user へ渡すだけで、**それらを呼ばない**。呼ぶ
  スキルは、3 つの subject が独立に答えられなくなる代償を払う。

## 実行時に読むもの

以下の内容をこのファイルへ書き写さない。規約の変化に追随させるため、毎回その出所から読む。

| 出所 | そこが決めるもの |
| --- | --- |
| `docs/playbook.md` | 画面実装の順序 / 置き場の逆引き / ゲートの方針 |
| `docs/templates/feature-readme.md` | feature README が持つべき必須節 |
| `docs/spec/README.md` | 仕様書の 2 層構造と置き場 |
| `src/features/README.md` と各カーネル README | import 境界 / `test-requirement` / 公開面 |
| `architecture.ts` | `pnpm gen` と ESLint boundaries が強制する依存マトリクス |
| `mocks/README.md` | backend 抜きで画面を動かす方法 |

これらがこのファイルと食い違う場合は、**あちらが正である**。このファイルに従わず、食い違いを報告する。

## Step 0. 対象を確認する

何かを書く前に `AskUserQuestion` を呼ぶ。

1. **feature 名**（kebab-case）と、置かれる route。
2. **ディレクション** —— 画面が何を出すか、またはそれが決まった場所への参照。アイデアしか無い場合は
   そう言って Step 2 を回す。プロダクトの中身を勝手に作らない。
3. その route の**仕様書が既に `docs/spec/route/**` にあるか**。

ここで `docs/playbook.md` を読み、そこに書かれた順序に従う。以下の順序は執筆時点のそれを写したもの
なので、**食い違ったら playbook が正である**。

## Step 1. 設計をリポジトリに接地させる

`Explore` エージェントを 2〜3 本、1 つのメッセージで並列に投げる。観点は分ける —— 最も近い既存画面と
その `app` → `features` → `adapters` の全経路、新しい画面が触るカーネルの慣習、消費する契約とモック
ハンドラ。返ってきたファイルを読んでから設計し、見つかった型を `file:line` 付きで提示する。

既存の `Explore` / `Plan` のエージェント型を再利用する。新しい型を定義しない（ADR 0155）。

## Step 2. ディレクション（工程 1）

`docs/templates/feature-readme.md` を `src/features/<name>/README.md` へ埋める —— route と消費する
契約、状態表、依存カーネル、Server Action の戻り値契約、テスト観点。状態表が次の工程を動かすので、
部品が 1 つも無いうちに書く。

ディレクションが本当に決まっていないところは、プロダクトの振る舞いを選ばずに `AskUserQuestion` で
訊く。画面が何を約束するかの著者は user である。

## Step 3. story 先行（工程 2）

スライスに `pnpm gen feature <name> --screen=<画面>` を、設計が要求する共有部品に `pnpm gen component <name> --as=<見出し>` を回す。
配置・命名・境界は生成器に委ね、**手で置かない**。生成器が取る入力以外を渡さない（`architecture.ts`
＋層 README が唯一の入力であり、`docs/spec/**` は**生成入力ではない**）。

出るのは `README.md` / `<name>.tsx` / `<name>.test.tsx` のフラットな 3 ファイルで、`list/` と
`detail/` への**分割はしない**。これは意図されたもので、ADR 0027 が「2 つ目の画面が来るまで画面軸を
畳んでおく」と定めているためである。分割は Step 5 の仕事であり、ここではない。生成器が作らなかった
ディレクトリを先回りして作らない。

そのうえで、README の状態表が宣言する 4 状態 —— loading / empty / error / success —— すべての story
を書く。取得を持たない形へ view を切ると、全状態が story から出せる。

## Step 4. レビューへの受け渡し（工程 3）

**ここで止めて、見た目を人に確定させる。** 説明ではなく実物を立てる。

```bash
pnpm storybook
```

script 側が `APP_ENV` を `local` に既定しているので、前置きは要らない。`:6006` で出る。1 ツールに
つき 1 つだけ立て、閉じるのは user に任せる。URL と見るべき story id を渡して、待つ。

**これが返るまでテストを書かない。** 順序が在る理由そのものであり、確定していない見た目に対して
書いたテストは書き直しになり、書き直したテストは「正しくなるまで」ではなく「通るまで」緩められる。

## Step 5. 分離（工程 4）

レビューが確定させたものを層へ移す。置き場は `docs/playbook.md` の逆引きと各カーネル README から
決める。基準はコードにも README にも書き写さず、それを所有する ADR への参照パスとして持つ。

## Step 6. 仕様書（工程 5）

`docs/spec/README.md` に従って `docs/spec/route/<...>/page.{function,screen}.md` を書く —— 機能要件と
画面要件を、「契約と利用者の目的が同じまま、その記述だけが違う画面があり得るか」で振り分ける。

仕様書は確定した約束を記録するものなので、最初ではなくここに来る。契約 / token / `rules.md` / 部品
カタログ / ADR は**指すだけ**で、写さない。

## Step 7. テスト（工程 6）

揃った対象について `scaffold-test` スキルを連鎖させる。観点は対象自身の分岐と最近傍 README の
`test-requirement` から導かれる。テストの規約をここへ書き写さない。

## Step 8. ゲートと引き渡し

`docs/playbook.md` が判定の持ち主を定めている —— **hook と CI である**。lint 全体もテスト全体も手元で
掃かない。commit / push して結果を読む。いま手元で走るゲートは `make load-status` が出す。

日本語で締めの要約を出す —— 層ごとに作ったファイル、押さえた 4 状態、書いた仕様書、CI がまだ判定中の
もの。そのうえで、`AGENTS.md` の Review Phase Protocol が `/impl-review` / `/test-review` /
`/comment-sweep` の可否をスキルごとに user へ問うことを、**実行せずに**伝える。この変更でそれぞれが
何を返しそうかの見積もりを添える。

**commit しない。push しない。** どちらも `/commit` と `/submit-pr` を通じて user のものである。

## 制約

- ❌ Step 4 のレビューが返る前にテストを書く。
- ❌ `pnpm gen` が置くはずのファイルを手で置く、または生成器へ `architecture.ts` ＋層 README 以外の
  入力を渡す。
- ❌ `docs/spec/**` を生成入力として扱う —— **読み込み**入力に限る。
- ❌ `impl-review` / `test-review` / `comment-sweep` を呼ぶ。
- ❌ ディレクションが決まっていないところでプロダクトの振る舞いを作る —— 訊く。
- ❌ ゲートを先回りして lint 全体 / テスト全体を手元で回す。
- ❌ `docs/playbook.md` / カーネル README / ADR が所有する規則をこのファイルへ書き写す。
- ✅ スキルが出力しリポジトリへ書くものはすべて日本語。
- ✅ 失敗した工程で停止して表に出す。先行する書き込みを自動で巻き戻さない。
- ✅ 既存の `Explore` / `Plan` エージェント型を再利用する。

## チェックリスト

- [ ] feature 名 / route / ディレクションを `AskUserQuestion` で確認した（Step 0）
- [ ] `docs/playbook.md` を今回の実行で読み、その順序に従った
- [ ] 部品が 1 つも無いうちに、テンプレートから feature README を埋めた（Step 2）
- [ ] ファイルは `pnpm gen` が置いた。4 状態の story を書いた（Step 3）
- [ ] テストを 1 行も書く前に、Storybook を立てて人が見た目を確定させた（Step 4）
- [ ] 分離のあとに `docs/spec/route/**` へ仕様書を書いた（Step 5〜6）
- [ ] `scaffold-test` でテストを作った（Step 7）
- [ ] 手元で全体を回していない / commit していない / push していない / レビュースキルを呼んでいない（Step 8）
