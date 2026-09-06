# DropdownMenu

## 用途

trigger から操作の一覧を開き、対象に対して実行できることをまとめて示します。

## 役割と公開 component

| Component | 役割 |
| --- | --- |
| `DropdownMenu` | 開閉状態と roving focus・Escape・外側クリックを管理する client-side root です。 |
| `DropdownMenuTrigger` | menu を開く trigger です。`Button` を使う場合は `asChild` で合成します。 |
| `DropdownMenuContent` | Portal へ表示する menu 本体です。位置は `side` / `align` / `sideOffset` で調整します。 |
| `DropdownMenuPortal` | 描画先の Portal です。`DropdownMenuContent` が内部で使います。 |
| `DropdownMenuItem` | 選択すると menu を閉じて操作を実行する項目です。`variant` で破壊的操作を区別します。 |
| `DropdownMenuCheckboxItem` | 選択状態を切り替える項目です。menu を開いたまま複数を切り替えられます。 |
| `DropdownMenuRadioGroup` | 択一選択の項目をまとめ、選択値を扱います。 |
| `DropdownMenuRadioItem` | group 内で択一に選択される項目です。 |
| `DropdownMenuGroup` | 関連する項目をまとめます。 |
| `DropdownMenuLabel` | group の見出しです。選択できません。 |
| `DropdownMenuSeparator` | 項目群を視覚的・意味論的に区切ります。 |
| `DropdownMenuShortcut` | 項目の右端へキーボード操作を表示します。`KbdGroup` の上に組んでおり、個々のキーは `Kbd` を子に並べます。表示のみで登録はしません。 |
| `DropdownMenuSub` | 入れ子の menu をまとめる root です。 |
| `DropdownMenuSubTrigger` | 入れ子の menu を開く項目です。 |
| `DropdownMenuSubContent` | 入れ子の menu 本体です。 |

`DROPDOWN_MENU_ITEM_VARIANT` は `dropdown-menu.definition.ts` が owner です。`default` と `destructive` の二値で、`destructive` は削除など取り消せない操作にだけ使います。

## 利用ケース

一覧の行ごとの補助操作、アカウントメニュー、表示設定の切り替えなど、対象に対する操作をまとめたい場面に使います。

中身は操作に限ります。読み物や form を出したい場合は `Popover`、画面を覆う編集は `Dialog`、取り消せない操作の確認は `AlertDialog` を使います。

同じ操作を右クリックからも開きたい場合は [`ContextMenu`](../context-menu/README.md) を併置できます。context menu は画面上に trigger が現れず単独の導線にはできないため、可視の trigger を持つこの component が到達手段の本体であり続けます。

## 責務境界

開閉・roving focus・型入力による項目移動・Escape・外側クリックのため hydration が必要な client island です。表示する文言、取得、保存、業務判断、権限による項目の出し分けは持ちません。

icon だけの trigger にする場合は、`sr-only` のテキストなどでアクセシブルな名前を呼び出し元が与えます。一覧の行ごとに menu を置くときは、どの行に対する操作かが名前から分かるようにします。

menu は touch device と screen reader で到達コストが高いため、主導線の操作を menu の中だけに置きません。入れ子の階層も浅く保ち、深くなる場合は `Dialog` や専用画面への遷移を先に検討します。

`destructive` は色で区別するだけなので、色が手がかりにならない環境でも操作内容が分かる文言にします。実行前の確認が要る場合は、選択後に `AlertDialog` を開くのは feature の責務です。

`DropdownMenuShortcut` は右端への配置だけを担い、キーの意味論は `Kbd` / `KbdGroup` が持ちます。shortcut の登録はせず、キーボードから実行できない操作に対しては表示しません。

選択項目は既定で、選ぶたびに menu が閉じます。表示する列の切り替えのように続けて操作したい場合は、`DropdownMenuCheckboxItem` / `DropdownMenuRadioItem` の `onSelect` で `event.preventDefault()` を呼ぶと開いたままになり、枠外の操作や Escape で閉じます。どちらが適切かは用途で変わるため、component 側では既定を変えません。

項目の focus / hover は `bg-accent` / `text-accent-foreground` で示します。この semantic token は `tokens/themes/<系統>/<配色>.json` に定義があり、地から一段離れた淡い面を使います。キーボードで項目を移動したときに現在位置が分かる唯一の手がかりなので、`className` でこの指定を打ち消しません。

vendor は現在 Radix ですが、公開 API に vendor 名は含めません。アイコンは `components` の [`icon.ts`](../../../icon.ts) から取ります。

## Storybook とテスト

Storybook は既定の開閉、disabled を含む項目の並び、見出し・group・区切り・shortcut 表示・破壊的操作の組み合わせ、icon だけの trigger、実 state に接続した複数選択と択一選択、選択後も開いたままにする場合、入れ子の menu を確認します。テストは開くまで項目を描画しないこと、`menu` / `menuitem` / `menuitemcheckbox` / `menuitemradio` の意味論、選択による実行と閉じ、disabled、`variant` による区別、Escape での閉じ、入れ子の開閉、`DropdownMenuPortal` の明示指定、a11y 自動検査を確認します。

a11y 自動検査では `region`（すべてのページ内容が landmark に含まれること）を対象から外しています。Radix が menu を `document.body` 直下の Portal へ描画するため landmark の外に出ますが、これは Portal を使う UI に共通する制約であり、`region` は axe の `best-practice` タグでリポジトリの目標水準（WCAG 2.x AA）の対象外です。

jsdom には Radix が位置計算に使う `ResizeObserver` と `scrollIntoView` が無いため、テスト側で stub しています。実装からその依存を取り除く方向では対処しません。

枠外の操作で閉じることはテストに含めていません。jsdom が `PointerEvent` を実装しておらず Radix の検出機構を再現できないためで、Storybook の `WithSelectionKeptOpen` で実ブラウザ確認します。
