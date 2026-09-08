# FormField

## 用途

項目名・必須の印・入力欄・補足・誤りを、どの入力欄の種類でも同じ並びで組みます。

## 役割と公開 component

| Component | 役割 |
| --- | --- |
| `FormField` | 外枠。label と必須の印を組み、children として渡された入力欄の下へ補足と誤りを置きます。 |

`fieldControlAttributes()`（`field-attributes.ts`）は、入力欄そのものへ与える a11y 属性を組む純関数です。外枠が呼び、結果を children へ渡します。呼び出し元が直接使うことはありません。

## 利用ケース

複数の項目を並べるフォームに使います。text・select・入力欄と操作を並べた合成のいずれでも、
同じ外枠へ差し込みます。

入力欄が 1 つだけで補足も誤りも持たない場面には使いません。`Label` と control を直接並べる方が
読めます。

## 責務境界

**入力欄を持ちません。** children として受け取ります。種類ごとに外枠を作ると、誤りの位置も必須の
印の位置も種類ごとにずれていきます。

**`id` を生成しません。** 同じフォームを 1 つの文書へ 2 度置いたときに重複するため、生成は
`useId()` を持てる呼び出し元が行います。ここは受け取った `id` を label と誤りへ配るだけです。

**入力欄の ARIA 属性は、children へ渡します。** 入力欄そのものは受け取らないので直接は触れません
が、`aria-invalid` / `aria-describedby` / `aria-required` / `id` を組んで children の引数に渡すので、
**呼び出し元はそれを入力欄へ広げるだけ**です。外枠が自分で持つのは `data-invalid` による見た目の
切り替えまでです。

**呼び出し元に組ませません。** 組ませると、外枠だけを使って属性を通さない画面が書けてしまいます。
誤りが無いときも `aria-invalid` を落とさず `false` で置くのは、属性ごと
消すと支援技術にとって「一度も検証していない」と区別が付かないためです。何を与えるかは
`fieldControlAttributes()` が 1 か所で決めます。

**誤りと補足の `id` も生成しません**——`controlId` から導きます。接尾の綴りは
[`design-system/form/field`](../../design-system/form/field/field.definition.ts) が持ちます
（`toErrorId` / `toDescriptionId`）。`id` を受け取るのは `FieldDescription` / `FieldError` なので、
規約もその隣に置いてあります。ここへ置くと、素の `Field` を直接組むカタログや画面が届かず、
同じ綴りを手で書くことになります。

**補足は外枠へ渡すだけで足ります。** 描画も、入力欄から指すことも外枠が引き受けます。補足と誤りが
揃うときは、描画される順（補足 → 誤り）で `aria-describedby` に並びます。

```tsx
<FormField controlId={id} description={description} label="メールアドレス" message={message} required>
  {(control) => <Input {...control} {...register("email")} />}
</FormField>
```

検証も、必須かどうかの判定も持ちません。どちらも呼び出し元が検証スキーマから導いて渡します
（[0062](../../../../docs/adr/0062-form-input-validation.md)）。

いつ誤りを出すか（focus が外れた時点か、変更のたびか）も持ちません。表示するかどうかを決めた
結果だけを `message` で受け取ります。

## Storybook とテスト

Storybook は必須・任意・誤りあり・補足ありと、select を差し込んだ場合を示します。テストは label と
入力欄の関連付け、誤りが無いときに誤りの要素を描画しないこと、**組んだ属性が children へ渡ること**、
a11y 自動検査を確認します。`fieldControlAttributes()` は、誤りの有無で `aria-invalid` と
`aria-describedby` が切り替わること、補足と誤りが揃うと両方の id が描画順で並ぶこと、必須が属性へ
出ることを別に確認します。
