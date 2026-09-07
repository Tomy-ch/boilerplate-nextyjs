# ロケール対応フォーマット(日付・数値)と日付演算

i18n 本体([0121](0121-i18n-strategy.md) の exclusion)とは独立に、単一ロケール構成でも初日から必要になる **日付・数値の locale-aware フォーマット** と **日付演算(加減算 / 差分 / パース等)** について、**表示フォーマット = `Intl.*`(ECMA-402)/ 日付演算 = `date-fns` / 双方の置き場 / 既定 locale の供給 seam** を確定する。[0121](0121-i18n-strategy.md) が扱うのは翻訳基盤・ロケール解決の exclusion だけであり、フォーマッタ・日付演算ヘルパの帰属は本 ADR が **カーネル管轄([0021](0021-frontend-responsibility.md) / [0027](0027-directory-structure.md))で書き切る**。

## Status

Accepted

## 背景

- **日付・数値表示は単一ロケールでも初日から必要**であり、置き場を決めないと**同じフォーマッタが feature ごとに再発明**される([0021](0021-frontend-responsibility.md) の「複数箇所参照はカーネル昇格」判断が先送りされる)
- 一方、**日付の加減算・差分・パース・比較・ISO 相互変換といった「演算」は `Intl` の射程外**である。`Intl` は locale-aware な**表示(format)専用**であり、演算 API を持たない。演算を素の `Date` と手書きで組むと、閏年・DST・タイムゾーン境界・月末繰り上げ等のバグが feature ごとに再生産される。一般的なアプリケーション基盤としてこの演算基盤は初日から必要であり、`date-fns` を採用してカーネルに集約する

## 決定

### 1. 表示フォーマットは `Intl.*`(ECMA-402)を用いる(不変)

