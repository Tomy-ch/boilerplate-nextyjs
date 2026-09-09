# Drawer

## 用途

画面端から引き出し、drag でも閉じられる modal panel を開きます。touch での操作を前提にした補助情報や絞り込み面に使います。

## 役割と公開 component

| Component | 役割 |
| --- | --- |
| `Drawer` | 開閉状態と drag、focus trap、Escape を管理する client-side root です。`direction` で引き出す方向を選びます。 |
| `DrawerTrigger` | Drawer を開く trigger です。`Button` や link を使う場合は `asChild` で合成します。 |
| `DrawerContent` | overlay と Portal を伴って drawer 本体を描画します。`bottom` のときだけ上端に掴み手が出ます。 |
| `DrawerClose` | drawer を閉じる操作です。footer のキャンセル・閉じるに使います。 |
| `DrawerHeader` | title と説明をまとめる領域です。`top` / `bottom` では小さい viewport で中央寄せになります。 |
| `DrawerTitle` | drawer のアクセシブルな名前になる title です。 |
| `DrawerDescription` | drawer の目的や内容を説明する本文です。 |
| `DrawerFooter` | 操作を並べる領域です。配置だけを担い、操作自体は持ちません。 |
| `DrawerOverlay` | 背面を覆う overlay です。`DrawerContent` が内部で描画します。 |
| `DrawerPortal` | 描画先の Portal です。`DrawerContent` が内部で使います。 |

`DRAWER_DIRECTION` と `DrawerDirection` を `drawer.definition.ts` で公開します。`direction` に指定できる値の owner はこの定義であり、`"bottom"` などの文字列を利用側で直接書きません。

## 利用ケース

- 小さい viewport で、絞り込み条件や補助情報を下端から引き出す場合
- 掴んで閉じる操作が自然に期待される、touch 主体の導線

## 責務境界

drag の追従と慣性、閉じる判定のため hydration が必要な client island です。Server Component からは直接 render できません。内容自体に client runtime が要らない場合は、Server Component で組み立てた要素を `children` として渡します。

開いているあいだは履歴を 1 つ持ち、**戻る操作で自分だけを閉じます**（[0053](../../../../../docs/adr/0053-ui-component-interaction-seam.md)）。積むのは同じ URL の履歴 entry だけで、URL 自体は変わりません。

表示する文言、取得、保存、業務判断、開閉を URL へ載せるかの選択は持ちません。`direction` は引き出す方向だけを決め、viewport 幅に応じて drawer と常時表示を切り替える判断は feature 側が持ちます。

内容が高さを超える場合のスクロールは持ちません。必要な場合は呼び出し元が `className` で overflow を指定します。drag と内容のスクロールは競合しうるため、スクロールする領域を作るときは実機で操作を確認します。

`DrawerContent` はアクセシブルな名前として `DrawerTitle` を必ず子に置きます。説明が要る場合は `DrawerDescription` を添え、不要な場合は `aria-describedby={undefined}` を明示します。`bottom` のときに出る掴み手は装飾であり、`aria-hidden` で支援技術から隠しています。

### `Sheet` との使い分け

どちらも画面端に固定される modal で、focus trap と Escape は同じように働きます。選ぶ基準は操作方法です。

| | `Drawer` | `Sheet` |
| --- | --- | --- |
| drag で閉じる | できる | できない |
| 掴み手の表示 | `bottom` のとき | なし |
| 想定操作 | touch 主体 | pointer / keyboard |
| 実装 | vaul | Radix Dialog |

drag が要らないなら `Sheet` を使います。同じ画面で両方を使い分けると操作方法が揃わないため、どちらを既定にするかは feature 側で決めます。

### `dismissible={false}` は閉じる経路をすべて塞ぐ

`dismissible` を `false` にすると、drag と背面の操作だけでなく **Escape と `DrawerClose` でも閉じなくなります**。実装が `onOpenChange` の入口で閉じる方向の変化を無視するため、内部に閉じる経路が残りません。

この指定をする場合は `open` / `onOpenChange` で呼び出し元が開閉を制御し、閉じる条件を自分で決めます。閉じる手段を用意しないまま指定すると、利用者が操作不能になります。

vendor は現在 vaul（内部で Radix Dialog）ですが、公開 API に vendor 名は含めません。

## Storybook とテスト

Storybook は既定の開閉、`bottom` / `top` / `left` / `right` の四方向、絞り込み面として form 部品を内容に置く場合、`dismissible={false}` を `open` の制御と組み合わせる場合、説明を持たない場合を確認します。drag の追従は実機での確認が要るため、Storybook では配置・掴み手・開閉の構成までを確認範囲とします。

テストは開くまで内容を描画しないこと、title と説明の関連付け、`alertdialog` ではなく `dialog` の意味論であること、既定と `direction` 指定での引き出し方向、掴み手が支援技術から隠れること、開いている間は trigger を含む背面が隠れること、trigger の `aria-controls` が実在する dialog の id を指すこと、`DrawerClose` と Escape での閉じ、`dismissible={false}` では閉じず `open` の制御でだけ閉じられること、`DrawerPortal` / `DrawerOverlay` の明示指定、a11y 自動検査を確認します。Portal 先は render の `container` の外に出るため、a11y 自動検査には `baseElement` を渡します。

jsdom には vaul が開くときに参照する `matchMedia` が無いため、テスト側で stub しています。実装からその依存を取り除く方向では対処しません。
