> **このファイルは `SKILL.md` の日本語訳です。**
> 直接編集しないでください。内容の変更が必要な場合は canonical な `SKILL.md`（英語版）を更新し、その後この日本語訳を同期してください。
> Claude Code のスキルとしては `SKILL.md` のみが読み込まれます。このファイルはスキル本体ではなく、レビューや学習用の翻訳ドキュメントです。

# GitHub Actions ピン更新

このスキルは `.github/workflows/**` と `.github/actions/**` で SHA 固定されている GitHub Actions を監査・更新する。**サプライチェーン検疫ゲート**と**自動ステップバック**を持ち、公開直後の（侵害されている可能性のある）版を、上流が検知・取り下げる前に取り込むことがない。各ピンを選ぶ規則は「ターゲット選択規則」節が持つ。

`tools-upgrade` の姉妹スキルである。あちらは `mise.toml` の `[tools]` を、こちらは GitHub Actions のピンを扱う。検疫の思想は共通で、対象とする SSOT だけが異なる。

## 本リポジトリでのピンの仕組み

何かを始める前にここを読むこと。以下の全手順はこの機構に依存する。判断の出所は [ADR 0153](../../../docs/adr/0153-ci-configuration.md) §3。

- 外部参照は `uses: owner/repo[/sub]@<40 桁 16 進 SHA> # <tag>` の形で固定する。**版の SSOT は末尾コメントの tag** であって `@<sha>` の側ではない。
- `.github/actions-pin.toml` がロックファイル（`"owner/repo@<tag>" = "<sha>"`）。`apply` の SSOT であり、`resolve` が毎回全量を再生成する。
- `make actions-pin-resolve` — 全 `uses:` のコメント tag を読み、`git ls-remote` で commit SHA へ解決し（annotated tag は commit へ deref）、検疫を適用してロックファイルを書き換える。ゲートは `ACTIONS_PIN_MIN_AGE_DAYS`（既定 14）で制御する。解決先が窓の内側なら**既存ピンを維持**する（moving tag に対する組み込みのステップバック）。ネットワークに出るのはこのコマンドだけ。不変を宣言した tag の解決先が変わった場合は **fail-closed に落ち、何も書かない**（後述「tag の付け替え」）。
- `make actions-pin-apply` — ロックファイルを元に各 `uses:` の `@<sha>` を書き換える（`# <tag>` は保つ）。
- `make actions-pin-check` — 書き換えずにピンがロックファイル通りかを検証する（CI / pre-commit hook 用）。オフラインで動く。未登録の参照 / 未固定・不一致の `@<sha>` / 壊れたロックファイル / どの `uses:` からも参照されなくなったエントリ / 走査器が読めない記法の `uses:` で失敗する。
- **`uses:` は 1 行 1 ステップのブロック記法で書く。** YAML の flow mapping（`- {name: X, uses: owner/repo@v1}`）は走査器が読む範囲の外にあるため、黙って飛ばすのではなく error にする。更新の都合でこの記法が要る場合は、ブロック記法へ書き直すこと。
- **moving な major tag（`# v6`）は次の `resolve` で major 内の最新へ自動前進する**。よって同一 major の更新は `resolve` + `apply` だけで済む。**major の更新にはコメント tag の編集**（`# v6` → `# v7`）が要る。**厳密版のコメント（`# v6.1.0`）は `resolve` では動かない**ため、上げるにはコメントを編集する。
- **コメント tag の形が、そのどちらであるかの宣言である。** bare な major 番号（`v6` / `6`）は moving、それ以外（`v6.1.0` / `v6.1` / `main`）はすべて不変であり、SHA が動けば fail する。moving minor tag（`v6.1`）を持つ上流では誤検知するが、その向きの誤りは安全側に倒れる。

### tag の付け替え

