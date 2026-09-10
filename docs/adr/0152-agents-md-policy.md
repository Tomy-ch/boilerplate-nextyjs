# AGENTS.md 運用方針

本プロジェクトでは、AI コーディングエージェント (Claude Code / Codex / Copilot / Gemini 等) が参照する **規約集約ファイル** として `AGENTS.md` を repo ルートに 1 本配置する。本 ADR では `AGENTS.md` の位置付け / 構成 / 本文言語 / 更新責務を定義する。

## Status

Accepted

## 採用理由 / 目的

- 複数の AI エージェントが共通して読む規約のサーフェイスを **1 本に集約** し、エージェントごとの設定ファイル (`.claude/` / `.cursor/` / `.gemini/` / `.github/copilot-instructions.md` 等) は AGENTS.md を参照する建付けにする
- 確定済み ADR の本文を AGENTS.md に二重化しない (一次情報は `docs/adr/` 配下)
- 未策定領域に対する暫定運用 (どこまでなら勝手にやってよいか) を明示し、ADR が無い領域でも作業が破綻しないようにする
- boilerplate としてテンプレートから作った側が「最初に読むエージェント規約」を辿れる入口を残す

## ファイル配置と参照関係

```text
.
├── AGENTS.md                          ← 規約本体 (本 ADR の対象)
├── CLAUDE.md                          ← `@AGENTS.md` の 1 行のみ (Claude Code が読む)
└── .github/copilot-instructions.md    ← AGENTS.md を参照する補助
```

- **本体**: `AGENTS.md` (repo ルートに 1 本)
- **CLAUDE.md**: 内容は `@AGENTS.md` の 1 行のみ。Claude Code の機能でシンボリック参照する
- **エージェント固有設定** (`.github/copilot-instructions.md` / `.cursor/` / `.gemini/` 等) は AGENTS.md を参照する補助層と位置付け、規約本体を持たない

エージェント固有設定に規約を写す形は採らない。同じ規則を 2 箇所に書くと片方だけが古くなり、ずれた側は「そのエージェントだけが読む規約」として生き残って、ADR と正面から食い違う指示になる。参照に徹する形なら、この種のずれは構造的に起こらない。固有設定に書きたくなった規約は AGENTS.md か ADR へ置く。

## 本文言語

本文は **英語** を既定とする。

ただし以下は **日本語のまま残す**:

- コミット規約のサンプル (件名が日本語であることを示すため)
- PR 確認文言「変更はローカルにコミット済みです。これらの変更をプルリクエストにプッシュしますか？」 (AI エージェントがこの文言で確認することをルール化しているため)
- PR テンプレートのセクション名 (`概要` / `変更内容` / `動作確認方法`、`.github/pull_request_template.md` の実セクションと一致させるため)
- **日本語の文書の節名を指す参照** (`docs/rules.md`「作業とエージェント」、ADR の「決定 4」「選定基準」等)。訳すと指す先が引けなくなるため、ファイルパスと同じ扱いにする

判定は **その文字列が要求そのものか、要求の例示か** で行う。要求そのもの (上の 3 つ) は訳すと要求でなくなるので日本語のまま置く。**例示は英語でよい** —— 可視出力を日本語にするのは `Language Rules` が既に担っており、例の言語がそれを決めるわけではない。トリガの例・言ってはならない問いの例・返してよい答えの例は、いずれも形を示しているだけなので英語で書く。

### なぜ本体は英語か

`Language Rules` 節で定める「AI 生成出力は日本語」は **AI が生成する成果物** (コード / PR / コメント等) に対するルールであり、**人間が編集する authoritative ドキュメント** には適用しない。AI エージェントの training data は英語が中心で、規約自体の理解精度は英語の方が安定する。

### 日本語の対訳

英語で置いた帰結として、**この規約を守らせる側の人間が原文を読めない**状態が生まれる。読めない規約は
守らせられないので、対訳を `AGENTS.ja.md` として repo ルートに並置する。canonical は `AGENTS.md` で
あり、エージェントが読み込むのはそちらだけである。

