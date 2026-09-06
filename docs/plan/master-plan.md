# nextjs-boilerplate 構成計画(master plan)

本書は、この Next.js boilerplate の **ADR 外の確定事項**を集約した文書である。役割分担は次のとおり:

- **決定の正 = ADR**(`docs/adr/00NN-*.md`)。確定した設計判断は各 ADR 本体が唯一の正であり、本書は再掲しない(ADR 番号 + 相対リンクで参照する)
- **進捗ボードの正 = [docs/adr/BACKLOG.md](../adr/BACKLOG.md)**。各 ADR / 枠 ID の「選定済み / 実装済み」ステータスは BACKLOG.md が正であり、本書は個別ステータスを再掲しない
- **工程の正 = [v1-implementation-plan.md](v1-implementation-plan.md)**。Phase → PR の分解・完了条件・依存関係はすべてそちらが持ち、本書は工程を持たない
- **サンプル仕様の正 = [screens.md](../screens.md)**(19 画面 + API 概要)
- **本書 = ADR に載らない確定事項**。滑走路原則・採用ロードマップ・実装レール・棄却を集約する

- 生成日: 2026-07-18
- 本書は旧 `docs/plan/` 配下 9 ファイル(設計フェーズの計画・監査・仕分け文書)の統合後継である。それら 9 ファイルの決定内容は ADR 0001〜0155 へ転記済みのため破棄した。経緯・比較検討・訂正過程は git 履歴を参照のこと

---

## 1. ADR 外の確定事項

### 1.1 滑走路(out-of-scope-runway)原則

この原則はどの ADR にも存在しない。意図的に ADR の外に置いている(恒久判断軸 [0010](../adr/0010-standards-and-non-lockin.md) や恒久責務 [0021](../adr/0021-frontend-responsibility.md) を濁さないため)。**本書がこの原則の唯一の正である。**

- **定義**: out-of-scope ≠ 沈黙の省略。フロント領域の関心事なら、一概に切り捨てず **滑走路**(明示的な名前を付けた拡張点 = seam)を敷く。境界判定は **「別ドメイン(infra / backend)の責務か?」** の一問。純粋な除外で終わってよいのは (a) 別ドメインの責務、(b) 機能 seam でない非機能 tooling 選択、の 2 つのみ。**「白紙 = 名もなき省略」が共通の敵**であり、滑走路はそれへの構造的回答である
- **設置面のない滑走路は敷かない**: 滑走路は **① 動くローカル最小機構**(local 代替のクラス / 機構)としてのみ置く。**② 空のインターフェース(IF / port)定義は採用しない** — 使われない IF は腐り、実装時に必ず書き直されるため。したがって seam は**設置面(実使用箇所)が実在する場合にのみ**敷く
- **ライフサイクル**: 滑走路は v2 採用まで存続する(fork 先は随時採用してよい)

### 1.2 採用ロードマップ(v1 / v2 二段構え)

- **方針**: v1 = 一般的な Next.js アプリケーション基盤に必要な汎用・常用ライブラリを全採用 / v2 = 局所的(用途依存)なライブラリを順次同梱していく
- **v1 採用**(ADR 反映済みのため参照のみ): [0052](../adr/0052-ui-component-policy.md)(shadcn/ui + Tabler アイコン)/ [0060](../adr/0060-state-management.md)(react-hook-form + zod + Zustand。横断 client 状態は `stores` = [0023](../adr/0023-stores-kernel.md))/ [0051](../adr/0051-styling-system.md)(Framer Motion)/ [0081](../adr/0081-observability-logging.md)(OTLP vendor-neutral)/ [0120](../adr/0120-locale-aware-formatting.md)(date-fns + Intl)/ [0050](../adr/0050-styling-strategy.md)(CSS Modules 限定許可)/ [0053](../adr/0053-ui-component-interaction-seam.md)(**TipTap**)/ [0131](../adr/0131-cookie-consent.md)(**軽量 consent 機構 + ゲートの裏のタグマネージャ**)

#### v2 採用マトリクス(局所・用途依存 → 順次同梱)

| 対象 | ベンダー(デファクト) | 濃淡 | 置き場 / seam | 該当 ADR |
| --- | --- | --- | --- | --- |
| i18n | next-intl | Thin | `proxy.ts` / `app` / `model` | [0121](../adr/0121-i18n-strategy.md) |
| DnD | dnd-kit | Thin | `components` / `capabilities` | [0053](../adr/0053-ui-component-interaction-seam.md) |
| 決済 | Stripe(`@stripe/stripe-js` + Elements) | Thin | `components` / `adapters`(mount seam) | [0076](../adr/0076-payment-ui-seam.md) |
| WebSocket / SSE | native + 薄い client | Medium | `adapters/client` | [0074](../adr/0074-runtime-communication-seam.md) |
| feature flag | env 既定 + adapter | Thin | `adapters` | [0078](../adr/0078-dynamic-feature-flag-seam.md) |
| PWA | Serwist(`@serwist/next`) | Medium | `app/manifest.*` | [0130](../adr/0130-pwa-strategy.md) |

