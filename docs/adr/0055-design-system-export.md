# デザインシステムの外部書き出し

本プロジェクトのデザインシステム(design token と `components` の在庫)を、**リポジトリの外にあるデザインツールへ渡す**ときの形を定める。対象は、デザインシステム全体を見渡して批評する・一部を作り直す・その上に新しい画面を設計する、といった repo の外で行う設計作業である。部品を変える作業そのものは対象にしない —— それは `src/components/` に対する通常の実装作業である。

書き出しは 2 つの段に分かれる。**何を渡すか**(成果物)と、**どこへどう渡すか**(配送)である。前者はどの送り先でも同じものが要るのに対し、後者は送り先ごとに手順も到達経路も違う。本 ADR はこの 2 段をどこで切るか、そして書き出したものが repo へ戻ってくるかどうかを決める。[0010](0010-standards-and-non-lockin.md) §3 が原則として置く「デザインツールとの依存は repo → ツールの一方向」の、決定本体がここである。

## Status

Accepted

## 採用理由 / 目的

- **設計作業を実物の上で行わせる。** token も部品の在庫も repo にしか無いため、外で設計する側は推測で近いものを組み立てることになる。実物を渡せば、色・余白・部品の名前が repo と食い違わない
- **送り先の固有名を恒久文書から締め出す。** 特定のデザインツールの手順や API の癖を ADR や script に書くと、そのツールを差し替えたときに repo の恒久部分を書き換えることになる([0010](0010-standards-and-non-lockin.md) 非ロックイン)
- **デザインシステムの正を 1 つに保つ。** 外へ出した写しが repo へ流れ戻る経路を持つと、正がどちらにあるか分からなくなる

## 成果物は tool 非依存で、配送だけが vendor を知る

書き出しの script(`pnpm design:bundle`)は**どの送り先も知らない**。出すのは、どの送り先でも入力になりうる 3 つだけである。

| 成果物 | 中身 | 何の入力になるか |
| --- | --- | --- |
| `r/*.json` | shadcn registry の item。部品ごとのソースを inline し、題と用途を添える | registry を読めるツールはそのまま取り込む。読めないツールもソースとして読める |
| `catalog.md` | 部品の目録。層・見出し・用途・その部品が**持たないもの**・story 名 | 最初に渡す 1 枚。デザインシステム全体を 1 ファイルで読める |
| `tokens.css` | 生成済みの semantic token | 色・余白・書体。自前の変数体系を持つツールはこちらを読む |

registry の形式を採るのは、部品を取り込むときに使っている形式をそのまま逆向きに出すためである([0052](0052-ui-component-policy.md))。目録の用途と責務境界は各部品の README から、story 名は Storybook の index から引く。README が部品の説明の正であり([0052](0052-ui-component-policy.md))、Storybook が部品の唯一の在庫リストである([0054](0054-ui-catalog-storybook.md))ため、目録のために別の説明を書かない。token は [0051](0051-styling-system.md) の生成物をそのまま載せる。

**送り先ごとに違う部分は、すべてエージェントの skill が持つ**([0154](0154-claude-skills-operations.md))。ファイルを読む assistant には bundle をそのまま渡し、editor の中でしか design content を作れないツールには、そのツールを操作できるエージェントへ bundle を正として渡す —— どちらの経路を採るかも、その手順も、skill の側にある。skill は repo の恒久部分に触れずに差し替えられる位置にあり、vendor の形をしたものはそこへ閉じ込める。

**却下した案: script に送り先を書く。** `--target=<vendor>` のような分岐を script に持たせると、送り先が 1 つ増えるたびに script が増え、その vendor 名が `scripts/` と `package.json` に残る。送り先の手順は script より速く変わり、書き出しの形は変わらない。変わる速さが違うものを同じ場所に置かない。

**却下した案: 送り先ごとに専用の書き出しを持つ。** 「このツール向けの token 形式」「あのツール向けの部品一覧」と分けると、写しの数だけ drift の口が増える。成果物は 1 組にし、変換が要るならそれは配送の側で行う。

## 依存の向きは repo → design の一本

