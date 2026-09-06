---
imports-allowed: [model, components, adapters, capabilities, stores, errors, logging, observability]
forbidden: [features]
test-requirement: feature
---

# features

画面単位の機能スライスです。各 `features/<name>/` に画面ユースケース、専用 UI、hook、Server Action をフラットに共置します。

## 受け入れるもの

- データ取得の編成、複数 API の集約、フォーム送信フロー、楽観更新
- その feature 専用の UI、hook、`actions.ts`

## 受け入れないもの

- 他 feature への直接依存
- 複数 feature で共有すべき要素、バックエンドの業務ロジック

## slice の一覧

**この層の役割論はここが持ち、各 slice の README はそれを再掲しません。** 子が書くのは、その
slice に固有の線引きと、契約・仕様・デザインへの索引です。雛形は
[feature README テンプレート](../../docs/templates/feature-readme.md) が持ちます。

| slice | 役割 | README |
| --- | --- | --- |
| `auth/` | 身元を預ける入口。認証そのものは持たず、BFF の口へ渡す | [README](auth/README.md) |
| `dev-session/` | 開発時に主体を差し替える面。本番の束には載らない | [README](dev-session/README.md) |
| `maintenance/` | 配信を止めているあいだ、全ルートの代わりに見せる面 | [README](maintenance/README.md) |

<!-- sample:begin -->
同梱のサンプルが加えるもの:

| slice | 役割 | README |
| --- | --- | --- |
| `home/` | 入口の面。複数の取得を並べ、片方の失敗で全体を落とさない | [README](home/README.md) |
| `products/` | 題材を探して眺める。条件を URL に載せ、増分で読み進める | [README](products/README.md) |
| `cart/` | 買う前の入れ物。他 slice へ操作の口を facade で貸す | [README](cart/README.md) |
| `checkout/` | 確定の手前。カートと届け先を突き合わせ、1 回だけ送る | [README](checkout/README.md) |
| `purchases/` | 確定したものの履歴と 1 件の詳細、そこからの状態遷移 | [README](purchases/README.md) |
| `account/` | 自分の記録。登録・編集・退会と、自分向けの集計 | [README](account/README.md) |
| `admin/` | 役割を持つ主体だけが入る運用面 | [README](admin/README.md) |
| `site-info/` | 取得を持たない静的な面 | [README](site-info/README.md) |
<!-- sample:end -->

## 描画を span に載せる

エクスポートを `observability` の 2 つで包む。**どちらで包むかは置き場で決まる。**

| 置き場 | 使うもの | 既定 |
| --- | --- | --- |
| 画面の最上位（`<screen>/page-content` / `<screen>/view`、および殻の側で取得を持つ合成） | `withScreenSpan` | 有効 |
| `<screen>/ui/**` | `withPartSpan` | 無効（`OBS_RENDER_SPANS=part` で開く） |

```tsx
export const XxxPageContent = withScreenSpan(
  "features/<name>/<screen>/page-content",
  async ({ id }: XxxPageContentProps) => {
    // 取得と組み立て
  },
);
```

**殻と穴に割れた画面は、最上位が 2 つ以上になる。** Cache Components 有効下では、待たずに配れる節を
`Suspense` の外へ出すことがある（[0041](../../docs/adr/0041-cache-components-decision.md)）。出した側も
取得を持つ画面の最上位なので `withScreenSpan` で包み、span 名はその module のパスに揃える —— 1 つの route に
最上位の span が複数立つことになるが、それは殻と穴が別々に解決されるという事実そのものである。

仕組みと span の読み方は [observability/README.md](../observability/README.md) が持つ。

- **名前は `src/` からのモジュールパスと一致させる。** span 名がそのまま置き場を指すので、ずれると trace からファイルへ戻れない。利用者の入力を混ぜない
- **client component（`"use client"` を持つファイル）は包まない。** ブラウザでの描画では span を作らないため、包んでも得られるのは server 描画の 1 回分だけである
- **取得を持つ側を包むと帰属が付く。** `page-content` が待つ通信はその span の中に入るので、外向きの `fetch` を画面へ結び付けられる
- **部品は常用しない。** `part` を開けると 1 描画の span が描く部品の数だけ増える。値打ちが出るのは、分岐した結果——どの姿を返したか——を trace から読みたいときである

## カタログに載せる

画面は `Page/`、部品は `Features/` に置く（先頭セグメントの決まりは
[`components/README.md`](../components/README.md)）。**`<screen>/ui/**` と `facade/**` の描画する部品は、
すべて自分の story を持つ。** 画面の story から届く状態であっても持つ —— 画面は部品を 1 つの姿で
しか通らないので、部品が表せる残りの状態（帯ごとの幅・契約上の最大長・送信中・拒まれた結果）は
そこに現れない。

story を持てないのは**ブラウザで描けない部品だけ**である。`server-only` を辿る取得を中に持つ
async な合成がそれにあたる。持てない理由と、中身がどこで見られるかを本体の doc に書く。

- **`title` の体系は [`components/README.md`](../components/README.md) が持つ。** ADR 0054 が所有者をそこ 1 か所に定めているので、ここには写さない
- **`@see Storybook` は自分の story を指す。** 画面の story を指していると、その部品を直す人が
  確かめる先を見つけられない
- 送信中は解決しない送信先（[`~catalog/lib/pending-action`](../../.storybook/lib/pending-action.ts)）で
  留める。すぐ返る送信先では、撮る前に送信が終わっている
- Server Action を直に読む部品は、`.storybook/preview.tsx` の差し替え宣言に載せる
  （[0054](../../docs/adr/0054-ui-catalog-storybook.md)）。載せないと、押した先で `config` の読み込みに落ちる
- 入力の状態を外から受ける部品は、本物の hook を通した器で包む。差し替えると label と control の
  対応まで偽物になり、カタログで確かめられるものが無くなる

## 運用

- 横断利用が必要になった要素は責務に応じて `model`、`components`、`adapters`、`capabilities`、`stores` へ昇格する
- Server Action は編成だけを担い、業務ロジックを置かない
- feature ごとにも同じ frontmatter を持つ README を置く
- **`test-requirement: feature` が掛かるのは画面の合成**（`view` / `page-content` と、その feature 専用の UI）である。値を返す対象——純関数、hook、Server Action の補助——は [0090](../../docs/adr/0090-testing-strategy.md) 層別責務表の `unit` 行（「feature 内純関数」）に従う。宣言が feature の下の全ファイルへ一律に掛かると、React のツリーを要さない対象にまで合成の観点を課すことになり、テストの側が正しいのに宣言と食い違う
