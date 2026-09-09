# Row Actions Sugar

## 用途

一覧の行ごとに繰り返す操作 menu を、行操作の定義から組み立てます。

## 役割と公開 component

| Component / 型 | 役割 |
| --- | --- |
| `rowActionsColumn` | 行操作の設定から `StaticDataTable` の操作列を組み立てます。 |
| `RowActionsMenu` | 行操作の定義を DropdownMenu へ展開します。table を伴わずに単独でも使えます。 |
| `RowAction` | 行操作の定義です。`link` / `command` / `separator` の判別可能な union です。 |
| `ROW_ACTION_KIND` | 行操作の種類の定数です。`row-actions.definition.ts` が owner です。 |

## 利用ケース

admin の一覧で、行ごとに編集画面への遷移や削除操作をまとめる場面に使います。同じ操作構成を全行へ繰り返すので、定義 1 本から列（幅・見出し・alignment）と全行ぶんの menu が展開されます。

## 責務境界

取得・保存・遷移先の決定・確認 UI は持ちません。`command` の実行内容と、削除など不可逆操作の確認（`AlertDialog`）は呼び出し元が扱います。行の束縛も呼び出し元の責務で、`actions` は受け取った行に対して確定済みの `href` と `onSelect` を返します。

業務型は `Row` の generics として呼び出し元に残るため、この sugar は特定の型・API・語彙を持ちません。

**操作が 1 つも無い行には trigger ごと出しません。** `actions` が空を返した行は menu を持たず、押せる物が並んでいるのに開くと空、という面になりません。行によって操作の有無が変わる一覧（すでに済んでいる行・状態で操作が閉じる行）では、空を返すのが自然な表し方になります。

`triggerLabel` は trigger の唯一のアクセシブルな名前になります。trigger は icon だけなので、行を特定できる文言（対象の名称を含むなど）を返さないと、支援技術からは同じ名前の操作が行数ぶん並ぶことになります。

操作列の見出しは既定で視覚的に隠します。見える見出しは不要ですが、column header が空だと table の意味論が崩れるため、読み上げ用の文言は保持します。

同じ操作へ右クリックからも到達させたい場合は、[`ContextMenu`](../../../design-system/overlay/context-menu/README.md) を行へ重ねて使えます。context menu は画面上に trigger が現れないため単独の導線にはできず、この sugar が出す可視の trigger が到達手段の本体であり続けます。

## Server / Client の境界

`link` だけで構成すれば Server Component から使えます。`command` は関数を保持するため、`actions` を渡す呼び出し元が Client Component である必要があります。Server Component から関数を含む定義を渡すことはできません。

編集・補充画面への導線が中心の一覧は `link` だけで完結します。行から破壊的操作を実行する一覧は、確認 UI を含めて呼び出し元が client 境界を持ちます。

## Storybook とテスト

Storybook は遷移だけで構成した操作列、その場で実行する操作を含む場合、table を伴わない単独利用を確認します。テストは行ごとに対象が分かる trigger 名になること、操作列の見出しが読み上げ用に保持されること、`link` が行ごとの遷移先へ展開されること、行の状態による無効化、`command` が対象の行を伴って呼び出し元の処理を実行すること、破壊的操作の区別、`separator` の展開、a11y 自動検査を確認します。

a11y 自動検査では `region` を対象から外しています。Radix が menu を `document.body` 直下の Portal へ描画するため landmark の外に出ますが、Portal を使う UI に共通する制約であり、`region` は axe の `best-practice` タグでリポジトリの目標水準（WCAG 2.x AA）の対象外です。

jsdom には Radix が位置計算に使う `ResizeObserver` と `scrollIntoView` が無いため、テスト側で stub しています。trigger は `click` ではなく `pointerdown` で開くため、テストもその経路で操作します。