- **置き場は兄弟**であって `docs/ja/` ではない。[0140](0140-documentation-operations.md) の並行ツリーは `docs/**` の話で、`AGENTS.md` はその外に在る。canonical を英語で持つ文書は `SKILL.md` とこれだけであり、対訳も `SKILL.ja.md` と同じ置き方をする
- **追従の向きは canonical が先**である。知識を探すのも判定を当てるのも書き換えるのも `AGENTS.md` に対して行い、対訳を inline で直さない
- **ペアの見出し構造は `scripts/skill-lint` が 1:1 で検査する**。宣言だけでは対訳の遅れを検出できない([0144](0144-decision-enforcement-pairing.md))。訳文が同じことを言っているかは機械では判定できないので、そこは未検査として skill-lint 自身が名指しする
- **`BEGIN-END` マーカーは対訳へ持ち込まない**。あれは Next.js が `AGENTS.md` へ生成する範囲の境界であり(下記)、対訳へは何も生成されない。一方 `boilerplate-only` のマーカーは両側が同じ位置に持つ —— 片側だけが剥がれると、テンプレートから作られたリポジトリで英語と日本語が違うことを言う

## 構成 (節構造)

以下の節順序で構成する。各節の責務は固定する。

| # | 節 | 責務 |
| --- | --- | --- |
| 1 | 前文（見出しを持たない） | リポジトリの役割を数行で述べ、**規約をここに再掲しないこと**と、どの文書が何を持つかは #3 の表が言うことを宣言する。役割の詳細は [`README.md`](../../README.md) が持ち、写しを置かない。続けて**全作業に掛かる 3 制約**（決定的な検査が判断より上位 / アーキテクチャと方針は人のゲートを残す / アプリは AI に依存しない）を置く —— どれも個別の節の中では述べられない、節をまたいで効く前提である |
| 1.5 | Temporary Operating Rules until v1.0.0 | **v1.0.0 未満の期間限定節**。Protected Documentation / AI Modification Scope の一時解除を宣言する。v1.0.0 到達時に節ごと削除し、戻す先の形と手順は下記「Protected Documentation の機械強制」が持つ([0140](0140-documentation-operations.md) の同名節と対。切替は 0140 決定 4 と同じ変更で行う) |
| 2 | Instruction Priority | 指示の優先度 (後述) |
| 2.5 | What to Recommend | **boilerplate 限定節**。推奨 (行為ではなく助言) を何に向けて最適化するかを定める。本文を `boilerplate-only:begin` / `end` で囲み、作った側の初期化で節ごと削除する <!-- boilerplate-only:line --> |
| 3 | Canonical Documentation | 「何が要るか → どこを読むか」の経路表。**ADR の一覧を持たない** —— 全件は [`docs/adr/README.md`](README.md) が 1 行要約つきで持ち、二重管理にすると片方が黙って古くなる。正典がサフィックス無しのパスであること（`*.ja.md` を読まない）も同じ節が述べる |
| 4 | Task Execution Protocol | 着手前に踏む順。**触る先を所有する `README.md` を先に読む**ことと、索引から決定を引くこと、既存実装の確認、契約を生成物より先に動かすこと、**所有スキルがある操作を手で組み直さないこと** |
| 5 | Review Phase Protocol | 「レビューして」が指す 3 つの subject (`impl-review` / `test-review` / `comment-sweep`) と、実行可否を見積もり付きで問う責務。**#4 の直後に置く** —— 着手前の手順と対になる「終えたあとの手順」であり、離すと作業の流れから切れる |
| 6 | Forbidden Shortcuts | **禁止事項を列挙しない**ことを宣言する節。機械で決まるものはゲートが、残りは層 README と `rules.md` が持つと述べ、「ここに書かれていないことは規則でない」の推論を塞ぐ |
| 7 | Where You May Stop | 決定をユーザへ返してよい場所の**閉じた一覧**と、判断を要さず作業を止める trip wire。**個々の停止点の本体を AGENTS.md 内に置かない** —— 表の行が指す先は必ず AGENTS.md の外にある文書で、内側を指す行があると一覧の閉じ方が壊れる |
| 8 | AI Modification Scope | 編集可 / 編集禁止 / エージェント設定保護 / Skill 実行時 Exception |
| 9 | Installing Things | あらゆる `install` の口に掛かる規律（自発的に入れない / 求められたときだけ / 先に既存の構成を見る）。依存の追加は別問題で [0004](0004-library-management.md) が持つ |
| 10 | Recommended Commands | pnpm / make のうち、`package.json` と `.makefiles/README.md` から導けないものだけ。**文脈量だけを変える道具（`rtk` / `graphify`）の使い方の規律**も同じ節が持つ —— 費用と除外は [`.claude/README.md`](../../.claude/README.md) だが、毎ターン効く規律は常時載る側に無いと縛れない |
| 11 | Git Rules | 0150 の要点抜粋。**機械が塞いでいるもの（`deny` の force push / rebase / amend）と、他文書が持つ手順は再掲しない** —— 残すのは散文しか止められないもの（base 解決の罠、amend 後の確認文面）だけである |
| 12 | Language Rules (+ `### Output Language` / `### Response Discipline` サブ節) | **言語に関する規則を 1 節が持つ。** 内部処理は英語可・可視出力は日本語・ユーザが英語を指示したときは英語、の 3 つは同じ規則の 3 つの面であり、節を分けると同じことを 3 回書くことになる。応答の規律（結論先出し / 読んでいない事実を書かない / 決定的な検査はフィルタ越しに報告しない）も同じ節が持つ —— 対象がどちらも「書き戻すもの」で、別の節にすると片方だけを読んだ状態が作れる |
| 12.5 | Purity Sweep | **boilerplate 限定節**。全ファイルを 1 度ずつ通す純化パス(純粋性 / 設計判断の蒸留 / 所有文書への還元)の規則と、台帳・照会フックの在り処を述べる。本文を `boilerplate-only:begin` / `end` で囲む。削除の契機は台帳の完了で、条件と同時に消す対象は [`.agents/README.md`](../../.agents/README.md) が持つ <!-- boilerplate-only:line --> |
| 13 | Protected Documentation | 直接編集禁止ファイルの宣言 |

