# ドキュメント運用ポリシー

ドキュメントの **canonical 言語モデル(EN canonical / JA mirror)/ ADR タクソノミー 4 分類 / `rules.md` の位置づけ / ADR の不可変性・採番ライフサイクル / per-package README 運用 / 運用スキル / 理由の単独所有** を定める。

## Status

Accepted

## v1.0.0 までの暫定運用

> **(このセクションは v1.0.0 時には消すこと)**

v1 実装期間は、下記「決定 4」の living 運用を **v1.0.0 未満まで延長**する。工程上の根拠は [v1 実装計画](../plan/v1-implementation-plan.md)。

- **ADR 本文は直接上書きしてよい** — Protected Documentation の都度承認を一時的に解除する(AGENTS.md「Temporary Operating Rules until v1.0.0」節と対をなす)
- **経緯・変遷を本文に残さない** — 「当初は X だったが Y に改訂」のような改定履歴・検討経緯を本文に書かない。決定の**現在形**だけを書く。経緯は git 履歴が持つ
- v1.0.0 到達時に本節を削除し、ADR を immutable(決定 4)へ切り替え、全 ADR 本文から経緯記述を除去する

## 背景

boilerplate のドキュメントは、日本語の読者と、英語の frontmatter や英語のツール出力を前提に動く AI エージェント・ツールの両方に読まれる。canonical を 1 つに定めないと、どちらを直せば正なのかが決まらず、2 つの版が別々に古くなる。

設計知識は性質の違う 4 種(decision / exclusion / rule / inventory)を含む。不変の記録と日々強制される制約と漂う目録を同じ文書に同居させると、目録が「根拠」の顔をしたまま腐り、制約が ADR 本文の中に埋もれて機械強制の対象にならない。分類の判定は [`docs/README.md`](../README.md) が持ち、本 ADR はそれぞれの置き場と運用を定める。

## 決定

### 1. canonical 言語モデル: 方向は EN、移行は v1

- **最終形は三層**: 英語 canonical(`docs/**/*.md`、`docs/ja/**` と `docs/portal/**`(生成ビュー)を除く)+ 日本語 mirror(`docs/ja/**/*.ja.md`、人間保守の翻訳)+ 生成 portal([0141](0141-portal-operations.md))。AI エージェントは英語 canonical を読み、`*.ja.md` は読まない
- **移行は v1.0.0 の境界で行う**。**v1.0.0 未満の間は日本語を canonical のまま living 運用**する(AGENTS.md「出力は日本語」と整合)。英語 canonical 化(既存日本語 ADR の英訳 canonical + `docs/ja/` mirror への再編)は、ADR 不可変化と**同じ v1 境界**でまとめて行う
- **v1.0.0 未満の日本語 canonical は、サフィックス無しのパス(`README.md` 等)に置き `*.ja.md` を作らない**。canonical は常にサフィックス無しのパスであり、`*.ja.md` は翻訳 mirror の名前空間だからである。v1.0.0 でサフィックス無し側を英語へ書き換え、日本語を `*.ja.md` へ移す。**リポジトリ内に英語ドキュメントが既に存在することを、他ドキュメントを英語で新設する根拠にしない**(`SKILL.md` は Claude Code が frontmatter を英語で解釈するツール要件による例外 — [0154](0154-claude-skills-operations.md))
- 移行は **`canonicalize-doc` スキル**(EN/JA ペアの生成・同期。`*.ja.md` 命名 + `docs/ja/` 並行ツリー)で実施する。翻訳追従責務 = **canonical を先に更新し翻訳が追従、canonical が常に権威**。知識を探すのも判定を当てるのも書き換えるのも canonical に対して行い、mirror を inline で直さない
- AGENTS.md Language Rules の「Documentation」はこの方針(方向は EN・v1.0.0 未満は日本語 living・移行は v1)に従う

### 2. ADR タクソノミー(4 分類)

分類の意味と判定は [`docs/README.md`](../README.md) が持つ。本 ADR が定めるのは置き場と表記である。

| 分類 | 置き場 |
| --- | --- |
| **decision** | `docs/adr/` |
| **exclusion** | `docs/adr/`(Status に `Accepted (exclusion)`、decision と混在する場合は `Accepted (一部 exclusion)` と明記。例: `Accepted (exclusion)` = [0121](0121-i18n-strategy.md) / [0130](0130-pwa-strategy.md)、`Accepted (一部 exclusion)` = [0082](0082-client-observability.md) / [0110](0110-security-operations.md) / [0131](0131-cookie-consent.md)) |
| **rule** | **`docs/rules.md`**(下記 3) |
| **inventory** | ADR には入れない。生きた参照(`docs/adr/BACKLOG.md` の枠 ID 体系を含む) |

- **exclusion** はテンプレートから作った側のセットアップ時に直接編集して独自ベースラインを敷けるものとする(supersede-by-new-ADR モデルは setup 後の変更にのみ適用)
- **ADR の decision から自然に決まるものを、別の ADR で二重に決定しない。** tooling や reference は ADR を要さず、規約に昇格するものだけを ADR 化する

### 3. `rules.md` = rule の集約先(AGENTS.md には積まない)

- **`docs/rules.md`** に rule 分類(日常強制される制約)を集約する。AGENTS.md は運用規約の集約ファイル([0152](0152-agents-md-policy.md))であって rule の置き場ではなく、そこへ rule を積むと確実に肥大化する
- 各ルールには **`> Rationale: [ADR-NNNN](...)` の逆参照リンク**を付け、「ADR = なぜ(決定)/ `rules.md` = 日々強制される制約」の役割分担を体現する