**デザインツールが生成したものを、書き出しの経路から repo へ書き戻さない。** token も、部品のソースも、screenshot も戻さない。ツールの出力は**こう見えるべきという提案**であり、repo は**実際に出荷されるもの**である。提案を実装するなら、それは人が読んで何を採るかを決める、通常の実装作業である。

提案を自動で流し込む経路を置くと、コードが誰も検証しないツールの出力を追い始め、そのツールがリポジトリの上流になる。そのとき正はツール側へ移っており、[0010](0010-standards-and-non-lockin.md) の「デザインシステムの正は repo にある」が崩れる。

**却下した案: 自動で取り込む(design tool → token の同期パイプ)。** token の値をツール側で編集し、それを `tokens/` へ同期させる案は、編集の場をツールへ移すことで一見便利に見える。しかし token の SSOT は `tokens/primitives.json` と系統ごとの semantic 定義であり([0051](0051-styling-system.md))、生成物の整合はそこから生成することで強制している。ツールから逆向きに流すと、その整合をツール側の制約で表現し直すことになり、表現できない部分から黙って壊れる。

[0051](0051-styling-system.md) が「デザインツールとの同期方式はここでは確定しない」と射程外に置いているのは、この向きの決定と矛盾しない。本体は逆向きの経路を持たない。それを敷くのは別の判断であり、本体の書き出しがそれを前提にすることはない。

## bundle は生成物であり、追跡しない

書き出し先は `tmp/design-bundle/` で、gitignore の下にある。**bundle を commit しない。** bundle はデザインシステムの写しであり、commit した時点で 2 つ目のデザインシステムが repo に生まれ、部品を変えるたびに写しが取り残される。要るときにその場で作る。

story 名を引くために Storybook の build 済み index を読む。index が無ければ script は止まり、Storybook の build を促す。index が無い状態で story 名を空のまま出さないのは、目録が「story を持たない部品」を実在するかのように見せるためである。

## 書き出しが運べないもの

bundle に**描画した HTML も screenshot も入らない**。story は JavaScript が描くため、どちらを作るにも headless のブラウザが要り、書き出しの script はそれを持たない。送り先が部品を**読む**のではなく**見る**必要があるときは、bundle がそれを賄ったかのように振る舞わず、運べていないことをそのまま伝える。見る手段は [0156](0156-browser-observation-tooling.md) の観測レーンが持つ。

## 禁止事項

- ❌ 書き出しの script(`scripts/design-bundle`)や `package.json` に、特定のデザインツールの名前・API・手順を書くこと(vendor の形をしたものは skill へ)
- ❌ デザインツールの出力(token / 部品のソース / screenshot)を、書き出しの経路から repo へ書き戻すこと。実装するなら人が読んで決める通常の実装作業として行う
- ❌ `tmp/design-bundle/` を commit すること、または bundle の写しを `src/` や `docs/` に置くこと
- ❌ 目録のために部品の説明を書き足すこと(用途と責務境界は各部品の README が正。story 名は Storybook の index が正)
- ❌ bundle に無いもの(描画結果)を、送り先が受け取ったかのように報告すること

## 関連 ADR

- [0010-standards-and-non-lockin.md](0010-standards-and-non-lockin.md) — 依存の向き(repo → ツールの一方向)と、ツール固有の手順を恒久文書へ書かない原則。本 ADR はその決定本体
- [0050-styling-strategy.md](0050-styling-strategy.md) / [0051-styling-system.md](0051-styling-system.md) — token の器と体系。`tokens.css` の出所と、同期方式をここでは定めない位置づけ
- [0052-ui-component-policy.md](0052-ui-component-policy.md) — shadcn registry の形式と、部品の層・置き場・説明の正が README にあること
- [0054-ui-catalog-storybook.md](0054-ui-catalog-storybook.md) — Storybook が部品の唯一の在庫リストであること(目録の story 名の出所)
- [0154-claude-skills-operations.md](0154-claude-skills-operations.md) — 送り先ごとの配送手順を持つ skill の置き場
- [0156-browser-observation-tooling.md](0156-browser-observation-tooling.md) — bundle が運べない「見る」手段
