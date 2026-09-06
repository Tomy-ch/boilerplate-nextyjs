# Menubar

## 用途

画面全体に対する操作を分類ごとの menu にまとめ、常に見えている横一列として示します。

## 役割と公開 component

| Component | 役割 |
| --- | --- |
| `Menubar` | 横一列の menu 群をまとめる client-side root です。左右キーによる移動と、開いている menu の切り替えを管理します。 |
| `MenubarMenu` | trigger と内容の対を、menubar の中の一つの menu として束ねます。`value` で識別します。 |
| `MenubarTrigger` | 常に見えている menu の trigger です。`aria-haspopup` と `aria-expanded` を持ちます。 |
| `MenubarContent` | Portal へ表示する menu 本体です。既定では trigger の左端へ寄せて開きます。 |
| `MenubarPortal` | 描画先の Portal です。`MenubarContent` が内部で使います。 |
| `MenubarItem` | 選択すると menu を閉じて操作を実行する項目です。`variant` で破壊的操作を区別します。 |
| `MenubarCheckboxItem` | 選択状態を切り替える項目です。 |
| `MenubarRadioGroup` | 択一選択の項目をまとめ、選択値を扱います。 |
| `MenubarRadioItem` | group 内で択一に選択される項目です。 |
| `MenubarGroup` | 関連する項目をまとめます。 |
| `MenubarLabel` | 項目群の見出しです。選択できません。 |
| `MenubarSeparator` | 項目群を視覚的・意味論的に区切ります。 |
| `MenubarShortcut` | 項目の右端へキーボード操作を表示します。`KbdGroup` の上に組んでおり、個々のキーは `Kbd` を子に並べます。表示のみで登録はしません。 |
| `MenubarSub` | 入れ子の menu をまとめる root です。 |
| `MenubarSubTrigger` | 入れ子の menu を開く項目です。 |
| `MenubarSubContent` | 入れ子の menu 本体です。 |

`MENUBAR_ITEM_VARIANT` は `menubar.definition.ts` が owner です。`default` と `destructive` の二値で、`destructive` は削除など取り消せない操作にだけ使います。

## 利用ケース

編集画面や管理画面のように、対象一つではなく画面全体に対する操作が多く、それらを「ファイル / 編集 / 表示」のような分類で常時提示したい場面に使います。

近い見た目の component とは、**操作の対象が何か**と**遷移か操作か**で使い分けます。

| 状況 | 使うもの |
| --- | --- |
| 操作の対象が画面全体で、分類が複数あり常時見せたい | `Menubar` |
| 操作の対象が個々の行・項目で、trigger は一つ | [`DropdownMenu`](../../overlay/dropdown-menu/README.md) |
| 可視の導線がすでにあり、右クリックから加速したい | [`ContextMenu`](../../overlay/context-menu/README.md) |
| サイトの階層を辿る遷移 | [`NavigationMenu`](../navigation-menu/README.md) / [`Breadcrumb`](../breadcrumb/README.md) |

最後の行を守れないことが最も多い誤用です。menubar は操作の構造であり、遷移リンクを混ぜると「操作」と「遷移」の区別が利用者側から失われます。

一つの menu を開いている間、左右キーと hover で隣の menu へそのまま移れることがこの component の本体です。この横断的な移動が要らないなら、`DropdownMenu` を単独で置くほうが構造は単純になります。

## 責務境界

開閉・roving focus・型入力による項目移動・Escape・外側クリックのため hydration が必要な client island です。表示する文言、取得、保存、業務判断、権限による項目の出し分けは持ちません。

menu は touch device と screen reader で到達コストが高く、menubar は画面上部を常時占有します。主導線の操作を menu の中だけに置かず、入れ子の階層も一段までに保ちます。

同じ画面に menubar が複数ある場合に `aria-label` でそれぞれを区別するのは、呼び出し元の責務です。

`destructive` は色で区別するだけなので、色が手がかりにならない環境でも操作内容が分かる文言にします。実行前の確認が要る場合に、選択後へ `AlertDialog` を挟むのは feature の責務です。

`MenubarShortcut` は右端への配置だけを担い、キーの意味論は `Kbd` / `KbdGroup` が持ちます。shortcut の登録はせず、キーボードから実行できない操作に対しては表示しません。

選択項目は既定で、選ぶたびに menu が閉じます。表示する列の切り替えのように続けて操作したい場合は、`MenubarCheckboxItem` / `MenubarRadioItem` の `onSelect` で `event.preventDefault()` を呼ぶと開いたままになります。どちらが適切かは用途で変わるため、component 側では既定を変えません。

項目と trigger の focus / hover は `bg-accent` / `text-accent-foreground` で示します。キーボードで移動したときに現在位置が分かる唯一の手がかりなので、`className` でこの指定を打ち消しません。

vendor は現在 Radix ですが、公開 API に vendor 名は含めません。アイコンは `components` の [`icon.ts`](../../../icon.ts) から取ります。

## Storybook とテスト

Storybook は複数 menu を並べた基本構成と `disabled` な trigger、`defaultValue` で開いた状態、見出し・group・区切り・shortcut 表示・破壊的操作の組み合わせ、実 state に接続した複数選択と択一選択、入れ子の menu、`inset` による左端の余白揃えを確認します。テストは `menubar` とアクセシブルな名前、開くまで項目を描画しないこと、trigger の押下による開閉と `aria-expanded`、`menu` / `menuitem` / `menuitemcheckbox` / `menuitemradio` の意味論、shortcut が `kbd` の意味論で表示されること、選択による実行と閉じ、disabled、`variant` による区別、Escape での閉じ、開いた menu から左右キーで隣の menu へ移ること、入れ子の開閉、a11y 自動検査を確認します。

a11y 自動検査では `region`（すべてのページ内容が landmark に含まれること）を対象から外しています。Radix が menu を `document.body` 直下の Portal へ描画するため landmark の外に出ますが、これは Portal を使う UI に共通する制約であり、`region` は axe の `best-practice` タグでリポジトリの目標水準（WCAG 2.x AA）の対象外です。

jsdom には Radix が位置計算に使う `ResizeObserver` と `scrollIntoView` が無いため、テスト側で stub しています。実装からその依存を取り除く方向では対処しません。

枠外の操作で閉じることはテストに含めていません。jsdom が `PointerEvent` を実装しておらず Radix の検出機構を再現できないためで、Storybook で実ブラウザ確認します。