- **濃淡の定義**: Full = 常用・深く統合・参照実装まで同梱 / Medium = 統合するが既定は控えめ(必要時に使う)/ Thin = seam + 配線 + 最小デモのみ(実使用は fork 次第)
- **1.1 の改訂に伴い、上記 6 件は v1 では何も置かない**(設置面が実在しないため)
- **v1 採用へ移した 3 件**: リッチテキスト(TipTap)は商品説明で実使用するため / Cookie 同意は [0031](../adr/0031-policy-state-supply.md) が状態供給を規定済みで設置面があり、かつサードパーティスクリプトのゲートは後付けコストが高いため / **プロダクト分析**は同意ゲートの裏へタグマネージャを同梱したことで seam が v1 に在る([0131](../adr/0131-cookie-consent.md) §2 / [0082](../adr/0082-client-observability.md) §3)—— 特定の SaaS(PostHog 等)を本体が選ぶことはせず、繋ぐのは容器の中身の入れ替えで済むため、**ライブラリとして v2 で同梱する対象ではなくなった**
- **プラットフォーム機能**(ライブラリとは別軸): Cache Components([0041](../adr/0041-cache-components-decision.md))/ React Compiler([0042](../adr/0042-react19-rendering-api.md))/ React taint API([0030](../adr/0030-environment-variable-management.md))—— Cache Components は **v1 で採用**、React taint API は **v1 で採用**(experimental を承知の例外)、React Compiler は**基盤の必須機能にせず opt-in の性能最適化手段として扱う**([0042](../adr/0042-react19-rendering-api.md) 決定 4)
- **capabilities の hook・機構として v1 実装する 4 件**: 離脱ガード(navigation-block hook = [0022](../adr/0022-capabilities-kernel.md) に記載)/ オンライン・オフライン検知(`useConnectivity` = 同)/ **Web Worker(オフロード seam。どの ADR にも記載がなく本行が唯一の記録)**/ メンテナンスモード(proxy rewrite 機構 + env フラグ seam。capabilities ではなく proxy 側)
- **全採用の共通条件**: [0010](../adr/0010-standards-and-non-lockin.md) の vendor-independent 正当化 + adapters / seam 越しで差し替え可能に保つ(vendor 直参照を feature / component に散らさない)+ exact-pin + `pnpm audit`([0004](../adr/0004-library-management.md))

### 1.3 フロント実装レール(14 仕掛け)

丸ごと未 ADR の宣言であり、**本書がこれらの唯一の正である**(工程は [v1-implementation-plan.md](v1-implementation-plan.md) が持つ)。

**v1 で実施しないものが 2 件** — B9(v1 は Figma を使わない手順を採るため。**原則としては本節の記述が正**)/ B11(v1.x.x で追加)。いずれも本節の宣言そのものは有効である。

- **哲学 3 本柱**: ① 考えないでもフロントが組める ② デザイン(Figma 等)+ README を見れば実装できる ③ 責務分離されていて綺麗に実装できる