- **日付・数値・通貨・パーセント等の locale-aware な表示(format)は、ランタイム標準の `Intl.*`(`Intl.DateTimeFormat` / `Intl.NumberFormat` 等)を用いる**。`date-fns` の `format` / `formatDistance` 等の**表示系関数は用いず、表示は `Intl` に一本化**する(二重フォーマット禁止。§2 参照)
- **vendor-independent 正当性材料([0010](0010-standards-and-non-lockin.md) §1/§2)**: `Intl` は **ECMA-402(ECMAScript Internationalization API)標準**であり、特定ベンダー・特定フレームワークの API ではない。ブラウザ・Node.js(フル ICU 同梱)双方の**JS ランタイムに標準搭載**され、依存ゼロで **Server Component / Client Component / Route Handler のいずれの実行文脈でも同一 API が利用可能**である(ただし出力はランタイムの ICU バージョン / ロケールデータに依存するため、SSR〈Node〉と CSR〈ブラウザ〉で差が出うる。この表示ずれの扱いは `docs/rules.md` #53 が持つ)。[0010](0010-standards-and-non-lockin.md) の運用テスト「そのベンダーを正当化から抜いても正当か?」は、`Intl` に**そもそもベンダーが存在しない**(= 言語標準そのもの)ため自明に成立する
- これは [0121](0121-i18n-strategy.md)(i18n ライブラリ・翻訳基盤・ロケール解決を同梱しない)と**矛盾せず補完**する。0121 が除外するのは**翻訳と locale 解決**であって、**単一 locale でのフォーマット表示ではない**

### 2. 日付演算は `date-fns` を採用する(`Intl` の補完・二重フォーマット禁止)

- **`Intl` が持たない日付の「演算」= 加減算(`addDays` / `subMonths` 等)・差分(`differenceInDays` 等)・パース(`parseISO` 等)・比較(`isBefore` / `isAfter`)・境界(`startOfDay` / `endOfMonth`)等は `date-fns` を用いる**。導入は [0004](0004-library-management.md) の採用フロー(**exact pin + `pnpm audit`**)に従う
- **`Intl` との役割分界(二重フォーマットの禁止)**: **表示 = `Intl`、演算 = `date-fns`** に厳密に分ける。`date-fns` の `format` 系(`format` / `formatDistance` / `formatRelative` 等)や locale パッケージ(`date-fns/locale`)は**表示用途では使わない**(表示は §1 の `Intl` が唯一の出口)。同じ表示を `Intl` と `date-fns` の双方で二重に持たない。`date-fns` の責務は**あくまで `Date` 値の演算・生成・解析**に限定し、演算結果の `Date` を最終的に `Intl` で描画する
- **vendor-independent 正当性材料([0010](0010-standards-and-non-lockin.md) §1/§2)**: `date-fns` は **immutable な純関数の集合**であり、`Date` オブジェクトを入出力とする — 独自ラッパ型(Moment / Luxon の `DateTime`、Day.js の `Dayjs` 等)を導入しないため、**ライブラリ固有オブジェクトが型境界を汚染しない**([0020](0020-adopted-architecture.md) 型漏洩禁止と整合)。関数単位で **tree-shakable**(使う関数だけがバンドルに載る)であり、各ヘルパは標準 `Date` を受け取り標準 `Date` を返すため、**別ライブラリ(Luxon / Temporal 等)への差し替えがモジュール境界内で完結**する。[0010](0010-standards-and-non-lockin.md) の運用テスト「そのベンダーを抜いてもパターンは正当か?」は Yes — 演算ヘルパを `model` に集約し標準 `Date` を境界型に保つという**構造**は `date-fns` 固有ではなく、将来 [ECMAScript Temporal](https://tc39.es/proposal-temporal/) が標準搭載された時点で `date-fns` を Temporal 実装へ差し替えても構造は不変。ゆえに「数ある演算手段から、標準 `Date` 境界・tree-shakable・型非汚染という独立根拠で `date-fns` を 1 要因として選んだ」= 非ロックイン
- **差替可能性の担保([0010](0010-standards-and-non-lockin.md) §2)**: `date-fns` の関数を **feature / component から直接 import して散らさない**。日付演算は次項の `model` カーネルの薄いヘルパ越しに使い、vendor 直参照を単一の家に閉じ込める(差し替え点を 1 箇所に保つ)
- **タイムゾーンを固定する境界の計算には `date-fns` を用いない**。`date-fns` の境界関数(`startOfDay` / `startOfMonth` 等)は**ランタイムのタイムゾーンで境界を解決する**ため、同じ入力でもサーバ(多くは UTC)とブラウザ(閲覧者の現在地)で答えが変わる。§3 の `DEFAULT_TIME_ZONE` はまさにその依存を断つための固定なので、ここで `date-fns` を使うと固定が意味を失う。**ゾーンから暦日への解決は §1 の `Intl`(`timeZone` 指定)で行い、年月日の繰り上げは `Date.UTC` 上で行う**(ゾーンを持たない演算なので、ランタイムに左右されない)。この形も `model` の薄いヘルパに閉じ込め、feature へ散らさない点は上の項と同じである
  - **該当するのは「暦の境界そのもの」を決める演算だけ**である。`Date` 同士の差分・比較・パースなど、ゾーンの解釈を伴わない演算は従来どおり `date-fns` を用いる
  - 集計・絞り込みの期間を**瞬時の半開区間**として組み立てる際は、**オフセット付きの RFC3339** を出力する。オフセットの無い文字列は、解釈が呼び出し側と接続先の実装差に落ちる
- **日付だけの値(誕生日・公開日など)は `Date` で境界を越えさせず、`YYYY-MM-DD` の文字列で運ぶ**。`Date` は瞬時であり、生成側と消費側のタイムゾーンが違えば同じ瞬時が別の暦日として読まれる —— 日付だけの値にブラウザやサーバのタイムゾーン変換を適用しないための形である。入力部品は内部で `Date` を使っても、公開する値(callback / hidden input)は文字列に揃える。時刻とタイムゾーンを含む瞬間を扱う場合は、呼び出し側で TZ を決めて日時へ変換するか、瞬時を扱う別の部品を使う

### 3. フォーマッタ・日付演算ヘルパの置き場 = `model` カーネル

- **locale-aware フォーマッタ(`Intl.*` の薄いラッパ)と日付演算ヘルパ(`date-fns` の薄いラッパ)はともに `model` カーネルに置く**。[0021](0021-frontend-responsibility.md) の責務定義で `model` は「表示用 ValueObject / **フォーマッタ** / 単位変換 / 表示バリデーション規則」を明示的に所有しており、フォーマッタ・日付演算(表示用ドメイン値の加工)の家は既に `model` に名指しされている。物理配置は [0027](0027-directory-structure.md) の `src/model/`(フラット共置・per-file 基本)に従う
- **昇格ルール([0021](0021-frontend-responsibility.md))との整合**: フォーマッタ・日付演算ヘルパは「表示用ロジック(VO / フォーマッタ)→ `model` へ」の昇格先そのものである。ただし [0021](0021-frontend-responsibility.md) カーネル受入基準に従い、**1 つの feature でしか使わない単発ヘルパは feature 内に置き**、複数 feature から参照される段になって `model` へ昇格させる(横断は `model`、単一機能ヘルパは feature 内)。`date-fns` の直参照も、横断利用になった段で `model` の薄いラッパに集約する(§2 差替可能性)
- **禁止方向の確認**: フォーマッタ・日付演算ヘルパは表示用ロジックであり、`components`(純 UI)/ `adapters`(外部接続)/ `capabilities`(runtime 能力 hook)には置かない([0021](0021-frontend-responsibility.md) 依存マトリクス・命名規律。汎用 `utils` 置き場も作らない)

### 4. 既定 locale の供給 seam

- **既定 locale は `model` 内の単一の名前付き定数(例: `defaultLocale`)に集約**し、フォーマッタは **locale を明示引数で受け取り、省略時に既定 locale を用いる**形とする。既定 locale を各コンポーネントにハードコード直書きしない(単一 seam に寄せる)
- この単一 seam が、**i18n 採用時([0121](0121-i18n-strategy.md))の差し替え点**となる。fork 先が next-intl 等を導入した時点で、この seam を「アクティブ locale を `proxy.ts` / `[locale]` セグメント([0121](0121-i18n-strategy.md) / [0043](0043-middleware-policy.md) / [0040](0040-routing-rendering-strategy.md))から解決した値」で供給する形へ差し替える。本体は**単一定数という最小の seam**に留め、多 locale 解決機構(resolver / port)は敷かない(具体は i18n 採用時 / fork 先で確定。「補足」参照)

## 禁止事項

- ❌ 日付の**表示(format)**に `date-fns` の `format` / `formatDistance` / `formatRelative` 等や `date-fns/locale` を用いること(表示は §1 の `Intl` に一本化。二重フォーマット禁止)
- ❌ `Intl` と `date-fns` で同じ表示を**二重に**持つこと(表示 = `Intl`、演算 = `date-fns` の役割分界を崩さない)
- ❌ Moment / Luxon / Day.js 等、**独自 DateTime ラッパ型**を持つ日付ライブラリを採用すること(型境界を汚染する。標準 `Date` を境界型に保つ。[0020](0020-adopted-architecture.md) 型漏洩禁止 / §2)
- ❌ `date-fns` の関数を feature / component から**直接 import して散らす**こと(横断利用は `model` の薄いラッパ越し。vendor 直参照を 1 箇所に閉じ込め差替点を保つ。§2 / [0010](0010-standards-and-non-lockin.md))
- ❌ `date-fns` を [0004](0004-library-management.md) フロー(exact pin + `pnpm audit`)を通さず追加すること
- ❌ 日付だけの値を `Date` のまま境界(callback / hidden input / API 契約)へ出すこと(§2。`YYYY-MM-DD` 文字列で運ぶ)
- ❌ 同一の locale-aware フォーマッタ・日付演算ヘルパを feature ごとに再発明すること(横断は `model` へ昇格。[0021](0021-frontend-responsibility.md))
- ❌ フォーマッタ・日付演算ヘルパ(表示用ロジック)を `components` / `adapters` / `capabilities` / 汎用置き場に置くこと(`model` 管轄。[0021](0021-frontend-responsibility.md) 依存マトリクス・命名規律)
- ❌ 既定 locale をコンポーネント各所へハードコード直書きすること(単一 seam = `model` 定数に集約)
- ❌ `Intl` / `date-fns` 使用の**日常 rule**(明示 locale 引数の徹底・`Intl.*` インスタンスの生成コスト回避のための memo 化・`Date#toLocaleString` 等の各所直書き禁止・`date-fns` の import は関数単位で行う 等)を ADR 本文へ書き込むこと(rule は `docs/rules.md` へ。[0140](0140-documentation-operations.md))

## 補足

- **decision / rule 分界([0140](0140-documentation-operations.md))**: 本 ADR は **decision**(`Intl` の表示採用 / `date-fns` の演算採用 / 二重フォーマット禁止の分界 / ヘルパの置き場 = `model` / 既定 locale seam)を確定する。**日常的に強制される使用 rule**(常に明示 locale を引数で渡す・`Intl.*` インスタンスを生成しっぱなしにせず再利用する・コンポーネント内での `toLocaleString` 直書きを避けフォーマッタ経由にする・`date-fns` は関数単位 import で tree-shaking を効かせる、等)は `docs/rules.md` が本 ADR への逆参照付きで持つ
- **TZ / hydration mismatch と相対時刻(`Intl.RelativeTimeFormat` の client 定期更新)は本 ADR の射程外**である。本 ADR は **絶対時刻・数値の静的フォーマットの置き場・`Intl` 表示採用・`date-fns` 演算採用**のみを扱い、サーバ(UTC)/ ブラウザ(ローカル TZ)の表示ずれ・`suppressHydrationWarning` 可否・時刻の client 描画・相対時刻の interval 再描画は `docs/rules.md` #53 / #54(Rationale [0040](0040-routing-rendering-strategy.md))が持つ。境界: **「どこに・何で書くか」= 本 ADR /「hydration・TZ・相対時刻の描画パターン」= rules.md**
- **`Intl` と `date-fns` の役割の完全な線引き**: 「値を **加工する**(足す・引く・差を取る・解析する・境界を丸める)」= `date-fns`、「値を **見せる**(locale 依存の文字列にする)」= `Intl`。この 2 者の間に第三の表示ライブラリを挟まない。将来 [ECMAScript Temporal](https://tc39.es/proposal-temporal/) がランタイム標準搭載された段では、`date-fns`(演算)を Temporal に寄せる再検討余地がある(標準準拠 [0010](0010-standards-and-non-lockin.md) §1)。その差し替えは §2/§3 の構造(標準 `Date` 境界・`model` 集約)ゆえモジュール境界内で完結する
- **既定 locale の供給元**: `model` 定数(単一 seam)に留める。env 駆動にする必要が生じた場合は [0030](0030-environment-variable-management.md) の `config` カーネルへ昇格し得る(env 変数追加はユーザ確認を要する。[0030](0030-environment-variable-management.md))。i18n 採用時は [0121](0121-i18n-strategy.md) の seam(`proxy.ts` / `[locale]`)がアクティブ locale を供給する

## 関連 ADR

- [0121-i18n-strategy.md](0121-i18n-strategy.md) — i18n 本体の exclusion。翻訳基盤・ロケール解決は除外し、フォーマット・演算は本 ADR が所有する。i18n 採用時の locale 解決 seam は 0121
- [0021-frontend-responsibility.md](0021-frontend-responsibility.md) — `model` の責務(フォーマッタ・表示用ロジック)・昇格ルール・依存マトリクス(フォーマッタ・日付演算ヘルパの帰属根拠)
- [0027-directory-structure.md](0027-directory-structure.md) — `model` の物理配置(フラット共置・per-file 基本)
- [0010-standards-and-non-lockin.md](0010-standards-and-non-lockin.md) — `Intl`(ECMA-402 標準)・`date-fns`(標準 `Date` 境界・tree-shakable・型非汚染)採用の vendor-independent 正当化根拠(§1 標準準拠 / §2 非ロックイン運用テスト・差替可能性)
- [0020-adopted-architecture.md](0020-adopted-architecture.md) — 型漏洩禁止(`date-fns` が独自 DateTime 型を持たず標準 `Date` を境界に保つ根拠)
- [0030-environment-variable-management.md](0030-environment-variable-management.md) — 既定 locale を env 駆動にする場合の `config` 昇格先
- [0140-documentation-operations.md](0140-documentation-operations.md) — タクソノミー(本 ADR = decision / 使用 rule は rules.md)
- [0040-routing-rendering-strategy.md](0040-routing-rendering-strategy.md) — TZ / hydration・相対時刻の描画パターンの Rationale(本 ADR の射程外境界)
- [0004-library-management.md](0004-library-management.md) — `date-fns` 採用フロー(exact pin + `pnpm audit`)/ fork 先が追加ライブラリを入れる場合の採用フロー
