# セキュリティ運用

<!-- boilerplate-only:replace-begin -->
**依存更新(Dependabot + cooldown)/ 秘密スキャン(gitleaks)/ 脆弱性スキャン(Trivy fs 二段・OSV 二段・CodeQL・Opengrep)/ 依存監査ゲート / 依存差分ゲート / データフロー検査 / サプライチェーン姿勢の計測 / SECURITY.md / 多層防御** を定める。コンテナ配送を前提とする機構は no-Docker([0011](0011-no-docker.md))のため対象外とし、exclusion として記録する。Actions の SHA ピンは CI ハードニング側の主題であり [0153](0153-ci-configuration.md) が持つ。
<!-- boilerplate-only:replace-with -->
<!-- = **依存更新(Dependabot + cooldown)/ 秘密スキャン(gitleaks)/ 脆弱性スキャン(Trivy fs 二段・OSV 二段・Opengrep)/ 依存監査ゲート / 依存差分ゲート / データフロー検査 / サプライチェーン姿勢の計測 / SECURITY.md / 多層防御** を定める。コンテナ配送を前提とする機構は no-Docker([0011](0011-no-docker.md))のため対象外とし、exclusion として記録する。Actions の SHA ピンは CI ハードニング側の主題であり [0153](0153-ci-configuration.md) が持つ。 -->
<!-- boilerplate-only:replace-end -->

## Status

Accepted (一部 exclusion)

## 背景

守る対象は 4 つに分かれる —— 取り込む依存 / 履歴に載る秘密 / 自分が書いたコード / CI 定義とリポジトリ自身の設定。どれも他の層の道具では見えないため、**多層防御**(SAST + 秘密スキャン + 依存脆弱性 + 差分ゲート)として層ごとに持ち、層ごとに「落とす / 見せるだけ」を決める。依存追加時の `pnpm audit` は [0004](0004-library-management.md) が定め、本 ADR はその CI ゲート側を確定する。

## 決定

### 1. 依存更新 = Dependabot + cooldown(Renovate 不採用)

- **Dependabot を採用**する(Renovate は不採用)。cooldown(更新 PR を出すまでの待機日数)を semver 別に設定する:
  - **patch = 5 日 / minor = 7 日 / major = 30 日**(default 5 日)。`github-actions` エコシステムは default 5 日
  - **セキュリティアップデートは cooldown をスキップ**して即時 PR
- エコシステムは **`npm`**(+ `github-actions`)。1 エコシステム = 1 グループ PR、open PR 上限・週次。major 更新は別 PR([0004](0004-library-management.md) と一致)

#### 1.1 mise 管理ツールの cooldown(手動 pin)

`mise.toml`([0003](0003-version-manager.md))の pin は Dependabot の対象外で、bump は手作業になる。**同じ検疫原則を適用する**: 窓は blast radius ではなく**上流の検知レイテンシ**に比例させる。悪意ある版が公開されてから撤回されるまでの時間を待つのが目的であり、そのツールが何を壊しうるかとは別の話である。

- **PyPI(`pipx:` backend)= 7 日**。npm と同じ根拠で導く(公開レジストリで、悪性パッケージの検知・撤回が同程度の速さで回る)
- **GitHub Releases(`aqua:` / `ubi:` backend)= 14 日**。Actions の pin(`ACTIONS_PIN_MIN_AGE_DAYS`・[0153](0153-ci-configuration.md))と配布経路が同じで、検知レイテンシも揃うため同じ窓を当てる
- bump では「最新」ではなく**「窓を満たす最新」**を採る。窓のために意図的に 1 つ前を採った pin は、その旨を `mise.toml` のコメントに書く(でないと次の担当者が「古い pin」として無条件に上げる)
- **検疫が買うのは時間であって、版の年齢の証明ではない。** 読めるのは release の公開日時と commit の日付だけで、どちらも解決した SHA そのものを語らず、両方揃えても意図した公開者には破れる。窓は自動化された侵害に対する遅延であり、保証ではない
- 窓の実装は `tools-upgrade` スキルの `min_age_days`

**エージェントスキルを配布するツールは審査項目が 1 つ増える**。ライブラリはビルド成果物に載るが、この種のツールは**開発者の権限で動き、何をマシン外へ送るかを自分で決める**。したがって pin の bump 時は版番号だけでなく、次の 2 つもレビュー対象とする。

- **CLI 表面の変化** — 上流がサブコマンドを足せば、`.claude/settings.json` の deny が塞いでいるつもりの範囲が黙って穴になる。deny をプラットフォーム名の列挙ではなくパターンで書くのはこのためである([0154](0154-claude-skills-operations.md) 外部スキル)
- **ツールの挙動を書き写したドキュメントとの整合** — `.claude/README.md` は既定値・API を呼ぶ経路・撤去手順を pin された版の事実として書いている。版が動けば同じ場所が古くなる

