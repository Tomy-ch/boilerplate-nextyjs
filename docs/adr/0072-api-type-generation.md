# 型生成(API スキーマ)

バックエンドの `openapi.gen.yaml` から **型 + runtime validation(zod)を生成**する方針、**生成器 / 生成物の配置 / do-not-edit / 型漏洩禁止 / 取り込みパイプライン(gh 取得 + short SHA スタンプ)/ 生成物 drift ゲート** を定める。

## Status

Accepted

## 背景

API 型を OpenAPI から生成するか手書きか・生成器の選定・生成物の扱いを、本 ADR が確定する。前提は「API 型を複数箇所で複製しない / 生成扱いすべきファイルを手書きしない」である。

バックエンドはモジュラーな spec をバンドルした `openapi.gen.yaml` を**クロスリポ契約成果物としてコミット**する([0070](0070-backend-role-separation.md) 契約 SSOT)。フロントはその消費者であり、コミット済みファイルを GitHub API(`gh` CLI)で取得し、自前で生成を行う。本 ADR はこの消費者側を定める。

**型のみ(openapi-typescript)ではなく、型 + runtime validation(zod)を生成する。** 境界値所有([0070](0070-backend-role-separation.md))の下では response に server 側の runtime 検証が無く、フロントの生成 validation が契約破れの最後の砦になるためである。型だけでは実行時に契約破れを検知できない。

## 決定

### 型 + runtime validation を生成(生成器 = orval)

- API 型は**バックエンドの `openapi.gen.yaml` から生成**する(手書き複製禁止)。生成物は **zod スキーマ + `z.infer` 由来の型**とする
- **生成器 = orval**(zod スキーマ + TS 型を 1 つの生成器で出す)。exact pin / `pnpm audit` は [0004](0004-library-management.md) の採用フローに従う
- response は `adapters` 境界で zod `.parse()` により runtime validation する([0070](0070-backend-role-separation.md) 境界値所有 / [0071](0071-bff-api-integration.md) が受け取り点)

### 生成物の配置 / do-not-edit

- 生成物は **`src/adapters/gen/`** に配置する。生成 wire 型・zod スキーマは `adapters`(外部接続・変換の所有境界。[0021](0021-frontend-responsibility.md))が所有するため、その内側に colocate する。生成物は所有層の内側に置き、`src/` 直下に生成物専用の場所を立てない。ディレクトリ名 `gen/` は生成物置き場の業界慣行名
- これは **`adapters` カーネル内の生成専用サブディレクトリ**であり、[0027](0027-directory-structure.md) が追補を要求する「11 カーネル構成に対する `src/` 直下の新規カーネル増設」には当たらない(追補不要)
- **生成物はコミットする。** 契約の変更が生成物の差分としてレビューに現れるためであり、その代わりに drift ゲート(下記)が手編集と生成漏れを拒む
- **手編集禁止(do-not-edit)**。`src/adapters/gen/` は生成入力(`openapi.gen.yaml`)からの再生成で常に上書きされる。人間・AI は編集しない

### 型漏洩禁止

- 生成型・zod スキーマ(生成された wire 型)を**内層(`model` / feature のドメインロジック)に漏らさない**([0020](0020-adopted-architecture.md) 設計原則 3)
- 変換は所有境界 = **`adapters`** で行い、自前の表示用 view 型([0021](0021-frontend-responsibility.md) `model`)へ変換する。「OpenAPI 制約 = wire contract であって domain rule ではない」を維持([0070](0070-backend-role-separation.md))

### 取り込みパイプライン(gh 取得 + short SHA スタンプ)

1. **セットアップ時(一度)**: **バックエンドのリポジトリ名** と **リポジトリルートからの `openapi.gen.yaml` へのパス** と **取得する ref** を、**静的なマニフェスト(設定ファイル)**として本リポに保存する。マニフェストは**複数の契約を宣言できる**。バックエンドが 1 リポジトリでも契約が 1 本とは限らず(例: 本体 API と認証 Provider は別サービスであり別契約)、契約ごとに版が独立して動くためである
2. **取得時(`make` または `pnpm` コマンド)**: マニフェストの座標から **`gh` 経由で契約を取得**し本リポへコピーする。版の根拠には **GitHub Contents API が返す blob SHA** を使い、**full SHA をマニフェストへ、short SHA を取得した spec の `info.version` 末尾へ**スタンプする。blob SHA は契約ファイルの内容そのもののハッシュであり、内容が変われば変わり同じなら同じであるため、取り込み側でハッシュを計算し直さずに「どの契約を取り込んだか」が一意に定まる。**この SHA が指すのは契約の内容であってバックエンドのコミットではない**。どのコミットから取ったかはマニフェストの `ref` が持つ
3. 取得した spec を入力に **orval で zod + 型を `src/adapters/gen/<契約名>/` に生成**する。契約ごとに階層を切り、突合と再生成を契約単位で回せるようにする。生成後に整形 / typecheck / lint を連鎖させる
4. 生成器は HTTP client の出力先を必須とするが、**生成された client は採用しない**。outbound の resilience は `adapters/server` の手書き wrapper が所有する([0071](0071-bff-api-integration.md))ため、生成 client は契約駆動モックと同じ `mocks/` 側へ置き、本番が参照する `src/adapters/gen/` には wire 型と zod スキーマだけを置く
5. **生成物は linter の対象外とし、整形のみを掛ける**。書き手が居ないコードに規約を課すと、契約が変わるたびに生成器の出力作風で CI が止まり、直す手段が生成器へのパッチしか無くなる。生成物の正しさは drift ゲート(下記)が担保する

