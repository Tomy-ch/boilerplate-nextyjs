---
imports-allowed: [model, components, adapters, capabilities, stores, errors, logging, observability]
forbidden: [features]
test-requirement: feature
---

# maintenance

配信を止めているあいだ、全ルートの代わりに見せる面を持つ slice です。

## 受け入れるもの

- 止まっていることと、いま何ができないかの文面

## 受け入れないもの

- **止めるかどうかの判定**。入口（`src/proxy.ts`）が `config/maintenance` を読んで決めます。ここが
  判定を持つと、止まっているあいだ全ルートが動的になります
- **状態を変える要求を断ること**。差し替えは描く先を変えるだけなので、断るのは入口の仕事です
  （[仕様書](../../../docs/spec/route/maintenance/page.function.md)）
- **復旧の見込み**。予定を出すには運用がそれを供給する必要があり、供給が無いまま文面へ書くと
  当たらない予定が画面に残ります

## Route と契約

| Route | 仕様書 | 認証 |
| --- | --- | --- |
| `/maintenance` | [`screen`](../../../docs/spec/route/maintenance/page.screen.md) / [`function`](../../../docs/spec/route/maintenance/page.function.md) | 不要 |

**operationId は使いません。** 取得を持たないためで、契約が増えても変わりません。止まっている
あいだにバックエンドを引くと、止めた理由がバックエンド側にあるとき応答が返りません。

## 状態とデザイン参照

| 画面 | 状態 | story |
| --- | --- | --- |
| 停止中 | 既定 | 画面まるごとの story は置いていない（下記） |

**取得も操作も持たないため状態が 1 つしかなく、画面の story を置いていません。**置いても
`Default` 1 本になり、story が増えた分だけ VRT の実行時間だけが伸びます。見た目は E2E の画面比較が
受け持ちます（`e2e/lib/screens.ts` に `maintenance` があります）—— **止めていなくても
`/maintenance` は URL で開けます。** 差し替えの判定は入口が持ち、この画面自身は何も読まないためです。

## 構成

| ファイル | 役割 |
| --- | --- |
| `view.tsx` | 止まっていることの文面 |

## 依存カーネル

| カーネル | 用途 |
| --- | --- |
| `observability` | 描画を span に載せる |

取得を持たないため `adapters` を引きません。`components` も引きません —— 器（`main` と
`ContentContainer`）は route 側が置き、この面が持つのは文章だけです。

## Action 戻り値契約

なし。この画面に操作がありません。

## テスト観点

- [ ] 押せる物を置かない（止めているあいだ、押した先はすべてこの画面へ戻る）
- [ ] 当たらない終了予定を出さない

## テンプレートから作った側で変える箇所

文面はそのまま出ます。**連絡先や状況ページへの導線を足すなら、止めているあいだも到達できる
先か**を先に確かめてください。自分の配信面へ向けた導線は、入口が同じ画面へ差し替えます。
