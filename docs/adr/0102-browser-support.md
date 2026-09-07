# ブラウザサポート行列

サポート対象ブラウザの **基準(browserslist)/ polyfill 方針 / 切り捨て条件** を定める。

## Status

Accepted

## 背景

サポート下限は用途に依存する。boilerplate 本体はモダンブラウザ前提の既定だけを持ち、厳格化 / 緩和はテンプレートから作った側が行う。

## 決定

### 1. 基準 = Next.js の既定 browserslist を追認

- サポート対象は **Next.js が既定で用いる browserslist を追認**する(モダンブラウザ。Next.js 16 のトランスパイル / polyfill 既定に従う)。boilerplate 本体で独自の広い後方互換ターゲットを持たない
- 作った側が要件に応じて `browserslist`(または Next.js 設定)を上書きするのは妨げない

### 2. polyfill 方針

- **Next.js の既定 polyfill に委ねる**(Next.js は fetch / URL / Object.assign 等の広く使われる polyfill のみ自動注入する。ターゲット外機能に必要な polyfill は自前で追加する = Custom Polyfills)。独自 polyfill を先回りで足さない([0011](0011-no-docker.md) のロール定義上の対象外 + 必要になってから)

### 3. 切り捨て条件

- 具体的なサポート下限(レガシーブラウザの切り捨てライン)は**用途依存**のため作った側で決める。boilerplate 本体はモダンブラウザ前提を既定とする
- **JavaScript の無い環境は、読む・辿る経路だけを支持する。** 一覧の閲覧・URL に載せた条件の表示・遷移は JavaScript 無しでも成立させる。一方、条件を組み立ててからまとめて確定する操作は browser 側で状態を保持する必要があり、JavaScript 無しで送信できる form とは両立しない —— 途中の条件だけが先に効いて一覧が入れ替わることを避けるため前者を採り、JavaScript 無しの送信は落とす

## 禁止事項

- ❌ boilerplate 本体で独自 polyfill / 広い後方互換ターゲットを先回りで足すこと(Next.js 既定に委ね、必要時は作った側)

## 関連 ADR

- [0040-routing-rendering-strategy.md](0040-routing-rendering-strategy.md) — Next.js のビルド / トランスパイル前提
- [0011-no-docker.md](0011-no-docker.md) — 用途未定の表示層(切り捨て条件を作った側に委ねる根拠)
- [0101-performance-budget.md](0101-performance-budget.md) — ターゲットとバンドル / パフォーマンスの交差
