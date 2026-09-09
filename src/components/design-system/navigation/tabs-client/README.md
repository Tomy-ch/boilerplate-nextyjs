# TabsClient

## 用途

同じ URL のまま、複数のパネルを切り替えて表示します。

## 役割と公開 component

| Component | 役割 |
| --- | --- |
| `TabsClient` | 選択中の tab を保持する client-side root です。 |
| `TabsClientList` | tab を並べる `tablist` です。矢印キーによる移動と roving tabindex を担います。 |
| `TabsClientTrigger` | パネルを選択する `tab` です。`value` で対応するパネルと結び付きます。 |
| `TabsClientContent` | tab に対応する `tabpanel` です。選択中の 1 枚だけが render されます。 |
| `tabsClientListVariants` | `TabsClientList` の見た目の variant を組み立てる helper です。 |

## 利用ケース

- 取得済みの内容を、URL に載せずに出し分けるだけの場合
- 入力途中の内容を保ったまま、補助的な表示を切り替える場合

## `TabsNative` との選び分け

見た目の好みではなく、**取得コストと URL で選びます**。

| | `TabsNative` | `TabsClient` |
| --- | --- | --- |
| 取得するデータ | 表示中の観点だけ | 全観点ぶんを毎回 |
| 初期 payload | 1 観点ぶん | 全観点ぶん |
| パネルの描画 | server | server（`children` 経由） |
| 共有・再読み込み・戻る | 保たれる | 失われる |
| 切り替えの体感 | route 遷移 | 即時 |

観点ごとに取得が分かれる場合や、パネルの内容が大きい場合は `TabsNative` を使います。`TabsClient` は表示していない観点まで初期表示に載せるため、観点が増えるほど、また内容が大きいほど不利になります。

## 責務境界

SSR first の選定では `◎` の例外に当たります。既定は URL で切り替える `TabsNative` であり、URL に載せたくない即時切替が必要な場合にこちらを選びます。hydration が必要で、Server Component からは直接 render できません。パネルの内容自体に client runtime が要らない場合は、Server Component で組み立てた要素を `TabsClientContent` の `children` として渡します。

`value` を渡すと制御 component、`defaultValue` を渡すと非制御 component として動きます。各 tab とパネルは `value` の一致で対応づけられます。取得、業務判断、選択の永続化は持ちません。

`role="tablist"` / `tab` / `tabpanel` を持ち、矢印キーでの移動、roving tabindex、選択とパネルの対応づけを Radix が担います。`TabsNative` と違い遷移を伴わないため、tab は link ではなく button として公開されます。同じ画面に複数の tabs を置く場合は、`TabsClientList` へ `aria-label` を与えてどの切り替えかを示します。

既定では非選択のパネルが DOM から外れます。入力途中の値を保持したい場合は、呼び出し元が state を持つか `forceMount` を指定します。

**`forceMount` が意味するのは「DOM へ残す」ことだけで、隠すのは `TabsClientContent` の責務です。** vendor は `forceMount` を「常に在る」と解釈して非表示の指定を落とすため、選択状態から見た目を自分で隠しています。これが無いと、値は残るものの全パネルが同時に見え、tab が切り替えではなく飾りになります。見た目に加えて支援技術からも外すには、呼び出し元が選択外のパネルへ `hidden` を渡します。

パネルの内容は **Server Component を `children` として渡します**。この component が client island でも、渡された要素は server で描画されたまま届きます。逆に client ファイルの中でパネルを `import` すると、その時点で client 境界に飲まれて全体が browser へ送られます。

選べない観点は、**原則として tab 自体を出しません**。権限がなく見せられない観点を disabled で並べると、到達できないものの存在だけを知らせることになります。データが未取得なだけなら、tab は有効のままパネル側に `Skeleton` を出します。`disabled` を使うのは、手順上まだ到達できない場合に限ります。切り替えは同期・即時で処理中の状態を持たないため、「処理が終わるまで塞ぐ」用途もありません。

vendor は現在 Radix ですが、公開 API に vendor 名は含めません。

## Storybook とテスト

Storybook は既定の構成、下線で示す `line` variant、縦向きを確認します。`disabled` は上記のとおり原則使わないため story を置いていません。

テストは `tablist` / `tab` / `tabpanel` の意味論と `tablist` の命名、選択中だけが `aria-selected` になること、選択中のパネルだけを表示すること、`forceMount` で DOM へ残した場合に選択外の入力も送信に残ること、そこへ `hidden` を渡せば表示から外れること、選択によるパネルの入れ替え、矢印キーでの移動、link ではなく button として公開されること、`disabled` を渡した場合に実際へ選択を弾くこと、a11y 自動検査を確認します。

操作の起点は `click` ではなく `mouseDown` です。Radix は pointer 押下と focus で選択を切り替えるため、テストもその経路に合わせています。矢印キーによる focus 移動は非同期に行われるため `waitFor` で待ちます。