不変を宣言した tag の解決先が変わると、`resolve` は exit 1 になり、**ロックファイルを一切書かない**（承認済みの移動も他のエントリも書かない）。該当ごとに `key: <旧> -> <新>` を出力する。付け替えられた SHA が一度ロックファイルへ入れば、以降 `check` は「整合している」と答え続けるため、報告と並行して書くのではなく書き込み自体を止める。

不変な tag への意図した更新は、キー単位で承認する。

```sh
make actions-pin-resolve ACTIONS_PIN_ALLOW_MOVED="actions/cache@v6.1.0 actions/checkout@v7.0.0"
```

承認は 1 回の移動に対して与えるものである。移動していないキーは「承認は不要でした」と報告される。古い承認を残したままにすると次の付け替えを黙って通すためである。検疫は独立に掛かり続け、`ACTIONS_PIN_ALLOW_MOVED` が黙らせるのは付け替えの fail だけ。どの `uses:` からも参照されないキーは error になるため、綴り誤りが承認済みとして通ることはない。

> Rationale: [0153](../../../docs/adr/0153-ci-configuration.md) 決定 3

## 使用タイミング

以下のような場合に使用する。

- 固定済み Actions SHA の定期的な更新（既定の minor-only モード）
- Actions を新しい major へ上げるとき（`major` 引数）
- GitHub Actions のセキュリティアドバイザリ後

以下の用途では使用しない。

- `mise.toml` のツールバージョン → `tools-upgrade`
- Node ランタイム → `node-upgrade`
- npm 依存 → Dependabot または専用の PR であり、本スキルの対象外
- ローカル composite action（`uses: ./...`）— `@ref` を持たず固定対象ではない

## 引数

引数は順不同で解釈する。振る舞いを引数が決めるため、戦略を対話で尋ねることはしない。

| トークン | 意味 | 既定 |
| --- | --- | --- |
| `major`（または `--major`） | 新しい **major** への更新も行う。無指定なら **minor-only**（現在の major に留まる）。 | minor-only |
| 裸の整数、または `days=N`（`--days N`） | 除外窓の日数 = `ACTIONS_PIN_MIN_AGE_DAYS`。スキル側のステップバック計算と `make actions-pin-resolve` の双方で使う。 | `14` |

例: `/actions-pin`（minor・14 日）・`/actions-pin major`（minor+major・14 日）・`/actions-pin major 30`（major・30 日）・`/actions-pin 21`（minor・21 日）。

除外日数は 0 以上の整数であること。`0` は検疫の無効化（新しいリリースもそのまま採用）を意味するため、**ユーザが明示的に `0` を渡したときだけ**受け入れ、供給網リスクを明示すること。

## AI Modification Scope

`AGENTS.md` の「Exception: Skill Execution」条項により、本スキルの実行中に限り以下のパスを変更してよい。

- `.github/workflows/*.{yml,yaml}` — `uses:` のコメント tag と `@<sha>`（`make actions-pin-apply` が書く）
- `.github/actions/*/action.{yml,yaml}` — 同上
- `.github/actions-pin.toml` — ロックファイル（`make actions-pin-resolve` が書く）

以下はスキル実行中も保護対象のままとする。

- `AGENTS.md` / `CLAUDE.md` / `LICENSE` / Accepted な ADR 本文
- `.claude/settings.json` の `permissions.deny` に列挙されたパス
- ピン更新と無関係なファイル全般。`with:` の入力・ステップのロジック・`scripts/actions-pin/` は変更しない。更新に入力の変更が必要なら、その事実を報告して停止する。

## ターゲット選択規則（本スキルの中核）

各アクションについて、**ターゲット major** `M` は minor-only モードでは現在の major、`major` モードでは利用可能な最新の major とする。`M` に対するピンは次の順で決める（`N` = 除外日数、cutoff = `now - N 日`）。