**節は「その節を読まなかった読み手が違う操作をするか」で立てる。** 同じ規則の別の面は節にせず、1 節の中に置く。#12 がその判定を通らなかった例で、内部処理・出力言語・英語指示の 3 つが別の節に割れていた。

**道具が実在することは、その道具について書く理由にならない。** かつて在った `Code Style` 節は、biome と ESLint という**動いている機構**の使い方と禁止事項を並べていたが、禁止事項は [0002](0002-formatter-linter.md) の逐語の写しであり、実行手順は `package.json` と [`README.md`](../../README.md) に在り、「コミット前に回せ」は `Recommended Commands` の「ゲートを先回りして回さない」と正面から食い違っていた。**機械が落とすものを AGENTS.md が繰り返さない**のは #6 が宣言していることでもある。残したのは 1 点だけ —— 「`pnpm lint` が緑でも `lint:ci` は落ちうる」という、読まないと違う操作をする事実であり、置き場は #10 の pnpm の項である。

節の追加・順序変更は ADR 改訂を要する。#3 の表に行を足す（新しい索引が生まれたとき）のは軽微編集とし、ADR 改訂は不要。**ADR を 1 本足しても #3 は動かない** —— 足す先は [`docs/adr/README.md`](README.md) の一覧である。

**小数番号は「いずれ削除される節」の印**である。削除しても 1〜13 の恒久節の番号が動かないことを保証する。削除の契機は節ごとに異なるので上の表に書き、削除時は節ごと消して表の該当行も消す。削除される節は本表に明示されたものだけを認める。