### 2. 秘密スキャン = gitleaks(fail-closed)

- **gitleaks** で秘密スキャンする。検知ルールは `useDefault` を土台とする
- **pre-push([0151](0151-git-hooks.md))と CI の双方**で回す。検出時は **fail-closed**。hook と CI は同じ `make secret-scan` を呼ぶ(ローカルと CI で振る舞いを揃える)
- **走査対象は「これから送られるコミット範囲」**(`gitleaks git` + `--log-opts`)。作業ツリーのスナップショット(`gitleaks dir`)は採らない。理由は 2 つあり、いずれも**守りたい境界とずれる**ため:
  - **取りこぼす**: commit したあと作業ツリーから消した秘密は、blob として履歴に残り push される。スナップショットには映らない
  - **誤検知する**: push されない gitignore 済みファイル(`env/.env.local` 等 — [0030](0030-environment-variable-management.md))を秘密として検出する。ローカルの正当な秘密で毎回 push が止まれば `--no-verify` の常用を招き、fail-closed が形骸化する
  - リモート追跡参照が 1 つも無い状態(remote から一度も fetch していない初回 push 等)では履歴全体が対象になる。対象が広がる方向であり、取りこぼす方向ではない
- **コミット履歴全体の走査は CI の定期実行が持つ**。マージ済み履歴に埋もれた秘密を拾う用途で、コミット数に比例して伸びるため hook には載せない
- 検出値はログに出さない(`--redact`)。hook / CI のログ自体が二次的な漏洩経路になるため
- **`useDefault` は gitleaks 本体の global allowlist を同伴する**。node_modules / 各種 lockfile / `.svg` 等が無条件に走査対象外となり、これは `.gitleaks.toml` からは打ち消せない。打ち消すには全ルールを自前で持つことになり既定ルールの更新追随を失うため、**追随を優先して除外範囲を把握したうえで受け入れる**。生成型([0072](0072-api-type-generation.md))など自前の除外は、誤検知が実際に出た時点で下記の抑止ポリシーに沿って追加する

### 3. 脆弱性スキャン(多層防御)

