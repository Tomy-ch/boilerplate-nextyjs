# ドキュメント運用ポリシー

ドキュメントの **canonical 言語モデル(EN canonical / JA mirror)/ ADR タクソノミー 4 分類 / `rules.md` の位置づけ / ADR の不可変性・採番ライフサイクル / per-package README 運用 / 運用スキル / 理由の単独所有** を定める。

## Status

Accepted

## v1.0.0 までの暫定運用

> **(このセクションは v1.0.0 時には消すこと)**

v1.0.0 未満の間は、下記「決定 4」の living 運用が効いている。

- **ADR 本文は直接上書きしてよい** — Protected Documentation の都度承認を解除する(AGENTS.md「Temporary Operating Rules until v1.0.0」節と対をなす。編集許可のいまの形と最終形は [0152](0152-agents-md-policy.md) が持つ)
- **経緯・変遷を本文に残さない** — 「当初は X だったが Y に改訂」のような改定履歴・検討経緯を本文に書かない。決定の**現在形**だけを書く。経緯は git 履歴が持つ
- v1.0.0 到達時に本節を削除する。切替の条件と手順は決定 4 が持ち、本節に依存しない

## 背景

boilerplate のドキュメントは、日本語の読者と、英語の frontmatter や英語のツール出力を前提に動く AI エージェント・ツールの両方に読まれる。canonical を 1 つに定めないと、どちらを直せば正なのかが決まらず、2 つの版が別々に古くなる。

設計知識は性質の違う 4 種(decision / exclusion / rule / inventory)を含む。不変の記録と日々強制される制約と漂う目録を同じ文書に同居させると、目録が「根拠」の顔をしたまま腐り、制約が ADR 本文の中に埋もれて機械強制の対象にならない。分類の判定は [`docs/README.md`](../README.md) が持ち、本 ADR はそれぞれの置き場と運用を定める。

## 決定

### 1. canonical 言語モデル: 方向は EN、移行は v1

- **最終形は三層**: 英語 canonical(`docs/**/*.md`、`docs/ja/**` と `docs/portal/**`(生成ビュー)を除く)+ 日本語 mirror(`docs/ja/**/*.ja.md`、人間保守の翻訳)+ 生成 portal([0141](0141-portal-operations.md))。AI エージェントは英語 canonical を読み、`*.ja.md` は読まない
- **移行は v1.0.0 の境界で行う**。**v1.0.0 未満の間は日本語を canonical のまま living 運用**する(AGENTS.md「出力は日本語」と整合)。英語 canonical 化(既存日本語 ADR の英訳 canonical + `docs/ja/` mirror への再編)は、ADR 不可変化と**同じ v1 境界**でまとめて行う
- **v1.0.0 未満の日本語 canonical は、サフィックス無しのパス(`README.md` 等)に置き `*.ja.md` を作らない**。canonical は常にサフィックス無しのパスであり、`*.ja.md` は翻訳 mirror の名前空間だからである。v1.0.0 でサフィックス無し側を英語へ書き換え、日本語を `*.ja.md` へ移す。**リポジトリ内に英語ドキュメントが既に存在することを、他ドキュメントを英語で新設する根拠にしない**。例外は 2 つだけで、どちらも別の ADR が理由を持つ: `SKILL.md`(Claude Code が frontmatter を英語で解釈するツール要件 — [0154](0154-claude-skills-operations.md))と `AGENTS.md`(エージェントの理解精度 — [0152](0152-agents-md-policy.md))。**この 2 つは v1.0.0 未満でも兄弟の `*.ja.md` を持つ** —— 上の禁止は「日本語 canonical の隣に mirror を作るな」であり、canonical が英語である側には掛からない。読めない規約は守らせられないので、対訳は在るほうが正しい
- 移行は **`canonicalize-doc` スキル**(EN/JA ペアの生成・同期。`*.ja.md` 命名 + `docs/ja/` 並行ツリー)で実施する。翻訳追従責務 = **canonical を先に更新し翻訳が追従、canonical が常に権威**。知識を探すのも判定を当てるのも書き換えるのも canonical に対して行い、mirror を inline で直さない
- **ワークフロー定義(`.github/workflows/**` と `.github/actions/**`)のコメントは英語で書く**(日本語規則の例外)。ワークフローは公開 boilerplate のうち**外から最も読まれる部分**である —— 上流のバグ報告へ貼られ、テンプレートから作った側が最初に手を入れる場所であり、外の読み手が判断に使うハードニングの根拠(SHA ピン / 最小 permissions / fail-closed。[0153](0153-ci-configuration.md))を載せている。加えて英語しか出さない道具の出力(`actionlint` / `shellcheck`)と直に並ぶ。`.github/` のそれ以外(issue / PR テンプレート・`settings/`・道具の設定)は日本語規則に従う —— 定義ではないものは道具の出力と並ばない
- AGENTS.md Language Rules の「Documentation」はこの方針(方向は EN・v1.0.0 未満は日本語 living・移行は v1)に従う

