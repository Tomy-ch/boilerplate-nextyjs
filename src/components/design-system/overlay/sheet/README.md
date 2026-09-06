# Sheet

## 用途

補助的な navigation や絞り込み面を、画面端から現れる modal パネルとして開きます。狭い viewport で常時表示する余地がない内容を、必要なときだけ画面の外から引き出します。

## 役割と公開 component

| Component | 役割 |
| --- | --- |
| `Sheet` | 開閉状態と focus trap・Escape・背面の inert 化を管理する client-side root です。 |
| `SheetTrigger` | Sheet を開く trigger です。`Button` や link を使う場合は `asChild` で合成します。 |
| `SheetContent` | overlay と Portal を伴って、`side` で指定した画面端へ sheet 本体を固定して描画します。既定で右上に閉じる操作を置きます。 |
| `SheetClose` | sheet を閉じる操作です。footer のキャンセル・閉じるに使います。 |
| `SheetHeader` | title と説明をまとめる領域です。 |
| `SheetTitle` | sheet のアクセシブルな名前になる title です。既定で `h2` を render します。 |
| `SheetDescription` | sheet の目的や内容を説明する本文です。 |
| `SheetFooter` | 操作を並べる領域です。配置だけを担い、操作自体は持ちません。 |
| `SheetOverlay` | 背面を覆う overlay です。`SheetContent` が内部で描画します。 |
| `SheetPortal` | 描画先の Portal です。`SheetContent` が内部で使います。 |

`SHEET_SIDE` と `SheetSide` を `sheet.definition.ts` で公開します。`SheetContent` の `side` に指定できる値の owner はこの定義であり、`"right"` などの文字列を利用側で直接書きません。

## 利用ケース

- 狭い viewport で header のナビゲーションを畳み、trigger から一覧として引き出す場合
- 一覧の絞り込み条件を、主導線を隠さずに画面端の面へまとめる場合
- 内容の高さが可変で、画面上端・下端から引き出したい補助情報を置く場合

画面中央へ内容を集めて注視させたい場合は `Dialog`、退会・削除のような取り消せない操作の確認には `role="alertdialog"` の意味論を持つ `AlertDialog` を使います。

## 責務境界

SSR first の選定では `△` に当たります。既定は通常の link / button と Server 側で組み立てた内容であり、overlay の開閉・focus 管理・Escape・animation が必要になった場合にこの client island を選びます。開閉状態と focus trap のため hydration が必要で、Server Component からは直接 render できません。内容自体に client runtime が要らない場合は、Server Component で組み立てた要素を `children` として渡します。

表示する文言、取得、保存、業務判断、開閉を URL へ載せるかの選択は持ちません。`side` は現れる画面端だけを決め、viewport 幅に応じて sheet と常時表示を切り替える判断は feature 側が持ちます。

`SheetContent` は縦方向の flex で内容を並べ、`SheetFooter` の `mt-auto` によって余白があるときは footer が下端へ寄ります。内容が sheet の高さを超える場合のスクロールは持たないため、必要な場合は呼び出し元が `className` で overflow を指定します。

`SheetFooter` は配置だけを担い、閉じる操作を自前で描画しません。閉じる操作は `SheetClose` を `Button` へ合成して呼び出し元が置きます。

`SheetContent` はアクセシブルな名前として `SheetTitle` を必ず子に置きます。説明が要る場合は `SheetDescription` を添え、不要な場合は `aria-describedby={undefined}` を明示します。どちらも無いと Radix が警告します。`showCloseButton` を `false` にする場合は、内容側に `SheetClose` の閉じる手段を必ず用意します。

内容は Portal で `body` 直下へ描画されますが、React の木構造としては呼び出し元の配下に残ります。sheet の内部に置いた `form` は通常どおり submit され、`name` / `value` はそのまま送信値になります。

vendor は現在 Radix ですが、公開 API に vendor 名は含めません。アイコンは `components` の [`icon.ts`](../../../icon.ts) から取ります。`side` の位置決めと animation の class は shadcn の生成物をそのまま保持しており、animation plugin を採用していないため現状 animation の CSS は出力されません。

## Storybook とテスト

Storybook は既定の開閉、`right` / `left` / `top` / `bottom` の四つの固定位置、絞り込み面として form 部品を内容に置く場合、説明を持たない場合、右上の閉じる操作を置かない場合を確認します。画面端への固定と余白の見え方は実描画でしか判断できないため、位置と余白は Storybook 側の確認範囲です。

テストは開くまで内容を描画しないこと、title と説明の関連付け、title が見出しとして描画されること、`alertdialog` ではなく `dialog` の意味論であること、既定と `side` 指定での固定位置、右上と footer の双方から閉じられること、`showCloseButton` の切り替え、Escape での閉じ、Portal 内の `form` が送信値を保つこと、`SheetPortal` / `SheetOverlay` の明示指定、a11y 自動検査を確認します。Portal 先は render の `container` の外に出るため、a11y 自動検査には `baseElement` を渡します。