- **CodeQL SAST**: `languages: javascript-typescript`。trigger = PR + 保護ブランチ push + 週次 cron。`security-events: write` で SARIF アップロード。high-severity はマージブロック(ブロックの実体は branch protection / code scanning の required 設定側。workflow 内の hard-fail には依存しない) <!-- boilerplate-only:line -->
- **portable SAST(Opengrep)**: SAST の既定は**リポジトリと一緒に持ち出せる実体**で持つ。GitHub の code scanning が供給する解析は **GitHub の外へ持ち出せず**、テンプレートから作った側が private かつ GHAS 無しならその層がまるごと消えるため、**同じ問いに答える持ち出せる実体**を持つ。実体は `mise.toml` にピンした 1 バイナリで、ローカルでも CI でも同じ `make sast` が回す。**Semgrep 本体ではなく OSS fork の Opengrep を採る** —— ルール記法は互換で `// nosemgrep:` の抑止もそのまま効くうえ、boilerplate が作った側へライセンス判断を渡さずに済む。**0 件の baseline を保つことがこのゲートの前提**であり、0 件だからこそ新しい所見が読み飛ばす対象ではなく信号になる。許容する所見はソースへ `// nosemgrep: <rule-id>` を理由付きで置き、判断をコードの側に残す。**検査条件(対象・ルール・除外)は 1 箇所に持つ** —— ゲートと code scanning への取り込みが違う走査を指すと、落ちた内容と Security タブの一覧が食い違う。**ルールはレジストリ(semgrep.dev)から引かない** —— レジストリの集合は Semgrep Rules License v1.0 で内部利用に限られ、**エンジンだけ OSS へ替えても、ルールをそこから引いている限りライセンスの判断は作った側へ渡る**。代わりに `opengrep/opengrep-rules` を **commit で固定**して読む。取り出す分類・digest の照合・検体を置かない取り出し方の本体は `.github/workflows/README.md` の「SAST のルールをレジストリから引かない」が持つ
<!-- boilerplate-only:replace-begin -->
- **編集時 SAST(eslint-plugin-security)**: 上の 2 つと同じ問いに、**型を解決したうえで編集中に**答える層。走査が CI にしか無いと、指摘が届くのは push の後になる。ただし **[0002](0002-formatter-linter.md) の能力ベース分担に従い、推奨プリセットは当てない** —— 束を当てれば biome と重なる規則も、この層に対象の無い規則も同時に入る。**有効化するのは 0 件の baseline を保てる規則だけ**とし、落とした規則とその理由は `eslint.config.ts` に書く(ReDoS と path traversal は Opengrep / CodeQL が引き続き担うので、落としても検査面は消えない)。落とした規則を戻すのは、その規則が形ではなく実体を見るようになったときに限る —— 例えば `detect-unsafe-regex` が量指定子の入れ子の形ではなく実際の後戻り計算量で判定するようになれば、`/^\d+(\.\d+)?$/` は鳴らなくなり 0 件を保てる。「SAST の層が薄い」は理由にならない
<!-- boilerplate-only:replace-with -->
<!-- = - **編集時 SAST(eslint-plugin-security)**: 上と同じ問いに、**型を解決したうえで編集中に**答える層。走査が CI にしか無いと、指摘が届くのは push の後になる。ただし **[0002](0002-formatter-linter.md) の能力ベース分担に従い、推奨プリセットは当てない** —— 束を当てれば biome と重なる規則も、この層に対象の無い規則も同時に入る。**有効化するのは 0 件の baseline を保てる規則だけ**とし、落とした規則とその理由は `eslint.config.ts` に書く(ReDoS と path traversal は Opengrep が引き続き担うので、落としても検査面は消えない)。落とした規則を戻すのは、その規則が形ではなく実体を見るようになったときに限る —— 例えば `detect-unsafe-regex` が量指定子の入れ子の形ではなく実際の後戻り計算量で判定するようになれば、`/^\d+(\.\d+)?$/` は鳴らなくなり 0 件を保てる。「SAST の層が薄い」は理由にならない -->
<!-- boilerplate-only:replace-end -->
- **外部解析サービス(SonarQube Cloud)**: 上のどれとも違い、**外部アカウントに依存する**唯一の層。public リポジトリでは無料、private では有料であるため、作った側が契約していないことを既定として設計する —— `SONAR_TOKEN` が未設定なら解析ジョブごと降り、**緑のまま「未設定」を PR へ述べる**(コメントの不在は「検査が緑だった」と見分けが付かない)。**required check には登録しない**。第三者のアカウントの有無がマージの条件になってはならない。さらに boilerplate の剥がし対象とする —— projectKey も organization もこのリポジトリの名前で、そのまま渡ると作った側では死んだ設定になる <!-- boilerplate-only:line -->
- **OSV 二段**: Trivy / `pnpm audit` と**参照するデータベースが違う**。件数は一致せず、下記「和集合を正とする」の実例そのものになる。二段の形は Trivy と同じで、**報告(全 PR・落とさない)と昇格ゲート(保護ブランチ宛 PR・検出で落ちる)**に割る
- **依存差分ゲート(Dependency Review)**: 上の 3 者はいずれも**木の現状**を読むため、以前から抱えている脆弱性とこの変更が持ち込んだものを区別できない。前者は報告専用のゲートが構造的に許容せざるを得ないものであり、**「この PR が増やしたか」だけを問う層**を別に置く。増やした当人は取り消せるので、ここは落として良い。閾値は依存監査ゲートと揃えて `high`。**この層はこのリポジトリの運用にだけ置く** —— 呼ぶ API が無料なのは public のときだけで、private では Code Security のライセンスを要求する。既定として配ると、テンプレートから作ったリポジトリは「金が掛かる」か「コードでは直せない赤」かのどちらかを受け取る <!-- boilerplate-only:line -->
- **データフロー検査(Bearer)**: 値が**プロセスの外(log 行 / 外向き要求 / 第三者クライアント)へ出る地点**を、その値が何かの分類と併せて見る。パターンと taint 経路はこの問いに答えない —— logger へ届いた文字列がメールアドレスであることを、どちらも知らない。**落とさない**(下記 3.2)
<!-- boilerplate-only:replace-begin -->
- **言語非依存の regex 検査(DevSkim)**: 言語フロントエンドを持たないため**全ファイルを 1 つのルールセットで読む**。Opengrep も CodeQL も自分が構文解析できる言語しか開かないので、**どちらも開かないファイル**(workflow でない YAML / JSON / 平文 / `docs/` の Markdown)にある弱い暗号名やハードコード資格情報は、他のどの層にも掛からない。**落とさない**(下記 3.2)
<!-- boilerplate-only:replace-with -->
<!-- = - **言語非依存の regex 検査(DevSkim)**: 言語フロントエンドを持たないため**全ファイルを 1 つのルールセットで読む**。Opengrep は自分が構文解析できる言語しか開かないので、**それが開かないファイル**(workflow でない YAML / JSON / 平文 / `docs/` の Markdown)にある弱い暗号名やハードコード資格情報は、他のどの層にも掛からない。**落とさない**(下記 3.2) -->
<!-- boilerplate-only:replace-end -->
- **サプライチェーン姿勢の計測(OpenSSF Scorecard)**: コードでも依存でもなく、**リポジトリ自身の設定**(ブランチ保護 / 依存のピン / token の権限 / セキュリティポリシーの有無)を測る。boilerplate は**姿勢そのものが商品**であり、作った側は宣言ファイルとセットアップ手順（`make setup-repo`）としてこれを受け取る —— **テンプレートからの生成はツリーしか写さず、ブランチ保護も token の権限も複製されない**ので、設定そのものではなく設定を適用する手順が渡る。変更ではなくリポジトリの性質なので PR では走らせず、required check にも登録しない。**公開データセットへの送信(`publish_results`)は行わない** —— リポジトリの名前に関する判断であり、技術的な判断ではないため作った側へ残す
- **Actions 定義の静的解析(zizmor)**: CI の実行内容そのものを対象にする層。アプリのコードと依存を見る上の 3 者は、`.github/**` に書かれた `run:` や権限の与え方を見ない。**hook と CI の双方**で`--offline` で走らせ、**high の所見で fail-closed**。`--min-severity` は表示も絞るので、全所見を出す実行とゲートの実行を分け、引き下げた所見が出力から消えないようにする。抑止は`.github/zizmor.yml` に理由付きで宣言し、下記 4 の抑止ポリシーに従う(検査の責務と落とし方は [0153](0153-ci-configuration.md) §1 が正)
- **Trivy fs 二段運用**:
  - **dev ゲート**(全 PR・advisory): `scan-type: fs` / `severity: CRITICAL,HIGH,MEDIUM` / **`ignore-unfixed: true`**(修正不能は無視)/ hard-fail しない + PR コメント
  - **release ゲート**(保護ブランチへの PR 限定・厳格): **`ignore-unfixed: false`**(未修正も可視化)で厳格化。**止めるのはこの一点だけ**である
