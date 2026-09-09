# 置き場の決め方

新しく作るもの（表示・hook・client 状態）を**どこへ置くか**を決めるための手順書である。

**判断そのものはここが持たない。** 層の責務は [ADR 0021](../adr/0021-frontend-responsibility.md)、物理配置は [ADR 0027](../adr/0027-directory-structure.md)、器への mount は [ADR 0026](../adr/0026-layout-shell-mount.md)、各カーネルの受け入れ範囲は層別 README が正である。ここが持つのは**それらを引くための順序**と、**引き当てを間違えやすい点**だけである。食い違う場合は ADR を優先する。

## 先に効く 1 つの問い

**題材の語彙を持つか。**

持つものは、層をどう辿っても `components` へは置けない。`components` はサンプル除去後も残る側であり、残留検査（`scripts/setup/remove-sample/sample-manifest.ts` の `DANGLING_PATTERN`）が題材の語を弾く。**この判定を最初に済ませると、以降の分岐が半分に減る。**

## 表示（UI）

```text
題材の語彙を持つか？
├─ 持たない → components
│   ├─ 置く位置と数が決まっている（器の部品）        → shell/
│   ├─ バックエンドの契約を知っている                → app-starter/
│   ├─ 役割をまたぐが契約は知らない                  → patterns/
│   └─ 役割が閉じている                              → design-system/<役割>/<部品>/
└─ 持つ → features（カーネルへは上げられない）
    ├─ 1 つの画面だけが使う          → features/<name>/<screen>/ui/<part>/
    ├─ 同じ feature の複数画面が使う → features/<name>/ui/<part>/
    └─ 他の feature も使う           → features/<name>/facade/<part>/
```

- `components` の区分は [`components/README.md`](../../src/components/README.md) が正
- feature 内の 3 段は [ADR 0027](../adr/0027-directory-structure.md) の co-location 方針、`facade/` の条件は [ADR 0021](../adr/0021-frontend-responsibility.md)「昇格できないもの」が正
- **上げるのは実際に使われてからである。** 「使いそう」で先に上げない。使う側が 1 つに戻ったら下ろす

## hook

```text
何に依存するか？
├─ ブラウザの能力（media query / storage / clipboard 等）
│   ├─ 複数 feature が使う          → capabilities/
│   └─ 1 つの部品に密着している      → その部品のディレクトリへ co-location
└─ 画面の都合                        → その画面（features/<name>/<screen>/）
```

- `capabilities` の受け入れ範囲は [`capabilities/README.md`](../../src/capabilities/README.md) が正
- **UI に密着した挙動 hook（focus trap、scroll 制御、gesture の観測など）は `capabilities` ではない。** その部品の隣に置く（[ADR 0022](../adr/0022-capabilities-kernel.md)）
- `components` は `capabilities` を import できない。`components` の部品に要る hook は、その部品の隣に置く

## client 状態

```text
誰が持つか？
├─ 複数 feature が読み書きする        → stores/
├─ 横断 UI 自身の状態（queue、開閉）  → components（その部品が Provider ごと持つ）
└─ 単一 feature に閉じる              → その feature の中（local state）
```

- [ADR 0023](../adr/0023-stores-kernel.md) と [ADR 0060](../adr/0060-state-management.md) が正
- 横断 UI が自分の状態を持つ形は [ADR 0026](../adr/0026-layout-shell-mount.md)「横断 UI 状態の帰属」で決まっている
- **サーバの応答から組み立て直せないものは、見せていた側が持つ。** 取り消しの材料（消えた対象と、消えた時点の並び）がその典型で、消えた対象はもう応答に無く、並びは画面の見え方そのものである。応答から直前の姿を復元しようとせず、表示側の状態として覚える

## 引き当てを間違えやすい点

### `components` は `stores` を import できない

依存マトリクス（`architecture.ts`）で `components` が許されているのは `model` と `errors` だけである。したがって**特定の状態を触る UI は `components` へ置けない**。「UI だから `components`」で始めると、ここで詰まる。

同じ理由で `components` は `capabilities` も import できない。

### 昇格できないものがある

[ADR 0021](../adr/0021-frontend-responsibility.md) の昇格表は「UI → `components`」と書いているが、**題材の語彙を持つ UI にはこの行が使えない**。上げ先が無いまま複数 feature が必要とした場合だけ、`facade/` を使う。

### 「使いそう」で上げると戻らない

予測で上げたものは、予測が外れても誰も下ろさない。**現に 2 つ以上が使っていること**を条件にすると、判断が観測可能になる。[ADR 0027](../adr/0027-directory-structure.md) が「再利用予定」の軸を禁じているのはこのためで、現在の事実で決めることは禁止に当たらない。

### 器へ置くものは props の口から差す

横断的な操作を足したくなったとき、器そのものを client 側へ倒すと、器が import しているものが全部ブラウザへ送られる。器に口を開けて小さい部品を渡す（[rendering.md](rendering.md)、[ADR 0026](../adr/0026-layout-shell-mount.md)）。

### 島を切り出しても、並びの見た目は 1 か所が決める

同じ並びに置く要素のうち 1 つだけが操作を持つと、その 1 つは Client Island として別ファイルへ割れる（[rendering.md](rendering.md)）。ファイルが割れても、**並びの見た目の宣言は 1 か所に残す** —— 選択肢の並びなら、その並びを定義する 1 ファイルが全要素の見た目を持ち、島はそれを読む。島の側が自分の見た目を持つと、同じ並びが 2 か所で決まり、片方だけ直した日にずれる。

### `features` 同士は直接参照しない

相手の内部を import して解決してはならない。使えるのは相手の `facade/` だけで、それも上げ先のカーネルが無い場合に限る。

## 迷ったときに戻る問い

1. **題材の語彙を持つか** — 持つなら `components` は消える
2. **いま実際に何が使っているか** — 予測ではなく現在の事実で決める
3. **上げ先のカーネルが受け取れるか** — 受け取れないなら、その事実が置き場を決めている

3 つとも答えても決まらない場合、**分け方そのものが合っていない**可能性がある。置き場を増やす前に、feature の切り方か部品の粒度を疑う。
