# PWA 戦略(exclusion)

PWA(Progressive Web App)— **Web App Manifest / Service Worker / オフライン対応** を **同梱しない** ことを意図的な除外(exclusion)として記録し、採用する場合の Next.js 上の seam のみ示す。

## Status

Accepted (exclusion; v2 に局所採用を予定)

## 背景

用途依存の「やらない」判断は、沈黙のままだと意識的に線引きした痕跡が残らない。i18n([0121](0121-i18n-strategy.md))と同じく、PWA も exclusion として明文化する。

Next.js には Web App Manifest のファイル規約(`app/manifest.(json|ts)`)が存在するが、Service Worker / オフラインキャッシュは Next.js の自動組込み機構ではなく、個別の実装(または外部ライブラリ)を要する。PWA が有用かは**配信形態・オフライン要件・インストール可能性の要否に強く依存**する。本体には manifest / Service Worker の設置面が存在しないため、seam をコードとして置かず、本 ADR が記すのは**採用時の拡張点の座標**である。

## 決定: 同梱しない(用途依存)

- **Web App Manifest / Service Worker / オフラインキャッシュ / インストール促進(A2HS)を 同梱しない**。用途依存のため、必要になった時点で判断する
- 導出根拠: [0011](0011-no-docker.md) の「用途未定の表示層」ロール —— 用途依存の判断を本体で先取りしない([0121](0121-i18n-strategy.md) と同じ論理)
- **本体側の採用は v2 に予定し、局所ライブラリ(Serwist〈`@serwist/next`〉)を下記 seam に置く形を採る。** その場合も本体は seam を保持し、ライブラリは [0010](0010-standards-and-non-lockin.md)(vendor-independent 正当化 / adapters・カーネル境界の裏で差替可能 / vendor 直参照を feature・component に散らさない)と [0004](0004-library-management.md)(exact pin / `pnpm audit`)の枠内で置く
- **PWA を採用する場合の seam**(参考):
  - Web App Manifest は Next.js の **`app/manifest.(json|ts)`** ファイル規約で生成する([0044](0044-seo-metadata-strategy.md) のアイコン体系と接続。アイコンは `app/icon.*` / `apple-icon.*`)
  - Service Worker / オフラインキャッシュは Next.js の自動組込みが無いため自前で実装する。外部ライブラリを使う場合も [0004](0004-library-management.md)(exact pin / `pnpm audit`)・[0021](0021-frontend-responsibility.md)(カーネル配置・命名規律)の枠内で行う

## exclusion の扱い

- 本 ADR は「意図的にやらない」判断の記録である([0140](0140-documentation-operations.md) タクソノミー: exclusion = ADR)。導入する分にはこの exclusion は障害にならない

## 関連 ADR

- [0011-no-docker.md](0011-no-docker.md) — 用途未定の表示層ロール(用途依存とする根拠)
- [0121-i18n-strategy.md](0121-i18n-strategy.md) — 用途依存を exclusion 記録する同型の判断
- [0044-seo-metadata-strategy.md](0044-seo-metadata-strategy.md) — `manifest.*` / アイコン体系の seam(採用時)
