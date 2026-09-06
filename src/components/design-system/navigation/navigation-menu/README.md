# NavigationMenu

## 用途

サイト構造の中の主要な遷移先を並べ、必要に応じて下位階層を開きます。

## 役割と公開 component

| Component / 値 | 役割 |
| --- | --- |
| `NavigationMenu` | 開閉と focus 移動を管理する client-side root です。`viewport` で開いた内容の表示位置を選びます。 |
| `NavigationMenuList` | 遷移先を並べるリストです。 |
| `NavigationMenuItem` | 遷移先 1 件ぶんの項目です。 |
| `NavigationMenuTrigger` | 下位階層を開く trigger です。それ自体は遷移しません。 |
| `NavigationMenuContent` | 開いたときに表示する下位階層です。 |
| `NavigationMenuLink` | 遷移先の link です。`asChild` で `next/link` を合成します。 |
| `NavigationMenuViewport` | 開いた内容をまとめて表示する共通領域です。root が内部で描画します。 |
| `NavigationMenuIndicator` | 開いている項目を指す装飾の矢印です。省略できます。 |
| `navigationMenuTriggerStyle` | trigger と同じ見た目の class を返します。下位階層を持たない link へ使います。 |

## 利用ケース

PC の header で、カテゴリなど階層のあるサイト遷移を提供する場面に使います。

## いつ使わないか

**下位階層を開かない単純な navigation にはこの部品を使いません。** `nav` と `Link` を並べるだけで足り、client runtime も不要です。この部品を選ぶのは、trigger で下位項目を開く必要が確定した場合に限ります。

現在地までの階層は [`Breadcrumb`](../breadcrumb/README.md)、一覧の送りは [`Pagination`](../pagination/README.md) が担います。行に対する操作をまとめるのは [`DropdownMenu`](../../overlay/dropdown-menu/README.md) で、こちらは遷移ではなく操作が対象です。

## 責務境界

開閉・hover 遅延・focus 移動のため hydration が必要な client island です。Server Component から直接 render できません。

遷移先の決定、現在地の判定、権限による項目の出し分けは持ちません。現在地を示す場合は `NavigationMenuLink` に `active` を渡すと `aria-current="page"` が付きます。

`NavigationMenuContent` の中身は遷移先に限ります。form や読み物を入れたい場合は `Popover` や `Dialog` を使います。

mobile での表示形式は持ちません。狭い viewport で別の導線にするかは、利用する画面側で決めます。

vendor は現在 Radix ですが、公開 API に vendor 名は含めません。アイコンは `components` の [`icon.ts`](../../../icon.ts) から取ります。

## Storybook とテスト

Storybook は下位階層を持つ項目と直接遷移する項目を並べた基本構成、共通 viewport を使わない場合、現在地の項目に `active` を渡す場合を確認します。テストは navigation landmark とリスト構造、開くまで下位階層を描画しないこと、trigger での開閉と `aria-expanded`、`viewport` の有無、`active` による `aria-current`、`navigationMenuTriggerStyle` が trigger と同じ見た目を与えること、a11y 自動検査を確認します。

`NavigationMenuIndicator` は Radix が layout を計測してから描画するため、jsdom では DOM に現れません。テストでは「足しても navigation の意味論が変わらない」ことだけを確認し、見た目は Storybook で確認します。

jsdom には Radix が使う `ResizeObserver` が無いため、テスト側で stub しています。a11y 自動検査では `region` を対象から外しています。Portal を使う UI に共通する制約で、`region` は axe の `best-practice` タグとしてリポジトリの目標水準（WCAG 2.x AA）の対象外です。
