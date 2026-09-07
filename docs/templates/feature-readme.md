---
imports-allowed: [model, components, adapters, capabilities, stores, errors, logging, observability]
forbidden: [features]
test-requirement: feature
---

# <feature 名>

<!--
feature を追加するとき、このファイルを src/features/<feature-name>/README.md へコピーして記入する。

書く前に置き場を決める。この README が持つのは、この slice に固有の役割論と、契約・仕様・
デザインへの索引だけである。次の 3 つはここには書かない。

- 層そのものの役割・受入基準・import 境界 → src/features/README.md
- 画面が何を約束するか（条件・遷移・失敗の意味論）→ docs/spec/route/**
- 状態がどう見えるか → Storybook の story

同じことを 2 か所へ書くと、片方だけが腐る。索引は腐っても壊れた link として現れるが、写しは
黙って食い違う。**入れ子の README を持つ画面（例: `admin/shipments/`）は、その画面の契約・
状態・Action を子が持ち、親は route の地図と子への索引だけを持つ。**
-->

<!-- 必須節。readme-review の採点はこの一覧を読む。見出しの文字列で一致させる。
required-sections:
  - 受け入れるもの
  - 受け入れないもの
  - Route と契約
  - 状態とデザイン参照
  - 構成
  - 依存カーネル
  - Action 戻り値契約
  - テスト観点
-->

<!-- この slice が引き受ける画面と範囲を 1〜2 文で書く。 -->

## 受け入れるもの

<!-- この slice が持つもの。層の受入基準の再掲ではなく、この slice の線引きを書く。 -->

## 受け入れないもの

<!-- 隣へ渡すもの。渡す先（`components` / `model` / 他 feature の facade）を名前で挙げる。 -->

## Route と契約

| Route | 仕様書 | 認証 |
| --- | --- | --- |
| `<例: /items>` | `<docs/spec/route/… の screen / function への link>` | `<不要 / 必要 / 役割: admin>` |

使う operationId。

| operationId | 用途 |
| --- | --- |
| `<例: GetItems>` | `<例: 一覧の取得>` |

API を使わない slice は表を置かず「使わない」と理由を書く。operationId が未確定なら、確定する
契機を書く。

## 状態とデザイン参照

<!--
状態が「どう見えるか」は story が持つ。ここが持つのは、どの状態にどの story が対応するかだけ。
story の識別子は `<title>/<export 名>` で書く（title は stories.tsx の `title:`）。
-->

| 画面 | 状態 | story |
| --- | --- | --- |
| `<例: 一覧>` | success | `<例: Page/Items/List/Default>` |
| | empty | `<例: Page/Items/List/Empty>` |
| | loading | `<例: Features/Items/Skeleton/Default>` |
| | error | `<例: Features/Items/ErrorState/Default>` |

部分失敗があり得る場合は、成功領域を残す表示の story も行として挙げる。

## 構成

| ファイル | 役割 |
| --- | --- |
| `<例: list/page-content.tsx>` | `<例: 取得条件の解釈と画面の組み立て>` |

## 依存カーネル

| カーネル | 用途 |
| --- | --- |
| `<例: adapters>` | `<例: 一覧を取得して表示モデルへ変換する>` |

`architecture.ts` と各カーネル README の import 境界に従う。generated API 型を feature /
components へ渡さない。

## Action 戻り値契約

<!-- Server Action が無ければ「なし」と書く。置き場は feature 直下とは限らない。 -->

| Action | 置き場 | 戻り値 | 成功後 | 失敗時 |
| --- | --- | --- | --- | --- |
| `<例: addItemAction>` | `<例: actions.ts>` | `<例: ActionState<void>>` | `<例: revalidatePath("/items")>` | `<例: field error>` |

## テスト観点

<!--
層の宣言（`test-requirement: feature`）と ADR 0090 の層別責務は再掲しない。ここへ書くのは、
この slice でしか出てこない観点だけである。
-->

- [ ] `<例: 条件が URL へ載り、戻る操作で前の条件に戻る>`

## 運用

<!--
必須ではない —— **見出しの名前を固定しないため**である。ここに入るのはこの slice の設計判断で、
何を書くかによって呼び名が変わる（`運用` / `設計` / `設計上の判断` / `使い方` / `隣に置くもの`）。
名前を 1 つに決めると、決めた名前に合わない中身が別の節へ逃げる。

書くのは「なぜその線を引いたか」であって、何をしているかではない。
-->

<!--
必要なときだけ「Fork 時の変更点」の節を足す。テンプレートから作った側が差し替える箇所（backend 契約・デザイン・
認証）を書く節である。**題材のサンプルには要らない —— ファイルごと捨てられるためである。**
残る slice で、作った側が触らざるを得ない点があるときだけ置く。
-->