### 4. ADR の不可変性・採番ライフサイクル

- **v1.0.0 未満(pre-v1)= living document**: ADR 本文を直接上書きし、改定履歴を残さない(pre-v1 なので過去記述の破棄を許容)。この運用は本 ADR が宣言し、各 ADR の Status は写しを持たない
- **v1.0.0 から immutable**: accepted 後は Status 行のみ編集 / supersede = 本文編集ではなく新 ADR を追加し旧を superseded 化 / **番号は再利用しない**
- **採番はトピック順ブロック帯**(10 番台 = 主題ブロック。`docs/adr/README.md`)。帯の間の空き番号は将来の挿入用に予約する

### 5. per-package README 運用

- 各パッケージ / 層の **README(canonical)を正**とし、監査・実装の実行時読込元とする([0021](0021-frontend-responsibility.md)「層別 README 運用」と接続)
- README も canonical 言語モデル(上記 1)に従う(v1.0.0 未満は日本語、v1.0.0 から EN canonical + JA mirror)
- **README は親子で境界を持つ。** 子ディレクトリが自分の README を持つなら、親はその子を 1 行の digest と参照リンクに留め、中身を再帰的に展開しない。展開すると同じ内容が 2 か所に住み、片方が遅れる
- **README の実ファイル列挙をゲートにしない。** README が並べたファイル名をパースして実体と突合する検査は、README の書き方を縛るだけで腐りを防げない。構造ドリフトは `sync-readme` の判断に委ねる(下記 6)

### 6. 運用スキル

- **canonicalize-doc**(EN/JA ペア生成・同期)/ **sync-readme**(構造ドリフト検出・整合)/ **readme-review**(内容の manual-worthy 判定)を、それぞれ翻訳・構造ドリフト・内容レビューの運用に充てる([0155](0155-claude-skills-development.md) 公認の開発系スキル。配置・命名・frontmatter 規約は [0154](0154-claude-skills-operations.md) と共通)

### 7. 理由の単独所有 — 手順の文書は逆参照で済ませる

- **判断の理由は ADR が単独で持つ。** `.makefiles/README.md` / `.claude/skills/*/SKILL.md` / 層 README が書くのは **何が起きるか(挙動)と、どう使うか(手順)** だけで、なぜそれを選んだかは `> Rationale: [NNNN](...)` の逆参照で済ませる(上記 3 の `rules.md` と同じ形)
- **SKILL は単体で読まれる前提だが、自己完結させるのは手順であって理由ではない。** エージェントが操作を変えるのに要る事実(fail-closed で落ちる / ロックファイルを書かない / 承認は 1 回分)は SKILL 側に置き、**その挙動を選んだ論証は置かない**。理由は読んでも操作が変わらず、ADR を直したときに追随されないまま残る
- 判定は「**それを読まなかった読み手が違う操作をするか**」の一問による。しないなら理由であり、置き場は ADR である

## 禁止事項

- ❌ decision / exclusion を `rules.md` に、rule を ADR 本文に書くこと(タクソノミーの取り違え)
- ❌ pre-v1 の ADR に改定履歴表を積むこと(living document。直接上書き)
- ❌ v1 前に ADR を immutable 扱いして supersede-by-new-ADR を強制すること(pre-v1 は living)
- ❌ 改定の経緯・比較検討・反転の日付をドキュメント本文に書くこと(決定の現在形のみを書く。経緯は git 履歴が持つ)
- ❌ `*.ja.md`(将来の日本語 mirror)を AI エージェントの canonical 読込元にすること(v1 以降は英語 canonical を読む)
- ❌ AGENTS.md に rule を積むこと(rule は `rules.md` へ)
- ❌ 同じ理由付けを ADR と手順の文書(README / SKILL)の両方に書くこと(上記 7。手順側は逆参照だけを持つ)
- ❌ README のファイル列挙を実体と突合するゲートを置くこと(上記 5)

## 補足

- 本 ADR は [0141](0141-portal-operations.md)(portal 運用)の親決定であり、canonical → portal 生成の三層戦略の上流に立つ

## 関連 ADR

- [0152-agents-md-policy.md](0152-agents-md-policy.md) — AGENTS.md 構成方針(運用規約の集約ファイル。rule の置き場は `rules.md` に分ける)
- [0155-claude-skills-development.md](0155-claude-skills-development.md) — Claude スキル運用・開発系(canonicalize-doc / readme-review / sync-readme / portal-manifest-sync の公認。配置・命名・frontmatter は [0154-claude-skills-operations.md](0154-claude-skills-operations.md) と共通)
- [0021-frontend-responsibility.md](0021-frontend-responsibility.md) — 層別 README 運用(per-package README = 正)
- [0141-portal-operations.md](0141-portal-operations.md) — 生成 portal(本 ADR の三層戦略の第 3 層)
- [0121-i18n-strategy.md](0121-i18n-strategy.md) / [0130-pwa-strategy.md](0130-pwa-strategy.md) — exclusion ADR の実例(`Accepted (exclusion)`)
- [0082-client-observability.md](0082-client-observability.md) / [0110-security-operations.md](0110-security-operations.md) — 一部 exclusion ADR の実例(`Accepted (一部 exclusion)`)
- [`docs/README.md`](../README.md) — 4 分類の判定と行き先
- `docs/adr/BACKLOG.md` — 未決の枠 ID 体系(inventory の生きた参照)
