# フォント・画像

フォントと画像の **`next/font` / `next/image` の使い方 / `public/` の扱い / 動的 OG 画像** の規約を定める。Next.js 組込み機構を追認し、最小の運用ルールを敷く。

## Status

Accepted

## 背景

`next/font` / `next/image` の使い方・`public/` の扱い・動的 OG 画像は、いずれも Next.js が組込み機構を持つ領域である。本 ADR はその組込み機構を既定とする方針を定め、独自の代替を持ち込まない。

## 決定

### 1. フォント = `next/font`

- Web フォントは **`next/font`** で読み込む(セルフホスト・レイアウトシフト抑制・`preload`)。外部 CDN からの直接読み込みや手動 `@font-face` は避ける
- フォント定義の適用は `src/app/layout.tsx`(ルート)を基点とする([0027](0027-directory-structure.md))。定義そのものは同階層へ切り出し、**カタログ(Storybook)からも同じ定義を読む**。二重に書くと、カタログだけが素の書体で表示され基準画像が実物と一致しない
- **書体の役割(本文 / 銘 / 等幅)は design token の semantic 層が持つ**([0051](0051-styling-system.md))。`next/font` が配る変数は素性を表す primitive として受け、部品は役割の名前だけを参照する。**本文の和文書体は Web フォントで持たず、OS 同梱の書体へ委ねる**([0051](0051-styling-system.md) §5)。系統(`data-surface`)ごとに替えられる仕組みは残すが、本文書体はその軸に含めない

### 2. 画像 = `next/image`

- ラスター画像は **`next/image`** を用いる(最適化・遅延読み込み・レイアウトシフト抑制)。生の `<img>` は原則使わない(装飾的 SVG 等の例外は可)
- 配送前提([0011](0011-no-docker.md))に応じて画像最適化の loader を選ぶ(PaaS の組込み最適化か、静的書き出し時の loader かは配備先で決める)

### 2.1 バックエンド由来画像 = public storage 前提・自前の配信レイヤを持たない

- バックエンドが返すのは**オブジェクトキー**(例: `{資源}/{uuid}.{ext}`)であり、**表示 URL の組み立てはフロントの責務**とする(backend にフル URL を保存させない)
- ストレージは **public storage**(匿名 read 可 / listing 不可)を前提とする。したがって本リポジトリに**配信プロキシ(Route Handler)を置かない**。持つのは配信オリジンを前置する純関数(`mediaUrl()`)と `next.config.ts` の `images.remotePatterns` のみで、最適化は `next/image` が単独で担う
- 配信オリジンは env(`MEDIA_ORIGIN`)で供給する([0030](0030-environment-variable-management.md))。`remotePatterns` と CSP の `img-src`([0111](0111-csp-security-headers.md))の**両方**に同一オリジンを登録し、**ワイルドカードは使わない**
- **`mediaUrl()` はオリジンの前置ではなく閉じ込めである。** キーは検証されないまま届くため、`data:` のように自分でスキームを持つ値は前置をすり抜けて配信元の外を指す。`next/image` はスキームを持つ値を最適化の経路から外すので、`remotePatterns` の許可はこの経路に効かない。**組み立てた URL が配信元の下に収まらなければ表示 URL を作らない**(代替画像へ倒す)
- private なオブジェクトを扱う必要が生じた場合は、署名付き URL の発行を backend の責務とする([0075](0075-file-upload-seam.md) と同型)。フロントに配信レイヤを生やして解決しない
- **通常の API 契約に blur プレースホルダ(`blurDataURL`)は載せない** — バックエンド由来画像では自前供給が必要で、一覧レスポンスが件数分肥大するため。`MediaImage` は `next/image` 標準の `placeholder` / `blurDataURL` を明示的に渡す利用(静的 import を含む)は妨げない。一方、既定は `components` カーネルの**アスペクト比固定 + CSS Skeleton**によるローディングとし、`"use client"` を要しない。LCP になる画像(一覧先頭・詳細のメイン)は `preload` を指定して Skeleton を挟まない

### 3. `public/` の扱い

- `public/` は **静的アセット(favicon / 装飾画像 / 静的ファイル)** の置き場とする([AGENTS.md](../../AGENTS.md) AI Modification Scope で追加が許可される数少ないルート外パス)。ビルドを要さず配信されるものに限る
- コンポーネントに結合する画像は **static import して `next/image` に渡す**のを推奨する(幅・高さ・`blurDataURL` が自動決定され CLS 防止に載る)。`public/` のパス文字列を `next/image` に渡す場合も最適化自体はされるが、`width` / `height` の手動指定が必要になる。`next/image` を介さない直リンク参照は最適化に載らない

### 4. 動的 OG 画像

- 動的 OG 画像は Next.js の **`ImageResponse`(`opengraph-image` 特殊ファイル)** で生成する([0028](0028-naming-convention.md) の特殊ファイル命名)。メタデータ全般は [0044](0044-seo-metadata-strategy.md) が所有する App Router の Metadata API で扱う

## 禁止事項

- ❌ Web フォントを外部 CDN 直参照 / 手動 `@font-face` で読むこと(`next/font` を使う)
- ❌ ラスター画像に生の `<img>` を使うこと(`next/image`。装飾 SVG 等は例外)
- ❌ `public/` にビルドを要する / 秘匿すべきファイルを置くこと(静的公開アセットのみ)
- ❌ バックエンド由来画像のために自前の配信経路(`/cdn` 等の Route Handler プロキシ)を作ること(§2.1。public storage + `next/image` で賄う)
- ❌ `images.remotePatterns` にワイルドカードのオリジンを登録すること(配信元は明示的に列挙する)

## 関連 ADR

- [0044-seo-metadata-strategy.md](0044-seo-metadata-strategy.md) — SEO / メタデータ戦略(OG 画像・メタデータの所有者。責務境界を共有)
- [0040-routing-rendering-strategy.md](0040-routing-rendering-strategy.md) — App Router / Metadata API / 特殊ファイル
- [0027-directory-structure.md](0027-directory-structure.md) — `src/app/` / `public/` 配置
- [0028-naming-convention.md](0028-naming-convention.md) — `opengraph-image` 等の特殊ファイル命名
- [0011-no-docker.md](0011-no-docker.md) — 配送前提(画像最適化 loader の選択)
- [0051-styling-system.md](0051-styling-system.md) — 書体の役割(semantic 層)と和文本文書体の扱い
- [0101-performance-budget.md](0101-performance-budget.md) — フォント / 画像は CWV(LCP / CLS)に直結