<!-- boilerplate-only:begin -->
### boilerplate 限定の記述

**この template を配る側にしか意味を持たない記述**は `boilerplate-only` マーカーで囲み、作った側の初期化で剥がす。#2.5 がその筆頭だが、対象は AGENTS.md に限らずリポジトリ全体である。

マーカーの形は `sample` 族と同一で、`boilerplate-only:begin` / `:end` / `:line` / `:replace-begin` / `:replace-with` / `:replace-end` を持つ。機構は `scripts/setup/lib/markers.ts` が共有し、剥がしは `make setup-remove-boilerplate-only` が行う。

**族を分けてあるのは、消える契機が違うためである。** サンプルは題材を使うかで選べる任意の破棄だが、boilerplate 限定の記述はテンプレートから作った時点で前提が失効するので選択の余地が無い —— 残せば作った側が自分に効かない規則に従うことになる。同じ族にすると、サンプルを残す作った側が両方を残す。剥がしの道具そのものも、この理由から破棄の道具とは独立に自消滅する。

**剥がしが壊れていないことは CI が恒常的に検証する。** 剥がしは一度きりで自分ごと消える道具なので、対の無いマーカー・他の文書がリンクする見出しを持つ節の消失・古くなった台帳の項目は、誰かが実際にテンプレートから作って剥がすまで誰にも見えない。台帳の隣のユニットテストは剥がしを実行しないため、剥がしたあとの木は見られない。よって CI が使い捨てのチェックアウトで剥がしを実行し、残った木が全ゲートを通ることを PR ごとに確かめる (job の分割は [0153](0153-ci-configuration.md))。

**囲んだ節は、剥がしのあとも残るものから参照しない。** 作った側へ渡るコードや文書がここを指すと、参照先だけが消えて宛先の無いリンクが残る。剥がしの検査（`.github/workflows/strip-verify.yaml`）が見るのはマーカーの語の残留だけで、宛先を失った参照は捕まえない。作った側も読む根拠は、剥がされない側の ADR へ置く。
<!-- boilerplate-only:end -->

## Instruction Priority

AI エージェントは以下の優先度で指示に従う。矛盾時は上位を優先する。

1. **AGENTS.md** — 本ファイル
2. **`docs/adr/*.md`** — 確定済み ADR
3. **`docs/adr/BACKLOG.md`** — 未策定領域の進捗ボード
4. **`.github/copilot-instructions.md`** 等のエージェント固有設定
5. ユーザ指示

**`docs/adr/BACKLOG.md` を破棄した時点で、3 の段を落として 4 段にする。** 未策定領域の追跡は破棄と同時に issue トラッカーへ移るが、issue は優先順位の段にならない —— 着地した瞬間に閉じるものを恒常の優先順位に載せても、その段は常に空か古いかのどちらかである。AGENTS.md の `Instruction Priority` 節も同じ変更で 4 段にする(下記「更新責務」の構成対応)。

強制: 散文。破棄済みのパスへ向く相対リンクが AGENTS.md / ADR に残ることは静的に検出できるが、Markdown の相対リンクの宛先実在を見る検査は未実装(`md-lint` は相対リンクの宛先を解決しない)。

## 未策定領域の扱い

ADR 化されていない決定領域の一覧を AGENTS.md は持たない。追跡先は `docs/adr/BACKLOG.md` が在る間はそれ、破棄後は issue トラッカー —— **閉じることのできる単位**である。AGENTS.md や ADR に一覧を写せば、1 つ着地した瞬間に陳腐化する二重管理になる([`docs/project/roadmap.md`](../project/roadmap.md) が作業項目を持たないのと同じ理由)。**踏み込んだときの振る舞いは AGENTS.md が持たない。** 「導出できない領域で規約・パターン・ライブラリを持ち込まない / 暫定実装は着手前に明示する」は日常強制される rule であり、置き場は [`docs/rules.md`](../rules.md)「作業とエージェント」である([0140](0140-documentation-operations.md) 決定 3)。AGENTS.md 側は `Where You May Stop` の停止点表から 1 行で指すだけにする —— 節を立てると、停止点の一覧が自分の内側を指すことになり、閉じた一覧である意味が消える。