- **依存監査ゲート**: **`pnpm audit` を既定**とする。到達可能性(reachability)フィルタ —— 脆弱な関数へ実際に到達するコードパスがあるものだけを blocking にする絞り込み —— は、`pnpm audit` に該当機能がなく、osv-scanner の call analysis も JS/TS 非対応のため、**現行ツールでは実装不能**である。したがって blocking 閾値は **severity(`high` / `critical`)と修正可能性(fixable)** で定める(未修正〈unfixable〉はノイズになりやすいため advisory 扱いとし、修正可能な high 以上を blocking)。運用 SLA(`high` 以上は 48 時間以内に対応着手)は [0004](0004-library-management.md) の既定を維持し、本項はその CI ゲート側の blocking 閾値を定める
- **スキャナ間で検出が食い違う場合は和集合を正とする**。Trivy fs と `pnpm audit` は集計単位(CVE 単位 / advisory 単位)も対象範囲も異なり、同一リポジトリに対して異なる件数を返す。片方だけを正とすると、そのツールが見ない領域(例: `pnpm audit` は npm advisory DB のみを見る)が恒久的な死角になる。**どちらか一方でも blocking 閾値に達したものは blocking として扱う**。両者の件数が一致しないこと自体は異常ではないため、突合して差分を潰そうとしない

#### 3.1 脆弱性スキャンを push のゲートにしない

`make trivy-fs` はローカルで手動実行できるが、**pre-push hook には接続しない**([0151](0151-git-hooks.md))。これは「今は検出件数が多いから」という状態依存の判断ではなく、**ゲートの形として成立しない**という判断である。

- **その場で解消できない**。秘密の混入は値を消して commit し直せば当事者だけで解消できる。依存の脆弱性は上流の修正版が出ていなければ解消できず、出ていても上流が推移的依存を pin していれば `pnpm.overrides` で上流の検証外の組み合わせを作るしかない。**自力で通せないゲートはゲートではなく障害物**であり、`--no-verify` の常用を教育する(これは [0151](0151-git-hooks.md) が禁じている状態そのもの)
- **変更と独立に状態が変わる**。CVE が公開されれば、コードを 1 行も変えていない push が昨日と違う結果になる。**変更を対象とするゲートに、変更と無関係に変動する信号は載せられない**
- **判断する権限がその場に無い**。「この脆弱性を抱えたまま出す」は誰かが引き受けるべき判断であり、それが成立するのは昇格(保護ブランチ宛 PR)の場面だけである。push は判断の場ではない

同じ理由で、脆弱性の報告先は **PR コメント**とする。hook の出力はレビューされず記録も残らないため、報告としても機能しない。

秘密スキャンが逆にすべての条件を満たす(その場で解消でき、変更と共に決まり、判断の余地が無い)ことが、両者の扱いが違う理由である。

### 3.2 落とさない層を置く判断

**すべての層をゲートにしない。** ゲートにしてよいのは、**baseline を 0 件に保てるか、あるいは「この変更が増やしたか」だけを問う**層に限る。それ以外を赤にすると赤が常態になり、赤を見て手を止める習慣のほうが先に壊れる。

したがって層は 3 つの配線に分かれる。

