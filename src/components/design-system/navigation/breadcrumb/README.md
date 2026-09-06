# Breadcrumb

## 用途

現在地までの階層を示し、上位階層へ戻れるようにします。

## 役割と公開 component

| Component | 役割 |
| --- | --- |
| `Breadcrumb` | 名前を持つ `nav` landmark です。他の navigation と区別できるようにします。 |
| `BreadcrumbList` | 階層を並べる `ol` です。順序に意味があることを示します。 |
| `BreadcrumbItem` | 階層 1 段ぶんの `li` です。 |
| `BreadcrumbLink` | 上位階層へ戻る link です。`asChild` で `next/link` を合成できます。 |
| `BreadcrumbPage` | 現在地を示す末尾の項目です。link にはしません。 |
| `BreadcrumbSeparator` | 項目の間に置く装飾の区切りです。`children` で記号を差し替えられます。 |
| `BreadcrumbEllipsis` | 折り畳んだ中間階層を示す省略記号です。 |

## 利用ケース

カテゴリ階層をたどる一覧・詳細や、admin の設定画面など、サイト構造の中での現在地を示したい場面に使います。

階層が 1 段しかない画面には置きません。到達経路が 1 つに定まらない画面（複数の入口から開く詳細など）では、実際にたどった経路ではなくサイト構造上の階層を示します。

## 責務境界

client runtime を必要としない SSR first の表示部品です。現在の route の判定、階層の組み立て、省略するかどうかの判断は呼び出し元が行います。

`BreadcrumbEllipsis` は記号を表示するだけで、それ自体は開閉しません。省略した階層へ到達させる場合は `DropdownMenu` などの操作を呼び出し元が合成します。

リポジトリ内の遷移には `asChild` で `next/link` の `Link` を渡します。既定の `a` は外部リンクや、遷移先が props 経由で決まる場合に使います。

vendor は現在 Radix（`Slot`）ですが、公開 API に vendor 名は含めません。アイコンは `components` の [`icon.ts`](../../../icon.ts) から取ります。

## アクセシビリティ

`nav` に「パンくずリスト」という名前を与えます。同じページに複数の navigation があるとき、landmark の一覧で区別できるようにするためです。

現在地は自分自身への遷移を提供しないため link にせず、`aria-current="page"` だけで現在のページであることを伝えます。shadcn の生成物は `role="link"` と `aria-disabled` を付けますが、focus できない要素に interactive role を与えることになり a11y lint（`useFocusableInteractive` / `useSemanticElements`）に反するため採っていません。ARIA APG のパンくずパターンでも、現在地は `aria-current` で示すのが正です。

区切りは装飾なので読み上げ対象から外します。階層の関係は `ol` の構造が伝えるため、区切り自体には意味を持たせません。省略記号も同様に装飾ですが、読み上げ用の文言は保持します。

## Storybook とテスト

Storybook は基本構成、`next/link` の合成、中間階層の省略、区切り記号の差し替え、狭い viewport での折り返しを確認します。テストは名前つき navigation landmark であること、`ol` と項目数、上位階層の遷移先、現在地が遷移先を持たず `aria-current` を伝えること、区切りと省略記号が装飾であること、`asChild` による合成、a11y 自動検査を確認します。
