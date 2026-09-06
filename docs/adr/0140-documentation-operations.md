# ドキュメント運用ポリシー

ドキュメントの **canonical 言語モデル(EN canonical / JA mirror)/ ADR タクソノミー4分類 / `rules.md` 新設方針 / ADR の不可変性・採番ライフサイクル / per-package README 運用 / 運用スキル** を定める。go-boilerplate のドキュメント運用規約(go ADR 0008「docs as canonical source」/ go `docs/adr/README.md`。本リポの [0028 命名規則](0028-naming-convention.md) とは別物)を翻案する。

## Status

Accepted

（採番はブロック帯で確定(2026-07-14・0001〜0155。トピック順ブロック帯(10 番台=主題ブロック))。本 ADR の内容自体はユーザ決定済み。日付 2026-07-13。0.0.x の ADR は living document として本文を直接上書きし、改定履歴を積まない — この living 運用自体を本 ADR が定義する）

## v1.0.0 までの暫定運用

> **(このセクションは v1.0.0 時には消すこと)**

v1 実装期間は、下記「決定 4」の living 運用を **0.0.x から v1.0.0 未満まで延長**する。工程上の根拠は [v1 実装計画 §2](../plan/v1-implementation-plan.md)。

- **ADR 本文は直接上書きしてよい** — Protected Documentation の都度承認を一時的に解除する(AGENTS.md「Temporary Operating Rules until v1.0.0」節と対をなす)
- **経緯・変遷を本文に残さない** — 「当初は X だったが Y に改訂」のような改定履歴・検討経緯を本文に書かない。決定の**現在形**だけを書く。経緯は git 履歴が持つ
- v1.0.0 到達時に本節を削除し、ADR を immutable(決定 4)へ切り替え、全 ADR 本文から経緯記述を除去する(P9-3)

## 背景

AGENTS.md の Language Rules は「visible outputs は日本語」としつつ、**canonical EN / translated JA ペア運用の定義を BACKLOG D1(本 ADR)に委ねて**いた。また設計フェーズのユーザ決定によるタクソノミー(decision / exclusion / rule / inventory)・`rules.md` 新設・ADR 不可変性(0.0.x living → v1 immutable)・採番方式(ブロック帯で確定〈2026-07-14・0001〜0155〉)は方針決定済みだが未成文化だった。本 ADR がこれらを成文化する。

go-boilerplate は **英語 canonical + 日本語 mirror(`docs/ja/**/*.ja.md`)+ 生成 portal** の三層戦略(go ADR 0008「docs as canonical source」)、および ADR の immutable / supersede-by-new-ADR / NNNN 連番運用(go `docs/adr/README.md`)を確立している。本リポジトリはこれらを翻案するが、**移行タイミングは本リポの現実(現状は日本語運用)に合わせて調整**する。

## 決定

### 1. canonical 言語モデル: 方向は EN、移行は v1

- **最終目標は go ADR 0008 モデル**: 英語 canonical(`docs/**/*.md`、`docs/ja/**` と `docs/portal/**`(生成ビュー)を除く)+ 日本語 mirror(`docs/ja/**/*.ja.md`、人間保守の翻訳)+ 生成 portal(D2)。AI エージェントは英語 canonical を読み、`*.ja.md` は読まない
- **ただし移行は v1 大規模整理まで保留**する。**v1.0.0 未満の間は日本語を canonical のまま living 運用**する(現状の全 ADR・AGENTS.md「出力は日本語」と整合)。実際の英語 canonical 化(既存日本語 ADR の英訳 canonical + `docs/ja/` mirror への再編)は、採番確定・ADR 不可変化と**同じ v1 境界**でまとめて行う(ユーザ決定 2026-07-13)
- **v1.0.0 未満の日本語 canonical は、サフィックス無しのパス(`README.md` 等)に置き `*.ja.md` を作らない**。canonical は常にサフィックス無しのパスであり、`*.ja.md` は翻訳 mirror の名前空間だからである。v1.0.0 でサフィックス無し側を英語へ書き換え、日本語を `*.ja.md` へ移す。**リポジトリ内に英語ドキュメントが既に存在することを、他ドキュメントを英語で新設する根拠にしない**(`SKILL.md` は Claude Code が frontmatter を英語で解釈するツール要件による例外 — [0154](0154-claude-skills-operations.md))
- 移行時は **`canonicalize-doc` スキル**(EN/JA ペアの生成・同期。`*.ja.md` 命名 + `docs/ja/` 並行ツリー)で実施する。翻訳追従責務 = **canonical を先に更新し翻訳が追従、canonical が常に権威**(go ADR 0008 の翻案)
- AGENTS.md Language Rules の「Documentation(canonical EN / translated JA pair)」節は、本方針(方向は EN・0.0.x は日本語 living・移行は v1)で確定する(AGENTS.md 本文への反映は Protected Documentation のため、変更案の提示とユーザ承認を経て適用する — 未実施)

### 2. ADR タクソノミー(4 分類)

go `docs/adr/README.md` の 4 分類を本リポの器へ翻案する:

| 分類 | 意味 | 本リポの置き場 |
| --- | --- | --- |
| **decision** | 選択肢からの選定 | `docs/adr/` |
| **exclusion** | 意図的にやらない判断 | `docs/adr/`(Status に `Accepted (exclusion)`、decision と混在する場合は `Accepted (一部 exclusion)` と明記。例: `Accepted (exclusion)` = [0121](0121-i18n-strategy.md) / [0130](0130-pwa-strategy.md)、`Accepted (一部 exclusion)` = [0082](0082-client-observability.md) / [0110](0110-security-operations.md) / [0131](0131-cookie-consent.md)) |
| **rule** | 日常的に強制される制約 | **`docs/rules.md`(新設。下記 3)** |
| **inventory** | コードと共にドリフトする目録 | `docs/adr/BACKLOG.md` + 候補インベントリ(現行追認) |

