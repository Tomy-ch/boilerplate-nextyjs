> **このファイルは `SKILL.md` の日本語訳です。**
> 直接編集しないでください。内容の変更が必要な場合は canonical な `SKILL.md`（英語版）を更新し、その後この日本語訳を同期してください。
> Claude Code のスキルとしては `SKILL.md` のみが読み込まれます。このファイルはスキル本体ではなく、レビューや学習用の翻訳ドキュメントです。

# adr-scan (provisional)

**ステータス: 暫定 / 一度きり。** *実在するが追跡されていない*アーキテクチャ上の意思決定をリポジトリ全体から拾い、それぞれが `docs/adr/BACKLOG.md` の枠に値するかを判定するために作られた。read-only であり、出力するのは**候補インベントリのみ**。`docs/adr/**` を書かず、`BACKLOG.md` を編集せず、ソースも編集しない。発見されたギャップが BACKLOG へ反映されたら、このスキルは削除またはアーカイブする。

## ここでの仕事が移行ではなく発見である理由

本リポジトリは、正式な ADR 群（`docs/adr/<NNNN>-*.md`。トピック別ブロック帯で採番）と、Tier 0〜6 のすべての意思決定領域を枠 ID（`G` / `T` / `R` / `A` / `B` / `C` / `D`）と 選定済み / 実装済み のステータス対で追跡する生きたボード（`docs/adr/BACKLOG.md`）を既に持つ。**散らばった決定を集めて群にする仕事は済んでいる**ので、それをやり直す走査はボードが既に持つものしか見つけない。

ボードが示せないのは、**そこへ一度も届かなかったもの**である。したがって有用な仕事は **gap discovery** になる。

したがってここで有用な仕事は**ギャップの発見**である — `AGENTS.md`・設定ファイル・`src/` のレイアウト・`.github/`・コードコメントに埋め込まれる形で*事実上*下されているのに、**どの BACKLOG 枠にも表現されていない**（あるいは表現されているが Tier / 分類を誤っている）意思決定を見つける。出力は BACKLOG の運用ルールのフローへ供給される — *新しい意思決定領域に気付いたら該当 Tier への追加 → 内容合意 → ADR 化*。

## 分類タクソノミー（判断の核心）

各候補はちょうど 1 つに分類される:

- **decision** — 持続的な帰結を伴う選択肢間の選択（Y ではなく X）。BACKLOG 枠に値する。
- **exclusion** — 「意図的に X をやらない」という根拠付きの決定。枠に値する（負の意思決定。BACKLOG の「明示的に boilerplate では決めない (out of scope)」節が一部の受け皿）。
- **rule** — 日々の制約・帰結（例: 「`@/*` alias を使う」「コミット prefix」）。[`docs/rules.md`](../../../docs/rules.md) に留まり、`AGENTS.md` には置かない（[0140](../../../docs/adr/0140-documentation-operations.md) 決定 3）。ADR を*参照*してよいが、それ自体は新しい意思決定領域ではない。
- **inventory** — コードとともに drift するカタログ（依存一覧・スクリプト一覧）。生きた参照ドキュメント / README に留まり、ADR にはしない。

枠に値するのは次をすべて満たす候補のみ: 検討された選択肢を持つ（または含意する）／横断的または元に戻しにくい／既存のルール・インベントリ・既追跡枠の言い換えでない。

## 走査面（read-only ワーカーを面ごとに 1 つ fan out する）

Agent ツールで並列に fan out する（read-only）。各ワーカーは後述の出力形で候補を返す。その後 orchestrator が既存の BACKLOG 枠に対して重複排除する。

1. **既存 ADR + ボード** — `docs/adr/*.md` + `docs/adr/BACKLOG.md`。*既に追跡されている*枠のベースライン集合を作る（発見結果を差分で見られるように）。Status や BACKLOG のステータス対が実態と食い違って見える ADR があれば記録する。
2. **AGENTS.md** — 「Where You May Stop」の停止点表（指す先の未決領域は BACKLOG にある。各々が枠へ対応しているか確認する）、「AI Modification Scope」/「Protected Documentation」/「Git Rules」/「Language Rules」の各節。真の意思決定とルールを切り分ける。
3. **設定・ツール（潜在的な意思決定）** — `package.json`（依存 / scripts / `packageManager`）、`tsconfig.json`、`next.config.ts`、`biome.json`、`postcss.config.mjs`、`mise.toml`、`.makefiles/**`、`.github/**`。ピン留めされたツール、有効化されたコンパイラフラグ、CI ジョブ、`browserslist` — いずれも設定の中で下されたまま ADR / 枠へ昇格していない意思決定でありうる。
4. **`src/` の de-facto 構造** — 実際のディレクトリレイアウト、`"use client"` の配置、ルート規約、スタイリング方針（Tailwind の使われ方）、状態管理・データ取得のパターン。これらは A 系 / B 系の de-facto 状態にあたる。各々が BACKLOG に（⚠️ de-facto として）反映されており、記録されないまま規約として固まりつつある状態でないかを確認する。
5. **散文・コメント中の潜在** — `README*`、コード中の `// TODO` / `// why` コメント、`.github/copilot-instructions.md`。ついでに述べられただけで追跡されていない意思決定・除外。

## 出力（候補ごと）

```text
- title:         短い意思決定タイトル（命令形・ADR 体裁）
  type:          decision | exclusion | rule | inventory
  frame_worthy:  yes | no
  source:        file:line（根拠）
  alternatives:  present | implied | none
  backlog_state: tracked <frameID> | untracked | mis-tiered <current→proposed> | mis-classified
  proposed_tier: Tier N + letter（例: "Tier 4 / B"）— 合致する既存枠 ID があればそれ、無ければ "new"
  note:          1 行 — 値する理由 / しない理由 / 何が食い違っているか
```

以下へ集約する:

- **(A) 未追跡の decision / exclusion** — 枠に値するが BACKLOG に無いもの。提案 Tier + 枠 ID 付き。*これが主たる成果物。*
- **(B) 追跡済みだが drift** — BACKLOG のステータス対（選定済み / 実装済み）や Tier が観測された実態と食い違って見える枠。
- **(C) rule のままとする一覧** — 新規枠ではなく [`docs/rules.md`](../../../docs/rules.md) の領分（[0140](../../../docs/adr/0140-documentation-operations.md) 決定 3）。AGENTS.md ではない。
- **(D) inventory のままとする一覧** — 生きた参照ドキュメントの領分であり、ADR にはしない。

orchestrator はこれらを*候補としてのみ*ユーザへ提示する。`BACKLOG.md` への反映（あるいは ADR の起票）は**別途ユーザ承認を要するステップ**であり、本スキルは実施しない（`BACKLOG.md` は `AGENTS.md` 上 AI 編集可能だが、運用ルールが枠追加の前に 内容合意 を求めているため）。

## 制約

- ✅ read-only。候補インベントリのみを出力する。`docs/adr/**` を書かず、`BACKLOG.md` やソースを編集せず、ADR を起票しない。
- ✅ Instruction Priority を尊重する: AGENTS.md > ADR > BACKLOG > エージェント設定。Accepted な ADR と矛盾する「意思決定」は所見であり、追認すべきものではない。
- ✅ 暫定。発見されたギャップが BACKLOG.md へ反映されたら、このスキルを削除またはアーカイブする。
- ❌ 見かけ上のギャップを埋めるために意思決定を捏造しない。実証（file:line）のあるものだけを挙げる。