| 配線 | 該当 | 何が赤にするか |
| --- | --- | --- |
| **ゲート** | gitleaks / Opengrep / eslint-plugin-security / 依存監査 / Trivy・OSV の昇格側 | job 自身の exit code |
| **ゲート** | Dependency Review | job 自身の exit code <!-- boilerplate-only:line --> |
| **報告専用** | Trivy・OSV の報告側 | 何も赤にしない(スキャナが走らなかったときだけ落ちる) |
| **code scanning へ送る** | Bearer / DevSkim | **その変更が新しく持ち込んだ所見**に対する GitHub 側の差分チェック |
| **code scanning へ送る** | CodeQL / SonarQube Cloud | 同上 <!-- boilerplate-only:line --> |

3 つ目は「落とさない」と「見せない」を分けるための配線である。job は緑を返すが、**差分が持ち込んだ alert は PR を赤にする**。baseline を 0 件にできない層 —— 誤検知の傾向が強く、0 へ寄せるには規則単位の無効化が要る層 —— はここに置く。規則単位の無効化は下記 3.4 が禁じている。

### 3.3 スケジュールがあるから PR を絞れる

Security グループは**週次スケジュール + 差分が届く PR** で走る。週次があるのは、コードが 1 行も動いていないツリーに対しても CVE が公開されうるためで、変更を入口にした検査だけでは届かない。

**そして週次があるからこそ、PR 側は絞れる。**各 job は差分が自分に届くかを判定して降りる([0153](0153-ci-configuration.md) §5)。**絞りの意味は「走査が消える」ではなく「週次へ回る」**であり、週次を止めればこの絞りは成立しなくなる。判定を書き漏らしても失うのは最大 1 週間で、恒久の死角にはならない。Security グループの job を required check に登録していないことも前提の一つで、降りても PR は止まらない。

**降りてよい層と降りてはいけない層がある。**

| 層 | 降りるか | 理由 |
| --- | --- | --- |
| 報告専用(Trivy / OSV の報告側) | 降りる | lockfile が動いていなければスキャナの答えは変わらない |
| 依存監査ゲート(`pnpm audit`) | 降りる | base から引き継いだ判定は変更の作者がその場で解消できない(上記 3.1) |
| 昇格ゲート(Trivy / OSV の release 側) | **降りない** | 昇格はツリーの現状を誰かが引き受ける場面であり、その PR の差分が lockfile に触れていないことは、ツリーが持つ脆弱性を引き受けない理由にならない |
| code scanning へ送る層(3.2 の 3 つ目の配線) | **層ごとに別に決める** | alert を閉じるのは GitHub 側で、「後の解析がもう報告しない」ことでしか閉じない。降りた PR では閉じる契機が週次まで遅れる —— 判定を GitHub 側へ預けている層は、他の層と同じ差分判定で降ろす前に、その遅れを引き受けてよいかをその層について問う |
| CodeQL | **降りない** | code scanning の alert は「後の解析がもう報告しない」ことでしか閉じない。走行回数を減らすと閉じる契機を落としうる <!-- boilerplate-only:line --> |

### 3.4 抑止(ignore)ポリシー

スキャナの検出を許容する手段は、専用の抑止ファイルに限定する。全ファイルの冒頭に同じポリシーを明記し、様式を揃える。

| ファイル | 抑止の単位 |
| --- | --- |
| `.gitleaks.toml` | 検知ルールセットとパス単位の allowlist |
| `.gitleaksignore` | 検出 1 件(フィンガープリント `<path>:<rule-id>:<line>`) |
| `.trivyignore.yaml` | 脆弱性 ID 1 件(`paths` でパスを限定) |
| `osv-scanner.toml` | 脆弱性 ID 1 件(`reason` が必須)。**フィルタした所見をツールが理由付きで出力へ残す**ため、抑止と黙殺が見分けられる |
| `sonar-project.properties` | ルール 1 件 × パスの組(`sonar.issue.ignore.multicriteria`)。**SonarCloud は hotspot を UI で review する仕組みを持つが、それはリポジトリの外に決定を置く** —— 作った側が同じ判断を引き継げないので、リポジトリが持つ抑止はこのファイルに限る <!-- boilerplate-only:line --> |
| `bearer.ignore` | 検出 1 件(フィンガープリント)。`comment` に理由を書く。**JSON なので冒頭のポリシー明記が置けない** —— 様式は `bearer ignore add` が決め、理由は各エントリが持つ |
| `.github/zizmor.yml` | ファイル 1 件(`ignore`)。**ファイルで絞れない audit は severity の remap(監査 ID 単位)** —— composite action は全て `action.yaml` で、`ignore` はベース名一致のため 1 つ挙げると全ての composite action が黙る(zizmor 1.29.0 の制約。ファイル単位の remap が入ったら remap は撤回する) |