### 2. ADR タクソノミー(4 分類)

分類の意味と判定は [`docs/README.md`](../README.md) が持つ。本 ADR が定めるのは置き場と表記である。

| 分類 | 置き場 |
| --- | --- |
| **decision** | `docs/adr/` |
| **exclusion** | `docs/adr/`(Status に `Accepted (exclusion)`、decision と混在する場合は `Accepted (一部 exclusion)` と明記。例: `Accepted (exclusion)` = [0121](0121-i18n-strategy.md) / [0130](0130-pwa-strategy.md)、`Accepted (一部 exclusion)` = [0082](0082-client-observability.md) / [0110](0110-security-operations.md) / [0131](0131-cookie-consent.md)) |
| **rule** | **`docs/rules.md`**(下記 3) |
| **inventory** | ADR には入れない。家は [`docs/reference/`](../reference/README.md) —— コードに追随して変わる目録で、正はコード側、書き換えは対象のコードと同じ変更の中で行う。目録は根拠を持たず、選定の理由は ADR へリンクするだけ |

- **exclusion** はテンプレートから作った側のセットアップ時に直接編集して独自ベースラインを敷けるものとする(supersede-by-new-ADR モデルは setup 後の変更にのみ適用)
- **ADR の decision から自然に決まるものを、別の ADR で二重に決定しない。** tooling や reference は ADR を要さず、規約に昇格するものだけを ADR 化する

### 3. `rules.md` = rule の集約先(AGENTS.md には積まない)

- **`docs/rules.md`** に rule 分類(日常強制される制約)を集約する。AGENTS.md は運用規約の集約ファイル([0152](0152-agents-md-policy.md))であって rule の置き場ではなく、そこへ rule を積むと確実に肥大化する
- 各ルールには **`> Rationale: [ADR-NNNN](...)` の逆参照リンク**を付け、「ADR = なぜ(決定)/ `rules.md` = 日々強制される制約」の役割分担を体現する

### 4. ADR の不可変性・採番ライフサイクル

- **v1.0.0 未満(pre-v1)= living document**: ADR 本文を直接上書きし、改定履歴を残さない(pre-v1 なので過去記述の破棄を許容)。この運用は本 ADR が宣言し、各 ADR の Status は写しを持たない
- **v1.0.0 から immutable**: accepted 後は Status 行のみ編集 / supersede = 本文編集ではなく新 ADR を追加し旧を superseded 化 / **番号は再利用しない**
- **採番はトピック順ブロック帯**(10 番台 = 主題ブロック。`docs/adr/README.md`)。帯の間の空き番号は将来の挿入用に予約する

**切替の条件は v1.0.0 のリリースそのもの**である。`release/v1.0.0` を切る変更で行い、ADR ごとに時期をずらさない —— 一部だけを immutable にすると、どの ADR が上書きしてよいのかを Status の外に持つことになる。

切替時に行うこと:

1. 全 ADR 本文から経緯・比較検討・反転の記述を除き、決定の現在形だけにする(禁止事項の「経緯を書かない」を、living 期間に混入した分まで遡って適用する)
2. 本 ADR の「v1.0.0 までの暫定運用」節と、AGENTS.md の「Temporary Operating Rules until v1.0.0」節を削除する
3. `.claude/settings.json` の `permissions.deny` に Accepted ADR 本文(`Edit(docs/adr/*-*.md)` / `Write(docs/adr/*-*.md)`)を足す。編集許可の最終形と復元手順は [0152](0152-agents-md-policy.md) が持ち、同じ変更で行う
4. 決定 1 の canonical 言語の移行(EN canonical + `*.ja.md` mirror)を同じ境界で行う
5. `docs/plan/**` を削除する —— この状態を生んだ計画であって、状態そのものではない。計画は v1.0.0 より前に閉じ、もっと早く閉じることもある。決めたことはその時点で ADR に在り、残るのは git が既に持つ履歴である

以後の変更は supersede だけになる —— 新 ADR を起票し、旧 ADR は Status 行を `Superseded by NNNN` へ書き換える。

強制手段: 3 は Claude Code の `deny`(届かない範囲は [0152](0152-agents-md-policy.md))。immutable な本文が Status 行以外で動いていないことは、`docs/adr/*-*.md` の差分を Status 行に限定する CI 検査として書ける —— 寄せられるが未実装。1 の「経緯かどうか」は文の意味判断で、機械へは寄せられない(レビューが見る)

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
- [`docs/reference/README.md`](../reference/README.md) — inventory の家(コードに追随する目録の契約)
