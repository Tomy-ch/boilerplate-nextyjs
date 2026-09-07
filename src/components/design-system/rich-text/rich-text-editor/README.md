# RichTextEditor

## 用途

書式付きの本文を書くための編集面です。見出し・箇条書き・引用・リンクといった構造を、保存したあとに読者へ見えるとおりの形で書けるようにします。

## 役割と公開 component

| Component / 値 | 役割 |
| --- | --- |
| `RichTextEditor` | toolbar と編集面をまとめた client island です。内容が変わるたびに、現在の内容を HTML 文字列として呼び出し元へ渡します。 |
| `RICH_TEXT_EDITOR_EXTENSIONS` | editor が読み書きする node と mark の全体です。ここに登録されたものだけが書けます。 |
| `RICH_TEXT_EDITOR_HEADING_LEVELS` | 見出しとして書ける階層（2 / 3 / 4）です。 |
| `RICH_TEXT_EDITOR_MARK_ACTIONS` | 太字・斜体・打ち消し線・コードなど、文字そのものの見え方を変える toolbar の操作です。同じことを起こすキーを併せて持ちます。 |
| `RICH_TEXT_EDITOR_BLOCK_ACTIONS` | 見出し・箇条書き・引用など、段落の種類を変える toolbar の操作です。 |
| `RICH_TEXT_EDITOR_COMMAND_ACTIONS` | 区切り線の挿入・取り消し・やり直しなど、適用状態を持たない toolbar の操作です。 |
| `isRichTextHrefAllowed` | `a` の `href` として書ける値かどうかを判定します。 |

toolbar の右端に**プレビュー**の切り替えを持ちます。押している間は書式の操作を出さず、書いた内容を読者に届くのと同じ形で見せます。

主な props は次のとおりです。

| props | 役割 |
| --- | --- |
| `label`（必須） | 編集面のアクセシブルな名前です。編集面は `textbox` として公開されますが視覚的なラベルを持たないため、これだけが「何を書く欄か」を伝えます。 |
| `onChange`（必須） | 内容が変わるたびに、現在の内容を HTML 文字列として受け取ります。 |
| `defaultValue` | 初期表示する HTML 文字列です。保存済みの内容を編集する場合に渡します。 |
| `disabled` | `true` の間は読み取り専用になり、toolbar の操作も効きません。 |
| `className` | 外枠へ追加する class です。 |

## 利用ケース

- 説明文や告知文のように、書き手が見出しと箇条書きで構造を付けたい本文を編集する場合
- 保存済みの本文を読み込み、書式を保ったまま編集し直す場合

単一行の文字列には [`Input`](../../form/input/README.md)、書式を持たない複数行には [`Textarea`](../../form/textarea/README.md) を使います。この部品を選ぶのは、保存する内容そのものが構造を持つ場合だけです。

### 書いた内容が表示に届くまで

リッチテキストは、**編集と保存では HTML 文字列**、**表示では `SanitizedRichText`** という 2 つの姿を取ります。この部品は前者だけを扱い、後者への変換には関与しません。

| 段階 | 受け渡す値 | 担当 |
| --- | --- | --- |
| 編集 | HTML 文字列 | `RichTextEditor`（client island） |
| 保存・受け渡し | HTML 文字列 | 呼び出し元の form / Server Action / backend |
| 検査 | HTML 文字列 → `SanitizedRichText` | [`model/rich-text/`](../../../../model/rich-text/README.md) の `SanitizedRichText.from` |
| 表示 | `SanitizedRichText` | [`RichTextContent`](../rich-text-content/README.md)（Server Component） |

プレビューも表示側と同じ経路を通ります。`SanitizedRichText.from` を通して [`RichTextContent`](../rich-text-content/README.md) で描くため、**プレビューで見えないものは保存しても表示されません**。編集面の見た目をそのまま拡大するのではなく、allowlist を通した後の姿を見せるのが目的です。

編集面は隠すだけで DOM から外しません。外すと editor の内部状態が壊れ、戻ったときに書きかけが失われます。

**sanitize は表示の直前に行います。** 保存のときに一度通しただけの値を、以後ずっと検査済みとして扱わないでください。保存先の内容が別の経路で書き換わることも、allowlist を狭めたあとに古い内容が残ることもあるためです。`SanitizedRichText` の構築経路が `from` だけに絞られているのは、この順序を型で強制するためです。

### form へ載せる

この部品は `<form>` に載りません。呼び出し元が hidden input へ載せて送ります。

```tsx
"use client";

import { useCallback, useState } from "react";

import { RichTextEditor } from "@/components/design-system/rich-text/rich-text-editor/rich-text-editor";

export function DescriptionField({ defaultHtml = "" }: { defaultHtml?: string }) {
  const [html, setHtml] = useState(defaultHtml);
  const handleChange = useCallback((value: string) => setHtml(value), []);

  return (
    <>
      <RichTextEditor defaultValue={defaultHtml} label="説明" onChange={handleChange} />
      <input name="description" type="hidden" value={html} />
    </>
  );
}
```