ADR が策定されたら、[`docs/adr/README.md`](README.md) の一覧へ追加する。AGENTS.md は触らない。

## BEGIN-END マーカー

本文は以下のマーカーで囲む:

```markdown
<!-- BEGIN:nextjs-agent-rules -->
... AGENTS.md 本文 ...
<!-- END:nextjs-agent-rules -->
```

Next.js 自身が `AGENTS.md` を生成する範囲の境界であり、将来ここへ外部生成ブロックを挟む余地でもある。現状は本文全体がマーカー内に入り、生成は [`next.config.ts`](../../next.config.ts) の `agentRules: false` で止めてある —— 走ると囲みの中身ごと置き換わる。

## 更新責務

- AGENTS.md は `Protected Documentation` に列挙され、AI エージェントは直接編集しない。変更案を提示してユーザ承認を得てから編集する(**v1.0.0 未満の間はこの都度承認を解除する** — 下記「Protected Documentation の機械強制」の「いまの形」/ [0140](0140-documentation-operations.md) 決定 4)
- 本 ADR (0152) と AGENTS.md は **構成上の対応関係** を持つ。本 ADR を改訂する場合は AGENTS.md 側も同じ PR で揃える
- `Canonical Documentation` 表への索引の追加は軽微編集として扱う

## Protected Documentation の機械強制 —— 編集許可の最終形

`Protected Documentation` の宣言は散文であり、宣言だけでは担保にならない([0144](0144-decision-enforcement-pairing.md))。機械強制は Claude Code の `.claude/settings.json` の `permissions` が担う。**`settings.json` は JSON で注釈を持てない**ため、そこに在る値が何を意図した形なのか、いまの形が最終形とどう違うのかは本 ADR が持つ。

### 最終形(v1.0.0 から)

`permissions.deny` が次の 8 エントリを持ち、`permissions.ask` はこれらを持たない。

| エントリ | 守るもの |
| --- | --- |
| `Edit(AGENTS.md)` / `Write(AGENTS.md)` | 規約本体 |
| `Edit(LICENSE)` / `Write(LICENSE)` | ライセンス([0142](0142-license.md)) |
| `Edit(.claude/settings.json)` / `Write(.claude/settings.json)` | 権限境界そのもの。エージェントが自分の deny を外せる形にしない |
| `Edit(docs/adr/*-*.md)` / `Write(docs/adr/*-*.md)` | Accepted ADR 本文(immutable — [0140](0140-documentation-operations.md) 決定 4)。`*-*` は番号付きの ADR にだけ掛かり、`docs/adr/README.md` には掛からない |

**`ask` ではなく `deny` にする理由。** `ask` は編集のたびに承認を求める形で、承認する側が内容を読まずに通した 1 回で保護が破れる。Protected Documentation の保護の中身は「人が変更案を読んで判断する」ことなので、経路をエージェントの提案 → 人の編集に限り、エージェントの編集そのものを塞ぐ。`deny` には承認疲れで通る経路が無い。

### いまの形(v1.0.0 未満)と、そうしている理由

- `AGENTS.md` / `LICENSE` / `.claude/settings.json` の 6 エントリは `permissions.ask` に置く。承認は残し、hard block はしない
- Accepted ADR 本文はエントリを持たない

v1.0.0 未満の ADR は living document で、本文を直接上書きする([0140](0140-documentation-operations.md) 決定 4)。この期間の作業の大半は ADR 本文の書き換えそのものなので、ADR に `ask` を置くと承認が常時鳴り、承認する側が内容を読まずに通す習慣を作る —— `deny` を選ぶ理由と正反対の状態である。鳴らないほうが、鳴り続けて無視されるより保護として正しい。AGENTS.md / LICENSE / settings.json は編集の頻度が低く、`ask` が「読んで判断する」機会として機能するので残す。