1. **moving tag が窓を通過している** — moving な major tag `vM` が存在し、その最新の解決先が cutoff より古い → `# vM` を固定する（以後の実行でも自動前進するため最優先）。
2. **1 つ前の通過済み厳密版へステップバック** — そうでない場合（`vM` の head が窓の内側、または moving な `vM` tag が無い）→ `published_at` が cutoff より古い厳密版 `vM.x.y` のうち最新を選び `# vM.x.y` を固定する。これが「1 つ前の版を使う」挙動で、検疫を守ったまま `M` へ到達できる。
3. **保留** — `M` のどのリリースも cutoff より古くない場合（`M` が出たばかりで `vM.0.0` しか無く、それも新しい等）→ そのアクションは変更せず、保留として報告する。

規則への注記:

- **minor-only** モードでは `M` が現在の major なので通常は規則 1 が適用され、実作業は `make actions-pin-resolve` が行う（major 内 head が新しければ既存ピンを維持する = 規則 2 相当）。スキルがコメント tag を編集するのは、厳密版へのステップバックを強制する場合と、厳密版で固定されたアクションの patch 系列を上げる場合だけ。
- **major** モードでは `M` は新しい major でロックファイルにキーが無いため、新しい `vM` head は `resolve` に **skip** される（→ `apply` が未登録として報告する）。新 major を今採用可能にするのが規則 2 であり、それも無理なら規則 3 で保留する。
- 厳密版へのステップバック（規則 2）は moving-major の慣行から外れる。`vM` が窓を通過したら `# vM` へ戻せる旨をコミットに記録すること。

## Step 0. 事前準備

依存を導入し、`resolve`（リリース日取得のため GitHub API を叩く）がレート制限に掛からないようトークンを設定する。

```sh
pnpm install --frozen-lockfile
export GITHUB_TOKEN="$(gh auth token)"
```

## Step 1. 引数の解釈とインベントリ

引数を `<MODE>`（minor / major）と `<N>`（除外日数）へ解釈する。次に、

- `.github/actions-pin.toml` を読み、現在の `tag → sha` 集合を把握する。
- `.github/workflows/` と `.github/actions/` を `uses:` で grep し、各外部アクションのファイル所在と現在のコメント tag を対応付ける（複数ファイルから参照されているものに注意）。

## Step 2. リリース照会とターゲットピンの算出

各外部アクションについてリリース一覧を日付付きで取得する（`gh api repos/<owner>/<repo>/releases -q '.[] | "\(.tag_name)\t\(.published_at)\t\(.prerelease)"'`。pre-release は除外）。`<MODE>` に従いターゲット major `M` を決め、ターゲット選択規則を適用して「`# vM` を固定 / 厳密版 `# vM.x.y` へステップバック / 保留」のいずれかを算出する。major をまたぐ **tag 表記の変更**（上流が `v` 接頭辞を足す・外すことがある）に注意すること。コメント tag は上流の tag 文字列と完全一致していなければ `resolve` が `ref ... が見つかりません` で失敗する。規則 1 の候補については moving な `vM` tag が実在することも確認する（`git ls-remote … vM`）。無ければ規則 2 へ落とす。

## Step 3. major 更新時の `with:` 検証

`resolve` / `apply` / `actionlint` が捉えるのは構文であって、入力の意味的な変更ではない。**major が変わる**アクションについては、リリースノートと上流アクション自身の定義ファイルを読み、本リポジトリが使っている全 `with:` ブロックと突き合わせる。実際に使っている入力が互換なら更新を維持する。破壊的な入力変更が該当するなら、**そのアクションを保留し必要な変更内容を報告する**（自動適用しない）。同一 major 内の更新ではこの検証を省く。

## Step 4. ステップバックできない場合

検疫に対する通常の答えは**ステップバック**（規則 2）であり、窓を既に通過した最新の厳密版を採る。証拠収集は不要で、窓が既に判定を済ませたものを採用するだけである。ステップバック先が無いのは次の場合。

- **規則 3 の保留** — ターゲット major のどのリリースも cutoff より古くなく、待つか新しいものを採るかの二択になる。差し戻せる検証済みの選択肢が存在しない。
- **修正が最新版にしか無いアドバイザリ** — 待つことが脆弱なまま留まることを意味する。
- **`with:` 検証（手順 3）で保留したアクション** — その後にユーザから「その新版自体は安全か」を問われた場合。