送信の結果表示は [`FormFeedback`](../../../app-starter/form-feedback/README.md)、項目名や説明文を伴う form の一項目として組む場合は [`Field`](../../form/field/README.md) と合成します。この部品自身は `label` 以外の form 要素を持ちません。

### 保存済みの内容を編集し直す

編集へ戻すのは、保存した **HTML 文字列** です。`SanitizedRichText` を戻り値として持ち回る必要はありません。

```tsx
const product = await fetchProduct(id);

<DescriptionField defaultHtml={product.description} />;
```

`defaultValue` は mount のときだけ読まれます。あとから別の内容へ差し替える場合は、呼び出し元が `key` を変えて作り直します。allowlist の外にあるタグは読み込みの時点で落ちるため、古い内容に表や画像が含まれていた場合は編集画面で消えます。

### 表示する

表示側は Server Component です。編集画面とは別のページに置けます。

```tsx
import { RichTextContent } from "@/components/design-system/rich-text/rich-text-content/rich-text-content";
import { SanitizedRichText } from "@/model/rich-text/sanitized-rich-text";

export function Description({ html }: { html: string }) {
  return <RichTextContent className="typeset-docs" content={SanitizedRichText.from(html)} />;
}
```

### 通らない受け渡し

- **`SanitizedRichText` を `defaultValue` へ渡す** — この部品が受けるのは HTML 文字列です。編集へ戻すのは保存した文字列そのものです
- **`SanitizedRichText` を Server Component から Client Component の props へ渡す** — class instance であり serializable ではありません。編集画面へ運ぶ値は文字列に保ちます
- **editor の出力を検査せずに表示する** — `SanitizedRichText` は `from` 以外に構築経路がないため、そもそも組み立てられません

### 組み合わせる部品

| 部品 | 関係 |
| --- | --- |
| [`RichTextContent`](../rich-text-content/README.md) | 書いた内容の表示側。この部品の相方であり、同じ allowlist の範囲を描画する |
| [`model/rich-text/`](../../../../model/rich-text/README.md) | allowlist と sanitize の所有者。この部品が書ける範囲はここから導出する |
| [`typeset`](../../foundation/typeset/README.md) | 組版の CSS 基盤。編集面と表示側の両方がこれを使うため、書いている最中と表示後で組版が揃う |
| [`Input`](../../form/input/README.md) / [`Textarea`](../../form/textarea/README.md) | 書式を持たない入力。構造が要らない項目はこちらを選ぶ |

## 責務境界

ProseMirror の編集面を browser 側で組み立てるため hydration が必要な client island です。Server Component からは直接 render できません。

保存・送信・検証は持ちません。内容が変わるたびに `onChange` へ HTML 文字列を渡すだけで、`<form>` にも載りません。呼び出し元が受け取った文字列を hidden input へ載せるか、Server Action の引数として渡します。

### 書けるものは sanitizer の allowlist から導出する

editor が読み書きする node と mark は `RICH_TEXT_EDITOR_EXTENSIONS` が決めており、その集合は [`src/model/rich-text/`](../../../../model/rich-text/README.md) の allowlist（`RICH_TEXT_TAG_NAMES`）に収まる範囲だけで組んであります。**editor が出せるタグ ⊆ sanitizer が通すタグ**という関係を保つためです。この関係が崩れると、書けたのに表示されない内容が生まれます。

そのため、書けるのは見出し（2〜4）・箇条書き・番号付き箇条書き・引用・区切り線・太字・斜体・打ち消し線・行内コード・改行・リンクだけです。表・画像・コードブロック・下線は書けません。allowlist に無い書式を要求されたときは、allowlist・extension・test の 3 点を揃えて足します。extension だけを足すと、この関係が無言で崩れます。

この理由から、まとめて多くの extension を持ち込む `@tiptap/starter-kit` は採っていません。要件外の extension が入ると、上の関係を保てなくなるためです。

### 受け取った HTML を検証済みとして扱わない

`onChange` が渡す HTML が allowlist に収まるのは、editor の設定が満たしている性質です。**呼び出し元へ届いた文字列がその性質を満たすことの保証ではありません。** 経路の途中で差し替えられる可能性があるため、表示するときは必ず `SanitizedRichText.from` を通します。この部品は入口を狭めるだけで、sanitize の責務は `model` が持ちます。

### リンク

toolbar の「リンク」から入力するほか、URL を入力または貼り付けると自動でリンクになります。受け付けるのは `http` / `https` / `mailto` から始まる URL と、protocol を持たないアプリ内のパスだけです。判定は `isRichTextHrefAllowed` が sanitizer と同じ規則で行うため、editor が通した `href` は sanitize でも落ちません。