### v1.0.0 での復元手順

1. `.claude/settings.json` で上の 6 エントリを `permissions.ask` から `permissions.deny` へ移し、`Edit(docs/adr/*-*.md)` / `Write(docs/adr/*-*.md)` を `permissions.deny` に足す
2. `AGENTS.md` の `Temporary Operating Rules until v1.0.0` 節を削除し、`AI Modification Scope` / `Protected Documentation` に付いている「v1.0.0 未満は解除」の但し書きを消す
3. 本 ADR の節構成表から #1.5 の行、「更新責務」の v1.0.0 未満の但し書き、上記「いまの形」の小節を消す

[0140](0140-documentation-operations.md) 決定 4 の immutable 切替と同じ変更で行う。片方だけ切り替えると、上書きしてよい文書が `deny` で塞がれるか、immutable な文書がエージェントに開いたままになる。

### 強制手段と、届かない範囲

- **`permissions.deny` は Claude Code にしか効かない。** Codex / Copilot / Gemini には同等の宣言形式が無く、そこでは AGENTS.md の散文だけが保護である。寄せられない
- **`Edit` / `Write` の `deny` は `Bash` 経由の書き換え(`sed` / heredoc)に届かない。** 塞ぐには Bash の引数の中にパスを見る `deny` が要るが、パスが引数のどこに現れるかは決まらず、前方一致の宣言では書けない。寄せられない
- **`settings.json` が本 ADR の最終形と一致していること**は、上の表と JSON を突き合わせる検査として書ける。未実装

## 禁止事項

- ❌ AGENTS.md と並列に同等の規約ファイル (CLAUDE-RULES.md / GENERAL-RULES.md 等) を追加すること (規約は AGENTS.md 1 本)
- ❌ 確定済み ADR の本文を AGENTS.md に転載 / 二重化すること (要旨表に留める)
- ❌ AGENTS.md の節順序を独自判断で変えること
- ❌ BEGIN-END マーカーを削除すること
- ❌ エージェント固有設定 (`.github/copilot-instructions.md` 等) に AGENTS.md と矛盾するルールを書くこと

## 補足

- `CLAUDE.md` の `@AGENTS.md` 形式は Claude Code が提供する機能。他エージェントは AGENTS.md を直接読む
- エージェント固有設定と AGENTS.md の内容がずれた場合は AGENTS.md を SSOT とし、固有設定側を AGENTS.md への参照に縮約する

## 関連 ADR

- [0002-formatter-linter.md](0002-formatter-linter.md) — biome / ESLint の分担と禁止事項。**AGENTS.md は写しを持たない**（#10 が「`pnpm lint` と `lint:ci` の違い」だけを持つ）
- [0004-library-management.md](0004-library-management.md) — `Recommended Commands` 節が参照する pnpm exact pin ルール
- [0140-documentation-operations.md](0140-documentation-operations.md) — ADR の living / immutable 切替(編集許可の復元と同じ変更で行う)
- [0142-license.md](0142-license.md) — `LICENSE`(Protected Documentation の 1 つ)
- [0144-decision-enforcement-pairing.md](0144-decision-enforcement-pairing.md) — 宣言だけでは担保にならない(編集許可を `deny` で持つ理由)
- [0150-git-workflow.md](0150-git-workflow.md) — `Git Rules` 節が参照する Git 運用方針
- [0151-git-hooks.md](0151-git-hooks.md) — `Recommended Commands` 節が参照する hook 方針
- [0154-claude-skills-operations.md](0154-claude-skills-operations.md) — Skill 実行時 Exception で参照する運用系スキル方針
- [0155-claude-skills-development.md](0155-claude-skills-development.md) — Skill 実行時 Exception で参照する開発系スキル方針