- **ソース側の抑止は行 1 件に限る**。`// nosemgrep: <rule-id>`(Opengrep) と `// DevSkim: ignore <rule-id>`(DevSkim) は、抑止ファイルを持たないスキャナの様式であり、**規則 1 件 × 行 1 件**まで絞れるためこのポリシーを満たす。理由はその場に書く。**DevSkim は所見と同じ行に置いたものしか読まない** —— 直前の行へ置くと黙って効かず、抑止したつもりの所見が Security タブに残り続ける
- **抑止した所見を code scanning へ渡さない**。Opengrep は `// nosemgrep:` で消した所見を SARIF には `suppressions` 付きで残し、GitHub はそれを閉じた alert として扱わない。渡すと**ゲートは緑のまま Security タブにだけ所見が積み上がり**、上記 3 の「落とさない」と「見せない」の分離が、意図しない側へ崩れる。取り込みの手前で落とす(`scripts/sarif`)
- **ルールやスキャナの一括無効化は禁止**。抑止はファイル単位 or フィンガープリント単位に限定する。範囲を絞らない抑止は、同じ検知を踏む**新規のファイル・依存まで素通りさせる**
- **ファイル単位に絞れないときは、抑止ではなく severity の引き下げに留める**。上の禁止が守ろうとしているのは「新規のものが黙って素通りする」ことを避ける点にあり、引き下げなら検査は走り続け、ゲートを抜けるだけである。**そのためには引き下げた所見が出力に残っていなければならない** —— 残らないなら、これは抑止と区別が付かない。ツールがファイル単位を持たないことがこれを選ぶ唯一の理由であり、**撤回条件（ツールが対応したら戻す）をその場に書く**
- **各エントリに理由を必ず書く**(gitleaks は「なぜ秘密でないか」、Trivy は `statement`)。理由を書けないものは抑止せず、値そのものを消すか依存を上げる
- **条件が変われば削除する**。恒久 allowlist にしない。**週に一度、宣言を条件へ突き合わせる**(`make suppression-expiry` / `.github/workflows/suppression-expiry.yaml`)。条件の日付は日本時間の暦日で書き、突き合わせも同じ暦日で判定する(時刻は持ち込まない —— UTC で取ると日付をまたぐ時間帯の実行だけ判定が 1 日ずれる)。**見る機構が無いと、期限を過ぎた宣言が残り続け、次に同じ枠を使う人が期限そのものを軽く扱う。****限界が 2 つあり、報告はそれを明示する。** 機械が決められるのは日付だけなので全件の一覧を伴う —— 「上流が N 以上を要求したら」のように決められない条件を黙って落とすと、条件を書いた意味が消える。**理由をコメントに書く様式の面(上表の `.gitleaks.toml` / `.gitleaksignore` / `.github/zizmor.yml`、および `pnpm-workspace.yaml` の冷却期間と override)は宣言単位では読めない** —— パーサがコメントを落とすため、日付を含む行だけが出る
- 抑止の妥当性そのものはレビュー時の人間判断に残る。機械が強制できるのは「抑止が上記の様式に載っていること」までである
- **本ポリシーが及ぶのは自リポジトリが書いた抑止だけ**である。gitleaks の `useDefault` が同伴する global allowlist(上記 2 参照)や Trivy 本体の既定除外はツール側に埋め込まれており、ここには現れない。**「抑止ファイルが空 = 何も除外されていない」ではない**

<!-- boilerplate-only:begin -->
**SonarQube Cloud はこの様式の例外で、抑止の理由をリポジトリの他の場所へ書かない。** 上記 3 のとおりこの層は剥がしの対象であり、`sonar-project.properties` と `.github/workflows/sonarcloud.yaml` は作った側の初期化で消える。理由をそれ以外——ソースのコメントや、剥がしを生き延びる文書——へ置くと、**指摘した規則ごと消えたあとに理由だけが残り、何の話をしているのか誰にも辿れなくなる**。

この検査の所見に応じてコードの形を変えるときも同じで、**規則名も「Sonar がこう言った」もコメントに書かない**。残す価値のある制約なら、規則を名指しせずにその場の性質として書けるはずで、書けないならそれは抑止ファイルだけが持つべき理由である。
<!-- boilerplate-only:end -->

### 3.5 CSP 適合ゲート

- **配信ヘッダが [0111](0111-csp-security-headers.md) の宣言と一致することを CI で検査する**。ビルド成果物 / 起動したアプリのレスポンスヘッダを取得し、CSP と主要セキュリティヘッダの有無・値を宣言と突合して fail-closed にする
  - > Rationale: [0111](0111-csp-security-headers.md)
