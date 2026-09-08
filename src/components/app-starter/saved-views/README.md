# SavedViews

## 用途

一覧で何度も組み直す絞り込みや並べ替えを名前付きで残し、次からは選ぶだけで同じ見え方へ戻れる
ようにします。

## 役割と公開 component

| Component | 役割 |
| --- | --- |
| `SavedViews` | 保存した条件を選び直し、名前を付けて保存し、名前を変え、消す操作を 1 つの trigger にまとめます。 |

| props | 型 | 役割 |
| --- | --- | --- |
| `views` | `readonly SavedView[]` | 選べる条件。`id` と `name` だけを持ちます。 |
| `currentViewId` | `string \| null` | いま当てている条件。`null` は「どれも当てていない」を表します。 |
| `onSelect` | `(viewId: string) => void` | 条件を選んだ。 |
| `onCreate` | `(name: string) => void` | いまの条件へ名前を付けて保存する。 |
| `onRename` | `(viewId: string, name: string) => void` | 選択中の条件の名前を変えた。 |
| `onDelete` | `(viewId: string) => void` | 選択中の条件を消した。確認は済んでいます。 |
| `label` | `string` | 操作のアクセシブルな名前。条件を当てていないときは trigger の表示にもなります。既定は「保存した条件」。 |

`SavedView` は `{ id, name }` の 2 つだけです。条件の中身はこの型に入りません。

## 使い方

### 一覧の toolbar へ置く

条件そのものと保存先は呼び出し元が持ちます。この component へ渡すのは名前と `id` だけです。

```tsx
"use client";

import { useCallback, useState } from "react";

import { SavedViews, type SavedView } from "@/components/app-starter/saved-views/saved-views";

export function ListToolbar({ initialViews }: { initialViews: readonly SavedView[] }) {
  const [views, setViews] = useState(initialViews);
  const [currentViewId, setCurrentViewId] = useState<string | null>(null);

  // いまの絞り込み条件を呼び出し元が束ね、発行された id を選択中にする
  const create = useCallback((name: string) => setViews(saveCurrentConditions(name)), []);
  const rename = useCallback((viewId: string, name: string) => setViews(renameView(viewId, name)), []);
  const remove = useCallback((viewId: string) => setViews(removeView(viewId)), []);

  return (
    <SavedViews
      currentViewId={currentViewId}
      onCreate={create}
      onDelete={remove}
      onRename={rename}
      onSelect={setCurrentViewId}
      views={views}
    />
  );
}
```

### 条件を URL や保存先とつなぐ

`onSelect` は `id` を返すだけで、URL の書き換えも fetch も行いません。条件を URL の query に
載せるか、backend へ保存するか、browser に残すかは feature が決めます。`onCreate` に渡るのも
名前だけなので、「いまの条件」が何を指すかは呼び出し元の state が答えます。

```tsx
const selectView = useCallback(
  (viewId: string) => {
    setCurrentViewId(viewId);
    router.replace(`?${new URLSearchParams(conditionsOf(viewId))}`);
  },
  [router],
);
```

### 絞り込み UI との併置

絞り込みの操作そのものは [`filter-bar`](../../patterns/filter-bar/README.md) が、表の見せ方は
[`table-view-options`](../../patterns/table-view-options/README.md) が持ちます。この component はその結果を
名前付きで呼び戻す層で、条件の編集 UI を持ちません。

## 利用ケース

- 一覧で使う絞り込みの組み合わせが複数あり、切り替えて使う場合
- 保存した条件に後から分かりやすい名前を付け直したい場合

条件が 1 つしかない画面には置きません。選ぶ対象が無く、保存だけの操作になります。

## 責務境界

SSR first の選定では `×` に当たります。menu と dialog の開閉を browser 側で行うため hydration が
必要で、Server Component からは直接 render できません。

条件の中身を持ちません。絞り込み・並べ替えの値、保存先、URL との同期、`id` の発行はすべて
呼び出し元が所有します。この component が扱うのは `id` と名前だけです。

名前の変更と削除は**選択中の 1 件**が対象です。`currentViewId` が `null` の間は両方とも選べません。
一覧の各行に個別の操作を置かないのは、menu 項目の中へ操作 button を入れ子にすると menu の
keyboard 操作と読み上げが壊れるためです。

削除は取り消せないため `AlertDialog`（`role="alertdialog"`）の確認を挟みます。名前の入力は通常の
`Dialog` です。どちらも menu の外に置いた制御された dialog で、menu が閉じても trigger と一緒に
消えません。

名前は前後の空白を落として渡します。空白だけの名前では保存 button が押せません。名前の重複は
許します。同じ名前を許すかどうかは保存先の制約であり、この component は判断しません。

vendor は Radix（`DropdownMenu` / `Dialog` / `AlertDialog`）です。

## Storybook とテスト

Storybook は `Container/SavedViews` に置き、条件を選んでいる状態、どれも当てていない状態、
保存した条件がまだ無い状態、操作の名前を差し替えた状態を確認します。Default の story は選択・
保存・改名・削除がひと通り動くため、呼び出し元が持つ state の形もそのまま読めます。

テストは trigger の表示、条件が `menuitemradio` として並び選択中に印が付くこと、選択・保存・改名・
削除がそれぞれ何を返すか、条件が無いときと当てていないときに操作を選ばせないこと、名前の前後の
空白を落とすこと、空白だけの名前を弾くこと、改名時に現在の名前が初期値になること、dialog と
alertdialog のアクセシブルな名前と説明、確認をやめたときに何も起きないこと、a11y 自動検査を
確認します。
