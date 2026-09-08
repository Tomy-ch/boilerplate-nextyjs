# 原典とその解釈の目録

このリポジトリの決定のうち、**外部の原典を読んで導いたもの**を、原典と対にして並べる。
[0010](../adr/0010-standards-and-non-lockin.md) は「標準に従い、特定の実装へ縛られない」を決めて
いるが、**従った先が動いたときに、どの決定を読み直せばよいかを答える場所が無かった。**ここが
その索引である。

## この目録が答えないこと

**裁定しない。**差異が出ても、原典に合わせるべきか、こちらの決定が正しいままかは、ここでは
決めない。ここが持つのは「食い違っている」という観測だけで、**どちらを動かすかは人が決める**
（[`AGENTS.md`](../../AGENTS.md) の *Where You May Stop*）。

**載っていないことは「差異なし」ではない。**この目録に在るのは**確かめた対**だけである。原典を
読んで導いた決定は他にもあり、それらは**未判定**であって一致が確認されたのではない
（[0157](../adr/0157-inspection-declaration-discipline.md)）。

## 判定の 3 値

| 値 | 意味 |
| --- | --- |
| **差異なし** | 原典がいま言っていることと、こちらの解釈が一致している |
| **差異あり** | 食い違っており、**その食い違いを述べた決定がこちらに無い** |
| **逸脱宣言あり** | 食い違っているが、**なぜ外れるかをこちらの決定が明示している** |

「差異あり」と「逸脱宣言あり」を分けるのがこの目録の要点である。**外れていること自体は問題では
ない** —— 問題なのは、外れていると誰も知らないまま外れていることである。

## 判定に使った前提を必ず書く

判定の尺度は**読み手の記憶**になりやすい。「React はこう言っているはず」で判定すると、間違って
いても誰も反証できない。だから各行は、**原典がそう言っていると読んだ根拠**を、辿れる形で持つ。
前提が書けない対は、この目録へ載せない。

## 目録

| 原典 | こちらの解釈 | 判定 | 判定に使った原典側の前提 | 確かめた日 |
| --- | --- | --- | --- | --- |
| Next.js の `"use client"` ディレクティブ（同梱文書 `node_modules/next/dist/docs/01-app/04-glossary.md`） | [`docs/design/rendering.md`](../design/rendering.md) の「`"use client"` は『CSR にする指示』ではない」 | **差異なし** | 同文書が `"use client"` を "marks the boundary between server and client code ... should be included in the client bundle" と定義し、Client Component を "can also be rendered on the server during initial page generation" と述べている。**バンドル境界であって描画の場所ではない**という読みは、原典の語をそのまま採ったものである | 2026-09-09 |
| Core Web Vitals の "good" 境界（LCP 2.5 秒） | [0101](../adr/0101-performance-budget.md) の LCP 上限 | **逸脱宣言あり** | 2.5 秒は **field（実ユーザ計測）側の定義**である。0101 はこれを lab の推定値へそのまま置かず、「床 + 実行をまたぐ振れ + アプリへ割り当てる分」で導くと本文で述べている。field の LCP は [0082](../adr/0082-client-observability.md) の RUM が別に持つ | 2026-09-09 |
| Lighthouse が INP の lab 代替として置く TBT | [0101](../adr/0101-performance-budget.md) の TBT 上限 | **逸脱宣言あり** | TBT の 200 ms が INP の "good" 境界と一致するのは **Lighthouse のスコアリング規約の側の都合**であり、標準がその値を定めたのではない。0101 はそう明示したうえで、計測手段を変えたらこの行を置き直す、という撤去条件まで本文に持っている | 2026-09-09 |
| Conventional Commits 1.0.0 | [0150](../adr/0150-git-workflow.md) のコミット規約と [`commitlint.config.ts`](../../commitlint.config.ts) | **差異あり** | Conventional Commits は type を小文字で定め、`type(scope)!: description` の形と `feat` / `fix` の意味を規定する。こちらは大文字始まりの 11 種（`Feat` / `CI` など）と日本語の件名を採り、`commitlint.config.ts` は `type-case` を課さない。**この形が Conventional Commits から外れていることを述べた決定が、0150 にも設定にも無い。** 設定のコメントは「大文字構成が混在するため type-case を課さない」と手段だけを述べており、標準との関係には触れていない | 2026-09-09 |

## 目録が動く条件

- **原典が動いたとき。**依存の major 更新（`tools-upgrade` / Dependabot の major）は、その原典を
  読んで導いた行の読み直しを要求する
- **こちらの決定が動いたとき。**ADR の改訂で解釈が変わったなら、対の片側が変わっている
- **対が増えたとき。**新しく原典を読んで決めたなら、その対を足す

判定を入れ直すのは [`interpretation-audit`](../../.claude/skills/interpretation-audit/SKILL.md) で
ある。行の形（解釈の指し先が実在するか、前提を持っているか、判定が 3 値のどれかか）は
`scripts/interpretations.gate.test.ts` が見る。
