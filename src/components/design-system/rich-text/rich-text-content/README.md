# RichTextContent

## 用途

説明文や記事本文のように、書き手が構造を付けた文章を、読み手向けの本文として表示します。

## 役割と公開 component

| Component | 役割 |
| --- | --- |
| `RichTextContent` | sanitize 済みのリッチテキストを React 要素として描画し、`typeset` の組版を適用します。 |

| props | 型 | 役割 |
| --- | --- | --- |
| `content` | `SanitizedRichText` | 表示する内容。必須。 |
| `className` | `string` | 外枠へ重ねる class。`typeset-docs` などの組版 preset はここで渡します。 |
| そのほか | native `div` 属性 | `lang` / `dir` / `id` などをそのまま外枠へ渡します。 |

`children` と `dangerouslySetInnerHTML` は受け取りません。本文を決めるのは `content` だけです。
native `div` が持つ RDFa の `content` 属性も、名前を本文の props が占めるため指定できません。

## 使い方

### 最小の呼び出し

`content` は HTML 文字列ではなく `SanitizedRichText` です。構築経路は `SanitizedRichText.from`
だけで、この一段を通らない値は型として存在しません。

```tsx
import { RichTextContent } from "@/components/design-system/rich-text/rich-text-content/rich-text-content";
import { SanitizedRichText } from "@/model/rich-text/sanitized-rich-text";

export function Body({ html }: { html: string }) {
  return <RichTextContent content={SanitizedRichText.from(html)} />;
}
```

### 編集した内容を表示するまで

書く側は [`RichTextEditor`](../rich-text-editor/README.md)、表示する側がこの component です。
editor は内容が変わるたびに HTML 文字列を返し、保存した文字列を表示のたびに `SanitizedRichText.from`
へ通します。

```tsx
// 書く側（client island）。受け取った文字列は hidden input などで保存側へ渡す
<RichTextEditor label="説明" onChange={setHtml} />;

// 表示する側（Server Component）。保存済みの文字列をそのつど検査する
<RichTextContent content={SanitizedRichText.from(saved)} />;
```

**editor が返した文字列を検証済みとして扱いません。** editor が出せるタグが allowlist に
収まっているのは editor の設定が満たす性質であり、保存を経て戻ってきた文字列が満たす性質では
ないためです。表示の直前に必ず `SanitizedRichText.from` を通します。

### 組版 preset を重ねる

この component は `.typeset` を付けるところまでを担い、preset は付けません。字送りを変える場合は
[`typeset`](../../foundation/typeset/README.md) が公開する preset class を `className` へ渡します。

```tsx
<RichTextContent className="typeset-docs" content={content} />
```

### 文書としての意味論を与える

描画するのは `div` 一つで、`article` や `section` の意味論を持ちません。本文が何の文書なのかは
呼び出し元が外側の要素で示します。

```tsx
<article aria-labelledby="body-heading">
  <h2 id="body-heading">説明</h2>
  <RichTextContent content={content} />
</article>
```

### Client Component の内側に置く

`SanitizedRichText` は class instance で serializable ではないため、Client Component の props へは
渡せません。Client Component の内側へ本文を置く場合は、Server Component 側で描画した結果を
`children` として渡します。

```tsx
// Server Component
<ClientPanel>
  <RichTextContent content={SanitizedRichText.from(html)} />
</ClientPanel>
```

## 組み合わせる部品

| 部品 | 関係 |
| --- | --- |
| [`model/rich-text`](../../../../model/rich-text/README.md) | `content` の型と allowlist の owner。何を通し何を落とすかはここが決めます。 |
| [`rich-text-editor`](../rich-text-editor/README.md) | 書く側の相方。出力した HTML 文字列が、保存を経てこの component の入力になります。 |
| [`foundation/typeset`](../../foundation/typeset/README.md) | 組版の実体。`.typeset` と preset class を公開する CSS 基盤です。 |
| [`view-state/feedback-state`](../../../app-starter/feedback-state/README.md) | 本文が無い・取得に失敗した状態の表示。この component は空の枠を描くだけです。 |

## 利用ケース

- 編集画面で入力された説明文を、閲覧画面の本文として表示する場合
- backend から受け取った HTML を、表示してよい範囲だけに絞って本文へ載せる場合

## 責務境界

SSR first の選定では `◎` に当たります。state・browser API・event handler を持たない Server
Component であり、hydration は不要です。Server Component と Client Component のどちらからも
利用できますが、`content` を Client Component の props として渡すことはできません。

sanitize を持ちません。allowlist の定義も、HTML 文字列を検査して木にする処理も
`model/rich-text` が所有し、この component は受け取った木を描画するだけです。取得・保存・編集も
持たず、`content` をどこから得るかは呼び出し元が決めます。

描画は木から React 要素を直接作るため、HTML 文字列へ戻す段がありません。`dangerouslySetInnerHTML`
は props としても実装としても使いません。

見出しの階層も `content` が持つとおりに描画します。allowlist が `h1` を落とすため、本文の見出しは
`h2` から始まり、page の `h1` と競合しません。

本文中の link は native の `a` として描画します。内部 link であってもページ全体の遷移になり、
client-side navigation にはなりません。

本文が空の場合は空の枠を描画します。「本文がない」ことを伝える表示は持たず、`FeedbackState` などで
呼び出し元が示します。

## Storybook とテスト

Storybook は `Rich Text/RichTextContent` に置き、allowlist が通すブロックとインラインの全種類、
`typeset-docs` preset を重ねた状態、本文が空の状態を確認します。

テストは木の要素が対応する DOM 要素として描画されること、見出しの階層と link の `href` が保たれる
こと、`.typeset` が付くこと、`className` を重ねても `.typeset` が残ること、本文が空の場合、native
`div` 属性の伝播、a11y 自動検査を確認します。
