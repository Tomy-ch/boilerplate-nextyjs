# CursorPagination

## 用途

cursor 方式の一覧で、前後のページへ移動します。

## 役割と公開 component

| Component | 役割 |
| --- | --- |
| `CursorPagination` | 前後の移動を並べる `nav` です。行き先の URL を `previousHref` / `nextHref` として受け取ります。 |

## 利用ケース

- 総件数を返さない API の一覧で、前後へ 1 ページずつ移動する場合
- `nextCursor` を query へ載せて次を取得する一覧

ページ番号で任意の位置へ移動する一覧には `Pagination` を使います。

## Pagination との使い分け

| | `CursorPagination` | `Pagination` |
| --- | --- | --- |
| 前提 | cursor 方式（総件数・総ページ数を持たない） | page 方式 |
| 並べるもの | 前後の移動だけ | ページ番号と前後 |
| 任意の位置へ跳べるか | **跳べない** | 跳べる |

同じ「ページ送り」でも契約が別なので、片方をもう片方の代わりに使いません。

## 責務境界

SSR first の component です。`next/link` による URL 遷移だけで成り立つため、`"use client"`・React state・browser API を持ちません。

**URL の組み立ては呼び出し元が持ちます。** API が返す `nextCursor` を query へ載せることも、現在の絞り込みや並び順を引き継ぐことも呼び出し元の責務で、この component は受け取った `href` へ移動させるだけです。取得も再取得も行いません。

**前後移動の機構は独自に持ちません。** `Pagination` の `PaginationPrevious` / `PaginationNext` をそのまま合成しており、行き先が無い端を link ではなく操作できない control として描く挙動も、実体は [`Pagination`](../../design-system/navigation/pagination/README.md) 側にあります。この component が担うのは「ページ番号を並べない」という cursor 方式の契約です。

**行き先が無い向きは `href` を省略します。** 位置が保たれ、支援技術にも「あるが今は使えない」と伝わります。

同じ画面に複数の navigation が並ぶため、`aria-label` で何の移動かを示します。省略時は「ページ送り」になります。操作の文言は `previousLabel` / `nextLabel` で差し替えられ、アクセシブルな名前も一緒に変わります。

## Storybook とテスト

Storybook は前後どちらへも移動できる状態、先頭ページ、末尾ページ、1 ページに収まる場合、文言を差し替えた場合、`aria-label` で区別する場合を確認します。

テストは名前を持つ `navigation` として公開されること、ページ番号を持たず前後だけを並べること、行き先がある向きが `href` を持つ link になること、無い向きが操作できない control になること、行き先が無くても要素が残ること、文言と `aria-label` の差し替え、a11y 自動検査を確認します。
