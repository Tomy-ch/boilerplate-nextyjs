# ポータル運用

ドキュメントポータル(`docs/portal/`)の **manifest 構造 / 登録基準 / portal ↔ docs の責務分担 / 生成・配信の仕組み / 運用スキル / 実装状況** を定める。[0140](0140-documentation-operations.md) の三層戦略の第 3 層(生成 portal)を具体化する。

## Status

Accepted

## 背景

portal は canonical ドキュメントの生成ビューである。何を載せるかの登録基準と、portal と docs の責務分担が無いと、portal は全 README の網羅辞書へ流れ、内容の SSOT が 2 つになる。本 ADR は登録基準と責務分担を定める。

## 決定

### 1. manifest = 構造の単一ソース(curated manual)

- **`docs/portal/manifest.yaml`** を portal 構造の単一ソースとする。2 部構成:
  - **`meta:` ブロック(可視構造)**: `groups`(サイドバー最上位ページ順・各 `sections`)/ `subgroups`(section を役割別に再分割)/ `section_titles`(表示名上書き)/ `reference_links`(生成 HTML への常設クイックリンク。例: openapi / coverage)
  - **section エントリ(`meta` 以外)**: `{src, dst}` コピーペア。`src` = リポ内 canonical README、`dst` = `docs/portal/guides/<flat-name>.md`
- **原則「manifest = キュレーション済み手引き であって 辞書ではない」**。portal は人間が読むキュレーション済みの叙述マニュアルであり、全 README の網羅辞書ではない。一括追加はキュレーションを壊し、概念の流れを部品単位のノイズの下に埋める

### 2. 登録基準(手動登録 vs 自動発見)

- **コード package / 層の README(`src/**/README.md` 等)は manifest に手動登録**して `guides/` へコピーする(curation は人間判断)
- **`docs/<dir>/*.md` 直下のドキュメントは FS スキャンで自動発見**する(配置・タイトルは `meta:` 由来、ファイル列挙のみ生成スクリプト側)
- **未登録の on-disk README は drift ではなく「curation 判断待ちの候補」**として扱う(自動追加しない)

### 3. portal ↔ docs の責務分担

- **manifest = 構造制御のみ**(何をどのグループ / section に、どの順で置くか)。**カードの中身は README が正**([0140](0140-documentation-operations.md) canonical / [0021](0021-frontend-responsibility.md) per-package README)
- portal は **canonical ドキュメントの生成ビュー**であり、内容の SSOT を持たない(内容は canonical README / `docs/**` 側)

### 4. 生成・配信

- **生成スクリプト(`scripts/portal/`)**: manifest の `src`→`dst` コピー(`gen-portal-docs`)/ manifest + FS スキャンから `docs.json` 出力(`gen-docs-json`)。判断はいずれも純粋関数へ寄せ、FS 入出力は CLI 側に閉じる(テスト可能性)
- **ビューアーは独立した workspace パッケージ(`docs-viewer/`)**、ビルドは **Vite**。パッケージを分けるのは**無害化の許容範囲がアプリ本体と違う**ためで、ドキュメントに必要な広い allowlist(`table` / `pre` / `img` / `language-*` class)を **アプリから import できない位置**へ置く。分離を規約ではなくパッケージ境界で担保する。esbuild ではなく Vite なのは、デザイントークンを通すのに Tailwind のビルドが要るため
- **配信 = GitHub Pages**。`production` への push で発火する。**Pages はリポジトリに 1 サイトしか持てない**ため、`docs/` をサイトルートへ写し、portal を `/portal/`、Storybook を `/storybook/` と兄弟に並べる。ルートは入口への転送だけを持つ
- **deep-link は位置ハッシュ(`#/<group>/<section>`)で表すため、404 fallback を必要としない**。経路がサーバへ届かない
- **boilerplate 内から portal を指すリンクは、テンプレートから作った後に `make setup-replace-repository-reference` が差し替える**。既定は `<owner>/<repo>` から組み立てたサイトルートで、custom domain は `PORTAL_URL` で上書きする。置換前は汎用リンクが生きるよう、`portal` マーカー(`portal:replace-*`)で 2 本を切り替える。**マーカーの族を既存に相乗りさせないのは、走らせる道具が違うためである** — 既存の 2 族は印の付いた行を消して完結するが、`portal` は値の差し込みを伴い、リポジトリ参照の置換と同じ一手で走る([0152](0152-agents-md-policy.md) が族の分割そのものを持つ)
- **生成物(`guides/` / `docs.json`)は追跡しない**。配信時に組み立てるため drift が発生しえず、drift 検出の仕組みを持たない

### 5. 運用スキルループ

- **readme-review**(内容の manual-worthy 判定 = 基準の単一ソース)→ **portal-manifest-sync**(manifest への登録キュレーション。編集は `manifest.yaml` のみ・自動追加しない)/ **sync-readme**(構造ドリフト整合)。スキル体系は [0155](0155-claude-skills-development.md)(開発系。配置・命名・frontmatter は [0154](0154-claude-skills-operations.md) と共通)
- 判定基準は現行 manifest から runtime 参照する(基準を複製しない)。基準語彙は登録済みエントリから再導出し、**部品リファレンス README(`src/components/**` の定型)と feature slice は判定の対象外**とする —— 前者は Storybook と TSDoc が、後者は `docs/templates/feature-readme.md` の必須節検査が持つ

### 6. 実装状況

- **Pages の有効化と、`github-pages` environment の deployment branch policy への配信元ブランチの許可は `make pages-delivery-apply` が持ち、`make setup-repo` が呼ぶ**。許可が無いと `docs-deploy` は job としては起動するが step を 1 つも実行せずに落ち、ログに理由が出ない —— 配信元は workflow の push トリガと 1 箇所で揃える必要があり、人手の手順に置くと落ちても気付けない
- drift の機械検出は生成スクリプトが持ち(`portal:guides` は stale で非 0、`portal:docs` は構造の警告を出す)、`portal-manifest-sync` はそれを読み取ったうえで、生成側が黙って飲み込む配置(`Other` へ落ちる登録)と curation 候補の分類を担う

## 禁止事項

- ❌ manifest に内容(カードの本文)を持たせること(内容は canonical README が正。manifest は構造制御のみ)
- ❌ 未登録 README を drift 扱いして自動登録すること(curation は人間判断)
- ❌ 生成物(`docs.json` / `dist/**`)を手編集すること
- ❌ portal を全 README の網羅辞書にすること(キュレーション済み手引き)

## 関連 ADR

- [0140-documentation-operations.md](0140-documentation-operations.md) — canonical / 三層戦略・per-package README(本 ADR の親決定。portal は第 3 層)
- [0021-frontend-responsibility.md](0021-frontend-responsibility.md) — 層別 README(portal カードの供給元)
- [0155-claude-skills-development.md](0155-claude-skills-development.md) — readme-review / sync-readme / portal-manifest-sync の公認(開発系。配置・命名・frontmatter は [0154-claude-skills-operations.md](0154-claude-skills-operations.md) と共通)
- [0153-ci-configuration.md](0153-ci-configuration.md) — GitHub Pages 配信の workflow(Documentation グループ)