**そうした候補は `supply-chain-triage` へ渡す。**4 つの軸で直接証拠を採点し、答えられなかった軸を合格に数えず報告する。ここで判定を捏造しない —— このスキルが知っているのは窓とステップバックであって、窓を解除する証拠を集めるのは別の仕事である。返ってきた帯を受け取り、検証済みの代替が無い事実を明示したうえで、`AskUserQuestion` でユーザに判断を委ねる。**低いスコアはその判断のための証拠であって、判断ではない。**

## Step 5. 計画の提示と確認

日本語で要約を出力する: 適用する更新（moving `# vM` / 厳密版へのステップバック `# vM.x.y`。それぞれ選んだ版と経過日数を添える）、保留した項目（理由: 新 major がまだ新しい / `with:` が破壊的 / 窓を通過したリリースが無い）、変更なしの項目。そのうえで `AskUserQuestion` で具体的な適用集合を確認する（独立した更新が複数あるときは `multiSelect: true`）。書き込み前にステップバックと保留の判断が見えるようにするため。

## Step 6. コメント tag の編集

承認された更新それぞれについて、該当する `uses:` 行の末尾コメント tag を算出したターゲット（`# v7` または厳密版 `# v4.1.0`）へ編集する。`@<sha>` はそのままにする（`apply` が書き換える）。同一の `uses:` 行が複数ファイルに現れる場合はファイル単位の全置換でよい。1 つのファイル内で複数の別アクションが同じ古いコメントを共有している場合は、`uses:` 行全体で一意に照合し、意図したものだけが変わるようにする。保留・変更なしのアクションには触れない。

## Step 7. resolve → apply

```sh
export GITHUB_TOKEN="$(gh auth token)"
make actions-pin-resolve ACTIONS_PIN_MIN_AGE_DAYS=<N>   # 解釈した除外日数
make actions-pin-apply
```

`resolve` は参照中の全 tag を再解決し、head が窓の内側のものについて `⚠️ ... 既存ピンを維持` を出力する。これは想定内であり失敗ではない。

moving な major tag の正当な前進は `ℹ️ tag の解決先が前進しました` として旧新の SHA 付きで出力される。

**`resolve` が `不変を宣言した tag の解決先が変わりました` で exit 1 したら停止すること。** これは「tag の付け替え」節の fail-closed であり、まだ何も採用されていない。列挙された各キーについて旧 SHA と新 SHA の両方を報告し（上流へ報告可能にするのはこの 2 値である）、ユーザの判断を仰ぐ。`ACTIONS_PIN_ALLOW_MOVED` を自分の判断で使ってはならない。これが要るのは、本リポジトリが不変と宣言したコメント tag を上流が実際には動かしている場合（`# v6.1` のような moving minor）だけであり、その確認は人間の判断である。確認が取れたらキーを承認して再実行し、その tag が動く理由をコミットに残す。

`resolve` が `ref "vN" が見つかりません` で止まった場合、その moving-major tag は存在しない。そのアクションは規則 2 の厳密版ピンにすべきであり、修正して再実行する。

## Step 8. 検証

```sh
make actions-pin-check     # ピンがロックファイル通りか
make actionlint            # workflow 定義に対する actionlint
```

コマンドごとに OK / FAIL を報告する。失敗しても自動でロールバックしないこと（判断はユーザが持つ）。

## Step 9. 最終報告

次を要約する: 更新したアクション（moving / 厳密版ステップバック）、SHA を更新したアクション、保留したアクション（理由付き）、手順 7 で見つかった tag 付け替え、検証結果。導入した厳密版ピンは、窓を通過したら見直せるよう一覧で示す。commit / stage / push は行わない（ユーザが `/commit` を実行する。これらの変更は `CI:` prefix）。