選択範囲があるときはその範囲をリンクにし、カーソルだけのときはリンク先そのものを本文へ挿入します。後者を挿入にしているのは、選択が無い状態で適用すると見た目に何も起きないためです。

リンク先を持たない `a` を作らないよう、空の入力は適用せず理由を表示します。

編集中はリンクを click しても開きません。編集面の中で意図せず遷移することを避けるためです。

### toolbar の中の移動

toolbar の中は矢印キーで隣の操作へ移り、Home / End で両端へ移ります。Tab の並びに残るのは最後に focus を持ったボタン 1 つだけで、toolbar 全体を Tab 1 回で通り抜けられます。押せない操作は飛ばします。

**`role="toolbar"` は矢印キーでの移動を約束するため、移動を実装したうえで名乗っています。** 移動を持たない操作の群は toolbar を名乗りません（`SelectionToolbar` は `fieldset` の group で名前を与えています）。

### キー操作の案内

toolbar のボタンには、**同じことを起こすキー**を hover / focus で添えます。キーの表示は `KeyboardShortcutKeys` が持ち、`⌘` と `Ctrl` の出し分けもその部品が引き受けます。

説明とキーを `dt` / `dd` の組にする `KeyboardShortcut` は使いません。あれは `dl` の子であることを前提にしており、tooltip の中には `dl` が無いため、孤立した `dt` / `dd` になります。ここでは説明が隣に並ぶだけで足ります。

**`TooltipProvider` はこの部品が自分で持ちます。** 置くだけで動く状態を保つためで、外へ出すと、呼び出し側が Provider を mount し忘れた瞬間に描画時の例外になります。内部の tooltip どうしは 1 つの Provider を共有するので、ボタン間を移るときに遅延を挟みません。

**キーの実体は editor の extension が持っており、この部品は登録しません。** editor が focus を持っているあいだだけ効く、閉じたキー操作です。任意の操作を任意のキーへ結び付ける汎用の登録機構は持ちません（[0053](../../../../../docs/adr/0053-ui-component-interaction-seam.md) §5）。

**案内と実体が食い違わないことをテストで固定しています。** 宣言したキーが extension の登録に無ければ落ちるため、extension の版が変わってキーが動いた場合はテストが先に気づきます。

**toolbar のボタンはすべて同じ案内を通します。** キーを持つものだけがキーを併せて出し、持たないもの（区切り線・リンク・プレビュー）は名前だけを出します。片方を browser 標準の `title` のままにすると、同じ toolbar の中で出る速さも見た目も違うものが並びます。効かないキーを案内することはありません。

`aria-keyshortcuts` は付けていません。値が `Control+B` と `Meta+B` のどちらになるかは動かしている環境で決まり、その判定は `KeyboardShortcut` が既に持っています。ここで二つ目の判定を持つと、表示と読み上げが食い違いうる状態を自分で作ることになります。

### 見た目

編集面には [`typeset`](../../foundation/typeset/README.md) の `.typeset` を付けています。書いている最中の組版と、`RichTextContent` が描画したあとの組版を同じ規則に揃えるためです。

toolbar のボタンは `Toggle` と `Button` を合成して得ており、この部品は独自の見た目を持ちません。

実装は TipTap（ProseMirror）を使いますが、vendor は公開 API に出しません。呼び出し元が受け渡すのは HTML 文字列だけです。

## Storybook とテスト

Storybook は、何も書かれていない状態、保存済みの内容を読み込んだ状態、読み取り専用の状態、allowlist の外にあるタグを初期値へ渡した場合を確認します。呼び出し元へ渡る HTML を各 story に並べ、操作と出力の対応を実際に確かめられるようにしています。

テストは、toolbar と名前を持つ編集面を描画すること、toolbar の中を矢印キーと Home / End で移れて押せない操作を飛ばすこと、Tab の並びに残るボタンが 1 つだけであること、初期値の読み込みと allowlist 外のタグが落ちること、読み取り専用のときに編集できないこと、すべての書式ボタンが押下状態を切り替えること、段落の種類を変えると変更後の HTML を通知すること、取り消しとやり直しが実行できる間だけ押せること、リンクの入力・選択範囲の有無による適用・Enter での適用・allowlist 外の protocol と空入力を拒む理由の表示・解除、**案内するキーが extension の登録と一致すること**、a11y 自動検査を確認します。

**allowlist との関係は test で固定しています。** editor が読み書きする node と mark の一覧が導出した集合と一致すること、editor が出せるタグが `RICH_TEXT_TAG_NAMES` に収まること、editor の出力が sanitize を通しても要素と属性が変わらないこと、allowlist 外の protocol を editor 自身が出力しないことを確認します。extension を足すとこの 4 つが落ちます。