- 対象は CSP と、0111 が定める同伴ヘッダ(`Strict-Transport-Security` / `X-Content-Type-Options` / `Referrer-Policy` / `Permissions-Policy` 等)。**検査するのは「宣言と実配信の一致」**であり、ヘッダの内容そのものは 0111 が正
- 実装は [0153](0153-ci-configuration.md) の Security グループに 1 job として置く
- **手段は OWASP ZAP の baseline 走査**。ランナーの中にしか存在しないアプリを撃てるのは、ランナーの中から走る DAST だけである。api-scan ではなく baseline を採るのは、本リポが表示層で API を別リポジトリが持ち、OpenAPI 駆動の走査に撃つ先が実質無いことによる
- **公式の `zaproxy/action-*` は使わない**。`docker_name` が受け取るのは tag であって digest であり、本リポは container image を digest で固定して `make images-pin-check` で突合する([0011](0011-no-docker.md))が、action の input はその走査対象に入らない。**固定したつもりで誰も検査していないピンを増やさない**
- **ブラウザ側の違反検知は E2E の見張りが持つ**。ZAP が読むのはヘッダであり、そのヘッダをブラウザが enforce した結果(宣言に無い読み込みが拒まれたこと)は実ブラウザでしか出ない。`e2e/lib/test.ts` が `securitypolicyviolation` を全 spec で数え、enforce されていることは宣言に無い配信元を差して違反が報告されることで示す(`e2e/journeys/csp.spec.ts`)。ヘッダの検査と違反の検知は別の事実で、片方だけでは閉じない
- **ゲートは実装より先に置き、既知の欠落は一覧で持つ**。恒常的に赤い必須チェックは全 PR を止め、その一覧を縮める PR 自身も止めるため、いま出ている所見だけを `.github/zap/rules.tsv` へ理由と撤回条件つきで並べ、**一覧に無い所見を赤にする**。ZAP は `IGNORE` にした規則も件数・規則名・URL を出力へ残すので、下記 3.4 の「引き下げた所見が出力に残っていること」を満たす。**測る側を後から入れると、測る側の導入が実装の完了に従属し、何が足りないかの一覧が最後まで手に入らない**
- **CI の配備は、同梱するタグマネージャの容器 ID を空にして起動する(exclusion)**。配信元を `script-src` へ足し `Cross-Origin-Embedder-Policy` を降ろす分岐([0131](0131-cookie-consent.md) §2 / [0111](0111-csp-security-headers.md) §3)は、e2e でも DAST でも踏まれない。**CI から外部の配信元を叩かせないための選択である** —— 実在の容器を撃つ検査を置くと、外部の可用性と容器の中身の変更が CI の色に混ざる。ヘッダの組み立てと読み込みの strategy は単体テストが両方の配備で固定し、担保されていないのは組み立てたヘッダが実ブラウザで宣言どおり効くことだけである。撤回条件は、外部へ出ずに CSP の enforce を確かめる手段(配信元を差し替えられる形の検査など)が入ったとき

### 4. SECURITY.md

- **`SECURITY.md` を置く**。脆弱性報告フロー(Private Vulnerability Reporting 誘導 / 連絡先 / Supported Versions)を定める(連絡先は作った側で差し替える placeholder)
- release artifact の検証(cosign / provenance / SBOM)は、配送成果物がコンテナイメージでないため**含めない**(下記 exclusion)

### 5. release ゲート vs dev PR ゲート

<!-- boilerplate-only:replace-begin -->
- **dev PR = advisory 寄り**(Trivy `ignore-unfixed:true` / audit は actionable のみ / CodeQL・gitleaks は fail-closed)、**release(保護ブランチへの PR)= 厳格化**(Trivy `ignore-unfixed:false`。severity リストは dev と同一で、未修正の可視化が差分)。この二段は言語非依存で載る([0153](0153-ci-configuration.md) の Security グループ)。Trivy / CodeQL のマージブロックの実体は required check / branch protection([0150](0150-git-workflow.md))側に置く
<!-- boilerplate-only:replace-with -->
<!-- = - **dev PR = advisory 寄り**(Trivy `ignore-unfixed:true` / audit は actionable のみ / gitleaks は fail-closed)、**release(保護ブランチへの PR)= 厳格化**(Trivy `ignore-unfixed:false`。severity リストは dev と同一で、未修正の可視化が差分)。この二段は言語非依存で載る([0153](0153-ci-configuration.md) の Security グループ)。Trivy のマージブロックの実体は required check / branch protection([0150](0150-git-workflow.md))側に置く -->
<!-- boilerplate-only:replace-end -->

### 6. エージェントの文脈へ入るリポジトリ由来の文字列