## 補足

- **検疫への既定の応答は保留ではなくステップバックである。** 保留はターゲット major に窓を通過したリリースが 1 つも無いときにだけ起きる。
- **tag は名前であって同一性ではない。** ロックファイルが存在するのは tag が付け替えられ得るからであり、不変を宣言した tag の SHA が動く事象こそがそれの捕捉対象である。`resolve` はそこで fail-closed に落ちる（手順 6）。
- **検疫は時間を稼ぐものであって、経過日数を証明するものではない。** 見ているのは Release の `published_at` と commit の日付のうち新しい方である。Release オブジェクトは tag の**名前**に紐づき、tag が付け替えられても動かない。commit の日付は発行者が自由に書ける git のメタデータである。よってどちらも単独では解決先 SHA を説明せず、両方を採っても本気の発行者には破られる。このゲートは自動化された乗っ取りに対する遅延であって保証ではない。付け替えの捕捉は `resolve` の fail-closed（手順 6）の担当であり、検疫の担当ではない。
- **検疫と新 major**: ゲートは SHA の経過日数を見るが、新しい major にはロックファイルの既存エントリが無い。よって新 major の moving tag は窓を通過するまで `resolve` に skip される。規則 2 が窓を通過した厳密版を固定するのはこのためである。
- **すべてのアクションが moving な major tag を持つわけではない。** `# vM` が解決すると仮定する前に必ず `git ls-remote` で `vM` tag を確認する。
- **`actionlint` は意味的な安全性を保証しない。** 検証するのは workflow の構文であって、更新したアクションの入力・挙動が使用箇所と整合するかではない。major 更新時の `with:` 検証（手順 3）は必須である。
- **annotated tag の deref**: `resolve` は deref した commit SHA（`refs/tags/vM^{}`）を返すため、素朴な `git ls-remote vM` の行とロックファイルの SHA は異なり得る。
- **`GITHUB_TOKEN`**: `resolve` はリリース日の取得に GitHub API を使う。現在のアクション数なら未認証の 60 req/h に収まるが、規模の大きい実行で引っ掛からないよう `gh auth token` を設定しておくこと。`GH_TOKEN` も受け付ける。
- **冪等性**: 2 回目の実行では全件が固定済みとなり `make actions-pin-check` が通る。
- 本スキルは自動 push を行わない。

## チェックリスト

完了を報告する前に確認する。

- [ ] 引数をモード（minor / major）と除外日数 `<N>`（既定 14）へ解釈した
- [ ] `pnpm install --frozen-lockfile` を実行し `GITHUB_TOKEN` を設定した
- [ ] `actions-pin.toml` と `uses:` の grep から現在のピンを棚卸しした
- [ ] アクションごとに、モードからターゲット major を決め、ターゲット選択規則を適用した（窓通過済み `# vM` → 厳密版ステップバック → 保留）
- [ ] tag 表記の変更と moving tag の実在を考慮した
- [ ] major が変わるアクションごとに `with:` の互換性を検証し、破壊的なものは保留して報告した
- [ ] `resolve` が tag 付け替えで exit 1 していない（該当時は停止して旧新 SHA を報告し、ユーザの判断なしに `ACTIONS_PIN_ALLOW_MOVED` で承認しない）
- [ ] 計画（更新 / ステップバック / 保留と理由）を提示し `AskUserQuestion` で確認した
- [ ] コメント tag は承認された更新の分だけ編集し、保留・変更なしのアクションには触れていない
- [ ] `make actions-pin-resolve ACTIONS_PIN_MIN_AGE_DAYS=<N>` と `make actions-pin-apply` を実行した
- [ ] `make actions-pin-check` と `make actionlint` を実行し結果を報告した
- [ ] 導入した厳密版ステップバックのピンを、後で見直せるよう一覧にした
- [ ] `SKILL.md` を更新した場合、`SKILL.ja.md` の日本語訳も同期した
- [ ] commit / stage / push を行っていない
