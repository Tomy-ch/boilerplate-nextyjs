# `/about` このサイトについて（機能要件）

> 画面要件は [`page.screen.md`](page.screen.md)。

## レンダリング

**build 時に固める。** 取得を持たず、内容が変わるのはコードを書き換えたときだけである
（[0041](../../../../adr/0041-cache-components-decision.md)）。器も何も読まない
（[`../layout.function.md`](../layout.function.md)）。

## 認可

**保護の対象にしない。** 何のためのサイトかは、ログインする前に読めなければ意味を持たない。
