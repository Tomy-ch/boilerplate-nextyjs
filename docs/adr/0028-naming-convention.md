# 命名規則

[0027](0027-directory-structure.md)(ディレクトリ構造)で確定した物理配置の上で用いる、**ファイル名 / 識別子(コンポーネント・hook・関数・型・定数)/ route セグメント / 環境変数 / ADR ファイル** の命名規約を定める。

カーネル・ディレクトリそのものの命名規律(役割名のみ許可 / `common` `utils` `lib` 等の禁止名)は [0021](0021-frontend-responsibility.md)「命名規律」を正とし、本 ADR では**繰り返さない**。本 ADR はその内側の、ファイル・識別子の命名を扱う。

## Status

Accepted

## 背景

本リポジトリの命名は **Next.js の規約 > React の規約 > 本リポジトリ(nextjs-boilerplate)自身の既存規約** の優先順位で決め、**できる限り業界スタンダードに寄せる**。命名の第一義的な拠り所は Next.js / React と業界スタンダードであり、バックエンド側の規約を命名の権威には置かない(層原則は揃えるが、命名はフロントの生態系に従う)。

この優先順位を適用するにあたり、Next.js 16 のドキュメントが**どこを規約化し、どこを規約化していないか**を確認した:

- **Next.js が規約化している範囲**: 特殊ファイル(`page` / `layout` / `route` 等 = 小文字固定)と route セグメント記法(`[slug]` / `[...slug]` / `(group)` / `_folder`)のみ
- **Next.js が規約化していない範囲**: コンポーネント / hook / その他モジュールのファイル名・組織化。Next.js のドキュメントは "**Next.js is unopinionated about how you organize and colocate your project files**"(`project-structure`)と明言し、`components` / `lib` / `ui` / `utils` / `hooks` は "generalized placeholders" で "no special framework significance" とする

したがって:

- **特殊ファイル・route** は Next.js 規約(小文字)に従う
- **それ以外のファイル名**は Next.js が非強制なので**業界スタンダード**に委ねる。Next.js エコシステムのデファクト(公式サンプル / shadcn/ui)・ファイルシステム安全性(case-insensitive FS での衝突回避)・本リポジトリ既存ファイル(`src/app/layout.tsx` / `page.tsx` が小文字)のいずれとも整合する **kebab-case** を採る
- **識別子**(コンポーネント名・hook 名等)は React/JSX が構文的に強制する(コンポーネント = PascalCase 必須)ため React 規約に従う

env / ADR / テストの命名形式は、**本リポジトリ自身の既存規約・関連 ADR を正**とする(ADR ファイル = 本リポの `docs/adr/README.md` / 環境変数 = [0030](0030-environment-variable-management.md) / テスト = [0090](0090-testing-strategy.md))。

## 決定

### ファイル名 — 全ソース kebab-case(Next.js 非強制領域 → 業界スタンダード)

ソースファイル名は **kebab-case で統一**する。ファイル名(kebab-case)と、その中の主 export の識別子(下記「識別子」ルール)は**別軸**であり、ファイル名側は種別によらず kebab-case とする。

| 対象 | ファイル名 | 主 export の識別子 | 例 |
| --- | --- | --- | --- |
| React コンポーネント | **kebab-case** | PascalCase | `user-card.tsx` → `UserCard` |
| hook | **kebab-case**(`use-` 始まり) | `use` + PascalCase | `use-login.ts` → `useLogin` |
| その他モジュール(model / adapters / 関数群) | **kebab-case** | camelCase | `format-date.ts` → `formatDate` / `api-client.ts` → `apiClient` |
| Next.js 特殊ファイル | **小文字固定(Next.js 規約)** | — | `page.tsx` / `layout.tsx` / `loading.tsx` / `error.tsx` / `not-found.tsx` / `route.ts` / `template.tsx` / `default.tsx` / `global-error.tsx` |
| 起動 / 設定ファイル | **Next.js / ツール規約の固定名** | — | `instrumentation.ts` / `proxy.ts`(Next.js 16 の旧 `middleware.ts`。[0043](0043-middleware-policy.md))/ `next.config.ts` |
| Server Action 集約 | **`actions.ts`**(固定名) | — | `features/<name>/actions.ts`([0021](0021-frontend-responsibility.md)) |

- 従来型 React 慣行(コンポーネントファイルを PascalCase = `UserCard.tsx`)は**採らない**。Next.js エコシステムの業界スタンダードと case-insensitive FS 安全性を優先し、ファイル名は全種別 kebab-case に統一する
- kebab-case 統一により、ファイル種別に依らず 1 つの規則で済み、ケース混在・大文字小文字衝突が構造的に起きない

### route セグメント名(App Router — Next.js 規約)

- ルートセグメントのディレクトリ名は **Next.js App Router の規約に従い小文字**とする(`app/users/` / `app/sign-in/` 等。複数語は kebab-case)
- Next.js の記法に従う(独自パターンを作らない):
  - 動的: `[slug]`(動的)/ `[...slug]`(catch-all)/ `[[...slug]]`(optional catch-all)
  - route group: `(group)`(URL に影響しないグルーピング)
  - private folder: `_folder`(非ルーティングのコロケーション用。将来の Next.js 特殊ファイルとの命名衝突回避にも有効)

### 識別子(React / TypeScript 規約)

React/JSX の構文的制約と業界スタンダード(非ハンガリアン記法)を合わせ、以下で固定する:

| 対象 | ケース | 備考 |
| --- | --- | --- |
| React コンポーネント | **PascalCase** | JSX 構文上必須(React 規約) |
| hook | **`use` + PascalCase**(呼称は `useCamelCase`) | `useLogin` / `useUser`。React の規約 |
| 関数・変数 | **camelCase** | |
| 型 / interface | **PascalCase** | **`I` プレフィックス禁止**(TypeScript の業界スタンダード = 非ハンガリアン) |
| 真の定数(モジュールレベルの不変値) | **UPPER_SNAKE_CASE** | 列挙的定数等。環境変数の値は対象外(UPPER_SNAKE 定数として再公開せず、型付き Config の getter 経由で参照する — [0030](0030-environment-variable-management.md)) |
| 型付き Config のプロパティ | camelCase(getter 名) | 中身は [0030](0030-environment-variable-management.md) |

### 環境変数

- 環境変数名は **`{SUBSYSTEM}_{NAME}` の UPPER_SNAKE_CASE**(UPPER_SNAKE は環境変数の業界スタンダード。`{SUBSYSTEM}` はサブシステム prefix(例 `SERVER_` / `AUTH_`)でグルーピングし、`{NAME}` は相対名)。この形式の採用は [0030](0030-environment-variable-management.md) の決定に連なる
- ブラウザへ露出する変数は Next.js 規約に従い **`NEXT_PUBLIC_` プレフィックス**を付す(`NEXT_PUBLIC_{SUBSYSTEM}_{NAME}`)。境界・検証・型付けの詳細は **[0030](0030-environment-variable-management.md)(環境変数管理)** を正とする
- **例外: 標準・デファクトが変数名まで規定しているものは、その標準名をそのまま使う**(例: OpenTelemetry の `OTEL_EXPORTER_OTLP_ENDPOINT` / `OTEL_SERVICE_NAME`、Next.js の `NEXT_PUBLIC_*` / `PORT`)。標準名を `{SUBSYSTEM}_{NAME}` へ改名すると、その標準を実装した SDK・ツールが既定で読めなくなり、自前の橋渡しコードが必要になるため([0010](0010-standards-and-non-lockin.md) 標準準拠)。例外に該当するのは **外部の仕様・ツールが読む変数だけ**であり、アプリが自分で読む変数は例外にしない

### ADR ファイル名

- ADR ファイルは **`NNNN-kebab-case-title.md`**(4 桁ゼロ埋め番号 + kebab-case タイトル)とする。これは**本リポジトリ自身の既存規約**(`docs/adr/README.md`)であり、ソースファイルの kebab-case 方針とも一致する
- 採番はトピック順のブロック帯(10 番台 = 主題ブロック)であり、採番のライフサイクルは [0140](0140-documentation-operations.md) が持つ。プレフィックス付きの採番(`Dev-` / `Toolchain-` 等)は用いず、すべて数値列に置く

### テストファイル命名

- テストファイルの拡張子・`describe` / `it` 文字列の規約は [0090](0090-testing-strategy.md) が正(kebab-case + `.test.ts(x)`。`正常系` / `異常系` の日本語命名・table-driven 禁止を含む)。ファイル名の本体部分が kebab-case であることは本 ADR の統一方針に従う

## 禁止事項

- ❌ ソースファイル名に PascalCase / camelCase を用いること(`UserCard.tsx` / `formatDate.ts` 等)。ファイル名は kebab-case で統一する
- ❌ ケースの混在(kebab-case 以外のファイル名を持ち込む)
- ❌ 型 / interface への `I` プレフィックス(`IUser` 等)
- ❌ App Router 特殊ファイル・route セグメントに独自の命名パターンを持ち込むこと(Next.js 規約に従う)
- ❌ 環境変数を `{SUBSYSTEM}_{NAME}` 以外の形にすること(標準名の例外に該当する場合を除く)/ secret を `NEXT_PUBLIC_` に置くこと([0030](0030-environment-variable-management.md))
- ❌ 標準が規定する変数名(`OTEL_*` 等)を `{SUBSYSTEM}_{NAME}` へ改名すること(標準実装が読めなくなる)
- ❌ カーネル・ディレクトリに役割を名指ししない名称を付けること([0021](0021-frontend-responsibility.md) 命名規律。本 ADR の対象外だが再掲)

## 補足

- 本 ADR が持つファイル・識別子命名は rule 分類([0140](0140-documentation-operations.md))に当たる。本 ADR は根拠(なぜ)を持ち、日々強制される制約としての置き場は [0140](0140-documentation-operations.md) が定める `docs/rules.md` である

## 関連 ADR

- [0027-directory-structure.md](0027-directory-structure.md) — 物理配置(本 ADR のファイル命名が載る土台)
- [0021-frontend-responsibility.md](0021-frontend-responsibility.md) — カーネル・ディレクトリの命名規律(役割名のみ・禁止名)。本 ADR はその内側のファイル・識別子命名を扱う
- [0030-environment-variable-management.md](0030-environment-variable-management.md) — 環境変数の境界・型付け・検証。本 ADR は命名形式のみを定める
- [0040-routing-rendering-strategy.md](0040-routing-rendering-strategy.md) — App Router セグメント構造。本 ADR はその命名(小文字・動的記法・route group・private folder)を定める
- [0090-testing-strategy.md](0090-testing-strategy.md) — テストファイルの拡張子・`describe` / `it` 命名
- [0140-documentation-operations.md](0140-documentation-operations.md) — ADR の採番ライフサイクル / rule 分類