- **exclusion** はフォークのセットアップ時に直接編集して独自ベースラインを敷けるものとする(go の `setup-review` タグ運用の翻案。supersede-by-new-ADR モデルは setup 後の変更にのみ適用)
- go は inventory を `docs/reference/dependencies.md`(living doc)に置くが、本リポは **BACKLOG.md の枠 ID 体系**を inventory の器として既に持つため、これを追認する(go にない本リポ固有要素)

### 3. `rules.md` 新設 + AGENTS.md からの rule 段階移行

- **`docs/rules.md` を新設**し、rule 分類(日常強制される制約)をここに集約する。**AGENTS.md が確実に肥大化するため**、AGENTS.md の rule を段階的に `rules.md` へ移す(段階移行でよい)
- 各ルールには **`> Rationale: [ADR-NNNN](...)` の逆参照リンク**を付け、「ADR = なぜ(決定)/ `rules.md` = 日々強制される制約」の役割分担を体現する(go `docs/rules.md` の翻案)
- 既存 ADR([0021](0021-frontend-responsibility.md) / [0028](0028-naming-convention.md))が「rule は rules.md へ段階移行」と補足しているものは、`rules.md` 新設時にそちらへ移す
- **[0152](0152-agents-md-policy.md)(AGENTS.md 構成方針)の「AGENTS.md = 規約集約ファイル」該当節との整合(supersede / 追記)が必要**。0152 は Accepted・Protected Documentation のため、変更案の提示とユーザ承認を経て適用する(未実施)

### 4. ADR の不可変性・採番ライフサイクル

- **v1.0.0 未満(pre-v1)= living document**: ADR 本文をクリーンに直接上書きし、設計フェーズの逐次改定を改定履歴に残さない(pre-v1 なので過去記述の破棄を許容)。各 ADR の Status 注記がこの運用を宣言している
- **v1 凍結時から go モデルへ移行**: immutable(accepted 後は Status 行のみ編集)/ supersede = 本文編集ではなく新 ADR を追加し旧を superseded 化 / **NNNN 連番・番号は再利用しない**(go `docs/adr/README.md` の翻案)
- **採番方式は確定済み(2026-07-14 にブロック帯採番〈0001〜0155、トピック順ブロック帯〉へ移行完了。`docs/adr/README.md` の採番記述も更新済み)**。残る EN 化・ADR 不可変化は v1 大規模整理で行う(EN 化・不可変化を同じ v1 境界でまとめて)

### 5. per-package README 運用

- 各パッケージ / 層の **README(canonical)を正**とし、監査・実装の実行時読込元とする([0021](0021-frontend-responsibility.md)「層別 README 運用」と接続。go の per-package README ペア方式の翻案)
- README も canonical 言語モデル(上記 1)に従う(0.0.x は日本語 living、v1 で EN canonical + JA mirror)

### 6. 運用スキル

- **canonicalize-doc**(EN/JA ペア生成・同期)/ **sync-readme**(構造ドリフト検出・整合)/ **readme-review**(内容の manual-worthy 判定)を、それぞれ翻訳・構造ドリフト・内容レビューの運用に充てる([0155](0155-claude-skills-development.md) 公認の開発系スキル。配置・命名・frontmatter 規約は [0154](0154-claude-skills-operations.md) と共通。移植済)

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
- ❌ AGENTS.md に rule を無制限に積み増すこと(肥大化回避。`rules.md` 新設後は段階移行)
- ❌ 同じ理由付けを ADR と手順の文書(README / SKILL)の両方に書くこと(上記 7。手順側は逆参照だけを持つ)

## 補足

- 本 ADR は D2([0141](0141-portal-operations.md) portal 運用)の親決定であり、canonical → portal 生成の三層戦略の上流に立つ
- `rules.md` 新設・AGENTS.md rule 移行・0152 整合・英語 canonical 化は、いずれも本 ADR Accepted 後の後続作業(段階移行 / v1 大規模整理)。本 ADR は方針を確定する

## 関連 ADR

- [0152-agents-md-policy.md](0152-agents-md-policy.md) — AGENTS.md 構成方針(「AGENTS.md = 規約集約」との整合が rule 移行時に必要)
- [0155-claude-skills-development.md](0155-claude-skills-development.md) — Claude スキル運用・開発系(canonicalize-doc / readme-review / sync-readme / portal-manifest-sync の公認。配置・命名・frontmatter は [0154-claude-skills-operations.md](0154-claude-skills-operations.md) と共通)
- [0021-frontend-responsibility.md](0021-frontend-responsibility.md) — 層別 README 運用(per-package README = 正)
- [0141-portal-operations.md](0141-portal-operations.md)(D2)— 生成 portal(本 ADR の三層戦略の第 3 層)
- [0121-i18n-strategy.md](0121-i18n-strategy.md) / [0130-pwa-strategy.md](0130-pwa-strategy.md) — exclusion ADR の実例(`Accepted (exclusion)`)
- [0082-client-observability.md](0082-client-observability.md) / [0110-security-operations.md](0110-security-operations.md) — 一部 exclusion ADR の実例(`Accepted (一部 exclusion)`)
- `docs/adr/BACKLOG.md` — inventory の器(枠 ID 体系)