| # | 仕掛け | 効く柱 | 形態 | 要点 |
| --- | --- | --- | --- | --- |
| B1 | feature README = 仕様書テンプレート | ②① | rule+decision | 必須セクション(route / 使う operationId / **状態表 × デザイン参照** / 依存カーネル / Action 戻り値契約 / テスト観点)。参照先の形式(Figma フレーム / story)は fork 先が決める。テンプレ置き場 = `docs/templates/feature-readme.md`。readme-review の採点基準に接続 |
| B2 | スキャフォールドジェネレータ `pnpm gen` | ①③ | tooling+decision | `gen feature/component/adapter` で命名・配置・境界・テストを生成時点で正に |
| B3 | 契約駆動モック一気通貫(orval→MSW) | ①② | decision+tooling | OpenAPI → MSW + faker を生成し dev モック / integration / e2e を 1 パイプに |
| B4 | アーキテクチャ・マニフェスト SSOT | ③ | tooling+rule | `architecture.ts` に依存マトリクス・公開面・禁止名を宣言 → 各成果物生成 + drift ゲート |
| B5 | ゴールデンパス feature 同梱 | ①② | reference | 一覧 → 詳細 → フォームで全 ADR の交差点を踏む実物 + 削除コマンド |
| B6 | 意図別プレイブック「〜したくなったら」 | ① | reference | 意図 → 置き場 → 使う型 → 模範コードの逆引き + 決定木 |
| B7 | UI 状態契約(全画面 4 状態必須)+ デザイン状態マッピング | ②③ | rule | loading / empty / error / success を README 状態表でデザイン側と共有契約化。欠落は差し戻し |
| B8 | `ActionState<T>` 型をシップ | ①③ | decision+reference | フォーム戻り値の標準型をカーネルにコードで同梱。型が「考えない」を強制 |
| B9 | デザイントークン同期パイプ(Figma→CSS 変数) | ② | decision+tooling | Figma Variables = SSOT → W3C Tokens JSON → Tailwind v4 `@theme`。do-not-edit + drift ゲート。**v1 では実施しない**(v1 実装計画 §3.11 の手順上の例外。原則としては本行が正) |
| B10 | 決定 → 機械強制トレーサビリティ台帳 | ③ | rule+tooling | 各 ADR の enforcement 方式を明記し「散文のみ」削減を v1 KPI 化 |
| B11 | 構造 CI ゲート(README 必須節・feature 完全性 lint) | ②③ | tooling | README + 必須見出し + 4 状態行の存在、README 列挙 export と実ファイル突合。**v1 対象外(v1.x.x)** |
| B12 | 実装スキル `new-feature`(全提案を束ねる AI 動線) | ①②③ | tooling | デザイン参照 + feature 名 → B6 読込 → B2 生成 → B1 README 記入 → B3 モックで実装 → ゲート(B11 は v1.x.x のため v1 では `lint:ci` / test / README 必須節) |
| B13 | カーネル公開面の物理規約 + per-kernel 機械可読 frontmatter | ③ | rule+tooling | barrel 可否確定 + 各 README 冒頭に `imports-allowed:` / `forbidden:` / `test-requirement:` |
| B14 | Definition of Done を PR テンプレへ焼き込む | ③② | rule | 4 状態 / a11y 手動チェック / README 更新 / カバレッジ例外記録 |

- **最重要打ち手 = B1 + B2 + B5**「仕様書付きスキャフォールド」の一体運用。理由 = スキャフォールドだけが「迷いが発生する前」に介入できる唯一の装置であり、lint / CI は事後の防波堤、プレイブックは迷子の救済にすぎない。次点 = B3(orval → MSW)・B10(kebab lint 化等)は既選定ツールの標準機能で実現でき追加コストが小さい
- **ADR 化せずコードで確定する主要 4 件**: 素の form 書き方 + `ActionState<T>` 同梱([0061](../adr/0061-form-mutation-ux.md) / [0080](../adr/0080-error-handling.md) と接続)/ barrel・公開面の物理表現(B4 / B13 → ESLint boundaries 実装をアンブロック)/ ゴールデンパス feature(B5)/ E2E・dev モック戦略(B3 orval → MSW)
- **進め方**: ADR の decision で自然に決まるものは二重決定しない / tooling・reference は ADR 不要(規約に昇格するものだけ ADR 化)

### 1.4 棄却(据え置き除外)

- **v1 / v2 とも採用しない 3 件**: キーボードショートカット / Prettier / Renovate。撤回条件は [BACKLOG](../adr/BACKLOG.md#撤回条件-決定を見直すトリガ) が持つ
- **印刷 CSS は棄却しない**: [0051](../adr/0051-styling-system.md) §4 が print CSS をフロント領域の拡張点として採り、最小の実装を `foundation/print` として同梱する。棄却は PDF 生成(backend 責務)の側だけである
- **ADR 化済みの exclusion**(参照のみ): [0121](../adr/0121-i18n-strategy.md)(i18n 本体)/ [0130](../adr/0130-pwa-strategy.md)(PWA 本体)等
- **v1 では入れない**: PostHog 本体。CMP・IAB TCF 等の本格的な同意管理も対象外。GTM 本体は同意ゲートの裏へ同梱する側へ反転済みで、決定は [0131](../adr/0131-cookie-consent.md) §2 が持つ
- [0011](../adr/0011-no-docker.md) の性格転換(「用途未定の表示層」→「オピニオン付き全部入り starter」)は **v2 時点**の話。v1 の 0011 は「アプリケーション基盤」で現状維持とする

---

## 2. 実装ロードマップ

**[v1-implementation-plan.md](v1-implementation-plan.md) が正。** 本書は工程を持たない。

---

## 3. 本書の運用

- **living 運用**: 確定事項が ADR へ昇格した場合は、本書から削除して ADR を参照する形に置き換える
- 判断の経緯・比較検討は本書に書かない(決定は ADR へ、rule は `docs/rules.md` へ、工程は v1 実装計画へ集約する)
- **go-boilerplate 移植は one-off**: 移植後に go 側が改善されても追従は自動化しない。必要になった時点で go 側を再走査する