### 生成物 drift の CI ゲート

検出したい失敗は 2 つあり、**再取得はしない**(契約の取得は意図した行為であり、ゲートが勝手に進めない)。

1. **生成物が手編集された / 取り込んだ契約以外から生成された / 契約から消えたのに残っている** — 取得済み契約から**再生成し、差分が出たら fail**
2. **契約を取得したのに生成していない** — マニフェストの blob SHA と、生成器が生成物のヘッダへ書き写す版スタンプを突合する。生成を伴わないため hook でも回せる

1 は 2 を包含するが、2 は失敗の所在を名指しできる。両方を持つ。

1 が見るのは **追加・変更・削除の 3 つすべて**であり、そのために 2 つの条件を置く。

- **突合は `git diff` ではなく `git status`。** 契約にスキーマが増えると生成器は**新しいファイル**を書き、untracked なそれは `git diff` から見えない。ゲートが存在する理由そのものの変更を素通りする
- **再生成は置き場を空にしてから行う**(`make gen-api`)。上書きだけだと、契約から消えたスキーマに対応するファイルは触られずに残り、中身が変わらないので突合も通る。**契約に無いものが生成物の顔をして居座る**。生成器側の clean 機能へ委ねないのは、それが project ごとの設定であり、単一ファイルへ出す project では同じ階層の別 project の出力ごと消してしまうため —— **孤児の始末を出力の形から独立させる**

### 制約の定数は、検証と別の module へ出す

生成した zod スキーマには、契約が定める上限・書式が `export const` の定数としても現れる(`...Max` / `...RegExp` など)。**client はこの定数を要る** —— 入力欄の上限や取得件数がそれで決まる —— が、**検証は要らない**。

生成物は 1 ファイルに全エンドポイントのスキーマと説明文を持つため、**定数を 1 つ import するとその全体がブラウザへ配られる**(同梱サンプルの実測で、生成スキーマと `.describe()` の文言だけで 14.8 KB gzip、加えて classic の `zod` が 63.5 KB)。

したがって、**生成の最後に定数だけの module (`limits.ts`) を作り、client はそちらだけを引く**。

- **写すのは zod を参照しない宣言だけ。** 受ける形を列挙せず、「zod を引くか」だけで落とす。生成器は制約を数値・文字列・テンプレート literal・`new RegExp(...)` と様々な形で出すため、列挙で受けると形が変わるたびに定数が黙って落ちる
- **契約の版スタンプを書き写す。** 版の突合は生成物のディレクトリ全体を見るため、版を持たないファイルが 1 つでもあると「生成器が版を書かなくなった」として落ちる
- **出所は生成器ではなくこの手順だと名乗る。** orval のヘッダを写すと、再生成しても orval からは現れないファイルが orval の出力を名乗ることになる
- **定数が 1 つも無い契約では書き出さない。** ヘッダだけのファイルが残ると、読む人が「抽出が壊れているのか、契約に持たないのか」を判じることになる。**存在するファイルは必ず中身を持つ**側へ倒す
- **再発は機械が見る。** client の島から辿って、`zod` の既定の入口と生成 zod スキーマのどちらかを引く module があれば落ちる(`scripts/client-schema-weight.gate.test.ts`)。予算([0101](0101-performance-budget.md))は総量で捕まえるが**なぜ増えたかを答えない**ため、原因の側にも置く

### 境界で型を確定させる

生成スキーマの `parse` を境界で 1 度だけ通し、以降は**確定した型**として内側へ渡す。この規律そのものは [0029](0029-type-design-discipline.md) が持ち、本 ADR は生成スキーマがその実行者であることを定める。

## 禁止事項

- ❌ API 型を手書きで複製すること(SSOT = バックエンドの `openapi.gen.yaml`)
- ❌ `gen/` 配下の生成物を手編集すること(do-not-edit)
- ❌ 生成型・zod スキーマを `model` 等の内層へ漏らすこと(変換は `adapters` 境界)
- ❌ 取得座標をマニフェスト外にハードコードすること(座標は静的マニフェストで管理)
- ❌ drift ゲートなしに生成物をコミット運用すること

## 補足

- 境界値所有([0070](0070-backend-role-separation.md))の方向不変条件「request ⊆ domain ⊆ response」のうち、フロントが担保するのは response 側の検証(最後の砦)である

## 関連 ADR

- [0070-backend-role-separation.md](0070-backend-role-separation.md) — 契約 SSOT / 境界値所有 / runtime validation を担う根拠(本 ADR の親決定)
- [0071-bff-api-integration.md](0071-bff-api-integration.md) — 生成した zod スキーマの使用点(adapters 境界での `.parse()`)
- [0020-adopted-architecture.md](0020-adopted-architecture.md) — 型漏洩禁止(設計原則 3)/ [0021](0021-frontend-responsibility.md) — `adapters` 変換境界・`model` view 型
- [0004-library-management.md](0004-library-management.md) — orval 等生成器の exact pin / audit
- [0153-ci-configuration.md](0153-ci-configuration.md) — 生成物 drift ゲートのワークフロー・CI 組込み
- [0155-claude-skills-development.md](0155-claude-skills-development.md) — setup スクリプト系スキルの置き場(本パイプラインの setup 部)
