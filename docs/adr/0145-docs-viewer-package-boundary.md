# docs-viewer のパッケージ境界

本プロジェクトでは、ドキュメントポータルのビューアー（`docs-viewer/`）をアプリ本体とは別の workspace パッケージとして置き、依存を共有しない。ビューアーはアプリ本体のソースを参照するが、アプリ本体からビューアーへは到達できない。**この分離を規約ではなくパッケージ境界で担保する。**

[0141](0141-portal-operations.md) は portal の manifest・生成・配信を持ち、ビューアーが独立パッケージであることまでを述べる。本 ADR が持つのは、その境界が何を分け、何を分けず、何によって守られているかである。

## Status

Accepted

## 採用理由 / 目的

- **無害化の許容範囲が違う。** アプリ本体が sanitizer に通すのは利用者が投稿する内容で、`src/model/rich-text` の allowlist は `table` も `pre` も `class` 属性も通さない。ビューアーが描くのはリポジトリ自身が持つコミット済みの文書で、表・コードブロック・図が出せなければ用を成さない。広い allowlist と狭い allowlist を同じパッケージに並べると、広い方をアプリから import することを止めるものが規約しか無くなる
- **供給面を分ける。** ビューアーが引く依存（Markdown の変換、図の描画、検索）がアプリ本体の依存一覧に乗らない。アプリの bundle にも、アプリの依存として監査される集合にも現れない
- **デザインシステムの実利用者を持つ。** ビューアーは部品を Storybook の外で、実データ量・実文書長・実際の組み合わせで使う最初の利用者である。この役割はコピーでは果たせない

## 独立した workspace パッケージ

- `pnpm-workspace.yaml` の `packages` にアプリ本体（`.`）と `docs-viewer` を並べ、ビューアーは自分の `package.json` を持つ
- ビルドは Vite で、Next.js のランタイムに乗らず、静的サイトとして単体でビルドされる。**Next.js 固有の API（`next/link` / `next/image` / Server Components）は使わない**
- 配信先のパス接頭辞を持たない（`base: "./"`）。portal の URL は配信側が決める（[0141](0141-portal-operations.md)）

## 依存の向きは一方向

**ビューアー → アプリ本体だけを許す。**

- ビューアーは `@` alias でアプリ本体の `src/` を直接参照し、デザインシステムの部品をそのまま使う。コピーしない —— コピーすると乖離した時点で、実運用でデザインシステムを検証するという目的が失われる
- アイコンもアプリ本体と同じ公開面（`src/components/icon.ts`）から取る。ビューアー側で供給元を名指しできると、名指しできる場所がワークスペースに 2 つできる（[0052](0052-ui-component-policy.md)）

**アプリ本体 → ビューアーは無い。** これを守るのは規約ではなく次の 3 つである。

1. **広い allowlist は `docs-viewer/src/` に住む。** `@/` の解決先は `src/` であり、そこからは届かない
2. **`src/` の境界検査は、宣言した要素の外を指す依存を拒む**（`boundaries/no-unknown-dependencies` —— [0021](0021-frontend-responsibility.md)）。相対パスで越えても `lint:ci` が落ちる
3. **ビューアーだけが引く依存はアプリ本体の `package.json` に無い。** パッケージ名で import しても解決しない

## 分けないもの

パッケージを分けるのは依存と到達性であって、品質ゲートではない。

- **テストは同じ gate で回す。** ビューアーのテストはアプリ本体と同じ Vitest の suite に載せる。別 suite にすると片方だけが緑という状態を作れてしまい、CI の判定が「全部通った」を意味しなくなる（[0090](0090-testing-strategy.md)）
- **lint と型検査もリポジトリの根の設定が見る。** ビューアー向けの例外は、根の設定の中で対象を絞って書く
- **依存の冷却期間と推移的依存の固定は workspace 全体に一律に効く**（`pnpm-workspace.yaml` の `minimumReleaseAge` / `overrides` —— [0110](0110-security-operations.md)）。ビューアーの依存はアプリの供給面には乗らないが、公開される配信物の中で browser 上を走る。監査の対象から外れる理由にはならない

## ビューアーの依存

- **単独で完結する部品に寄せる。** 対に `-native` / `-client` がある部品は、要件が許す限り `-native` を優先する
- **純粋ロジック（文書の解釈・言語の絞り込み・検索・経路）は検証ライブラリ以外に依存させない。** 描画と切り離して持ち出せる状態を保つ
- ビューアーが読む `docs.json` は生成物で、ビューアーは内容の出所を持たない（[0141](0141-portal-operations.md)）

## 不採用

| 対象 | 理由 |
| --- | --- |
| **規約で担保する**（「ビューアーの sanitizer をアプリから import しない」と書く） | 破った import を止めるものが無い。レビューで読まれなかった変更がそのまま通る |
| **アプリ本体の sanitizer の allowlist を広げる／引数で切り替える** | 投稿された内容と自前の文書が同じ口を通る。切り替えの引数 1 つで投稿側の許容範囲が広がる |
| **ビューアーを Next.js の route としてアプリに同居させる** | ビューアーの依存がアプリの供給面に乗る。配信は静的で足り、Next.js のランタイムを要さない |
| **デザインシステムの部品をビューアーへコピーする** | 乖離した時点で、実運用で検証するという役割が消える |
| **ビューアーのテストを別 suite にする** | 片方だけが緑になれる |

## 禁止事項

- ❌ `src/` から `docs-viewer/` を import すること（向きは一方向）
- ❌ ビューアーの allowlist をアプリ本体の sanitizer へ写すこと、または共有すること
- ❌ ビューアーだけが使う依存をアプリ本体の `package.json` に置くこと
- ❌ デザインシステムの部品をビューアーへコピーすること
- ❌ ビューアーで Next.js 固有の API を使うこと
- ❌ ビューアーのテストをアプリ本体と別の gate へ分けること

## 関連 ADR

- [0001-package-manager.md](0001-package-manager.md) — pnpm（workspace の機構）
- [0004-library-management.md](0004-library-management.md) — 依存の選定・固定
- [0021-frontend-responsibility.md](0021-frontend-responsibility.md) — 層境界の機械強制（`src/` 側で越境を落とす検査）
- [0052-ui-component-policy.md](0052-ui-component-policy.md) — アイコンの公開面
- [0054-ui-catalog-storybook.md](0054-ui-catalog-storybook.md) — 部品の語彙（ビューアーはその外の実利用者）
- [0090-testing-strategy.md](0090-testing-strategy.md) — 1 つの gate で回すテスト
- [0110-security-operations.md](0110-security-operations.md) — 冷却期間と推移的依存の固定
- [0140-documentation-operations.md](0140-documentation-operations.md) — 文書運用（ビューアーが描く canonical）
- [0141-portal-operations.md](0141-portal-operations.md) — portal 運用（本 ADR の親決定）
- [0153-ci-configuration.md](0153-ci-configuration.md) — GitHub Pages への配信 workflow