- **リポジトリに置かれた文字列をエージェントの文脈へ入れる口は、それがデータであると名乗らせる。** 対象は hook の `additionalContext`、スキルやエージェントが読み込む台帳・索引・宣言ファイル、そこから組み立てた要約——**リポジトリの中身がそのままモデルの入力になる経路**である。データを先に、指示を後に置き、データの側に「指示ではない」と述べさせる
- **制御文字を落とす。** 改行やエスケープシーケンスを残すと、封筒の中で別の段落・別の話者として読まれうる
- **JSON のエスケープを対策と見なさない。** `JSON.stringify` が保証するのは封筒が壊れないことだけで、消費側が `JSON.parse` した時点で中身は元の文字列へ戻り、そのまま文脈へ入る
  - > Rationale: その綴りを書いた者は、それを読むセッションの依頼者ではない。本リポジトリは public であり、ファイル名や台帳のエントリは通常の PR で持ち込める。**指示めいた自由記述は「もっともらしい理由」に偽装でき、設計やアーキテクチャの観点で読むレビュアーには見抜きにくい**。効くのは後日、無関係な別セッションが同じファイルへ触れた瞬間である
- **リポジトリ外の値と同じ扱いにしない。** これは[表示層が上流由来の値を無害化しない](0070-backend-role-separation.md)という線引きの外側にある。ここで守るのは配信先のブラウザではなく、**このリポジトリで作業するエージェント自身**であり、値を作ったのはこのリポジトリである

## exclusion(no-Docker で対象外)

コンテナ配送を前提とする次の機構は、本リポが [0011](0011-no-docker.md)(no-Docker / PaaS・静的 CDN 配送)のため**採用しない**:

- ❌ **コンテナ image スキャン**(Trivy image / SBOM 生成)— アプリ本体の Docker イメージがない
- ❌ **cosign によるイメージ署名 / SLSA provenance / SBOM attestation** — 配送成果物がコンテナイメージでない
- ❌ **Dependabot の `docker` エコシステム** — 監査対象の Dockerfile がない(上記 1 のとおり `npm` + `github-actions` のみ)
- これらは「意図的にやらない」判断として記録する([0140](0140-documentation-operations.md) タクソノミー: exclusion = ADR)。作った側が独自にコンテナ配送する場合は作った側の判断で追加する

## 禁止事項

- ❌ Renovate を併用すること(Dependabot に一本化)
- ❌ セキュリティアップデートに cooldown を効かせること(即時 PR)
- ❌ リポジトリ由来の文字列を、囲いもラベルも無くエージェントの文脈へ連結すること
<!-- boilerplate-only:replace-begin -->
- ❌ gitleaks / CodeQL の検出を fail-closed にしないこと(秘密・SAST high は必ずブロック)
<!-- boilerplate-only:replace-with -->
<!-- = - ❌ gitleaks の検出を fail-closed にしないこと(秘密は必ずブロック) -->
<!-- boilerplate-only:replace-end -->
- ❌ 依存監査を「全 severity 一律 hard-fail」にすること(修正可能な `high` / `critical` のみ blocking = ノイズ抑制。到達可能性フィルタは JS/TS では実装不能)
- ❌ image-scan / cosign / SBOM / provenance を no-Docker の本リポに持ち込むこと([0011](0011-no-docker.md))
- ❌ SAST を CodeQL だけに寄せること(持ち出せない層を唯一の SAST にしない) <!-- boilerplate-only:line -->
- ❌ Semgrep 本体を採ること(ライセンス判断を作った側へ渡さない。Opengrep へ一本化)
- ❌ baseline が 0 件でない層をゲートにすること(3.2 の配線から選ぶ)
- ❌ スキャナのルールやチェックを一括で無効化すること(抑止は 3.4 の様式に限る)
- ❌ 理由の書かれていない抑止エントリを置くこと

## 補足

- スキャナのバージョンは `mise.toml` が SSOT([0003](0003-version-manager.md))。hook / CI とも同じ版のバイナリを使う
- `.github/` へのセキュリティ workflow の追加はユーザ指示のもとで行う(AGENTS.md AI Modification Scope)

## 関連 ADR

- [0153-ci-configuration.md](0153-ci-configuration.md) — Security グループの CI 組込み(本 ADR の実行基盤)。Actions の SHA ピンもこちら
- [0004-library-management.md](0004-library-management.md) — `pnpm audit` / exact pin / major 別 PR(依存監査の土台)
- [0151-git-hooks.md](0151-git-hooks.md) — pre-push の段階責務(本 ADR のスキャンを走らせる第一段)
- [0003-version-manager.md](0003-version-manager.md) — gitleaks / Trivy のバージョン宣言(`mise.toml` が SSOT)
- [0011-no-docker.md](0011-no-docker.md) — no-Docker(image-scan / cosign / SBOM exclusion の根拠)
- [0072-api-type-generation.md](0072-api-type-generation.md) — 生成物 `src/adapters/gen/**`(誤検知が出た場合の allowlist 候補)
- [0150-git-workflow.md](0150-git-workflow.md) — 保護ブランチ(release ゲートの対象)
