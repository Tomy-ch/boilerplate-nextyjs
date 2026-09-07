# `stores` カーネル(横断 client 状態)

[0020](0020-adopted-architecture.md) の **機能スライス × 表示層カーネル** アーキテクチャにおけるカーネル **`stores`** について、その **責務 / 依存 / `"use client"` 不変条件 / 採用ライブラリ / 昇格基準** を定める。

[0060](0060-state-management.md) は「Server state = RSC fetch 既定 / Client state = local から」を定める。横断する client 状態を扱うライブラリとして **Zustand** を採用するにあたり、**複数 feature が共有する横断 client 状態を置く家**が要る(`capabilities` の横断 hook と同型のギャップ)。「実質のあるカーネルは自前 ADR を持つ」定石([0022](0022-capabilities-kernel.md) capabilities と同型)に従い独立させる。

## Status

Accepted

## 背景

[0021](0021-frontend-responsibility.md) の**昇格ルール**(横断要素を `model` / `components` / `adapters` / `capabilities` のいずれかへ)には、それだけでは**横断する client *状態*(stateful store)の出口が無い**。`capabilities` は runtime 能力を供給する reactive hook 限定で、アプリ状態ストアの家ではない。**横断性(複数 feature が共有)がある client 状態 → `stores` カーネル / 非横断(単一 feature 内)→ feature 内**([0021](0021-frontend-responsibility.md) 昇格ルールと同型)とする。

## 決定

### 責務

`stores` は、**複数 feature が共有する横断 client 状態**(Zustand ストア)を置くカーネルである。

- **既定は [0060](0060-state-management.md) のまま**: server state = RSC fetch / 単一 feature の client 状態 = feature 内 local state(`useState` / `useReducer`)。**真に横断する client 状態のみ `stores` へ昇格**する(受入基準 = 複数 feature 参照)。
- 採用ライブラリ = **Zustand**(軽量・de-facto。[0010](0010-standards-and-non-lockin.md) §1 標準準拠)。ストアは `"use client"`。

### `"use client"` 不変条件

`stores` は **client-only(`"use client"`)固定**。server state([0071](0071-bff-api-integration.md) の RSC/adapters)とは別軸で、ブラウザ上のセッション/UI 横断状態(選択状態・ウィザード・グローバル UI トグル等)を扱う。server から来たデータは RSC が props で渡し、store は client の相互作用状態を保持する(server state を store に二重持ちしない)。

### 受け入れないもの

- **server state**(→ RSC fetch / [0071](0071-bff-api-integration.md) adapters)。store に API レスポンスを二重キャッシュしない。**ただし「利用者が何を選んだか」自体を表す記録は例外**(下記)
- **単一 feature の状態**(→ feature 内 local state。昇格しない)
- **UI マークアップ**(→ `components`)/ `serverConfig` / secret / 業務ロジック(バックエンド責務。[0011](0011-no-docker.md))
- **ポリシー状態**(consent/flag は各 seam。[0031](0031-policy-state-supply.md))

### 選択の記録に含む表示値のスナップショット

**利用者の選択そのものを表す記録**(選んで溜めた項目の一覧、比較対象に選んだ項目、下書きに引いてきた値など)は、選択した時点の表示値を **スナップショットとして store に持ってよい**。これは前項の二重キャッシュ禁止の例外ではなく、そもそも射程外である。

禁じているのは **サーバが所有する最新値の写しを store に置き、鮮度管理を client 側で二重に持つこと**(= [0060](0060-state-management.md) が既定で外している client 取得・キャッシュ層の再発明)である。選択の記録は次の 3 点を満たす限りこれに当たらない。

1. **再取得しない**。store は鮮度を追わず、無効化も購読も持たない
2. **確定はバックエンドに委ねる**。値の妥当性と可否の最終判断は送信の時点でバックエンドが行い、store の値は表示と入力の材料にとどまる
3. **記録の主体が利用者である**。サーバの状態を映すのではなく、利用者の操作の結果として増減する

この 3 点のいずれかを外した時点で二重キャッシュになる。判定は store の型ではなく **鮮度の責任を誰が持つか** で行う。

### 依存

| 層(import する側) | 許可される import 先 |
| --- | --- |
| `stores` | `model` / `errors`(`config/client` の NEXT_PUBLIC リテラルは可)。`"use client"` |
| `features` | 既存 + **`stores`** |

- **`components` は `stores` を import しない**(純 UI・props-in を維持。合成は feature)
- **昇格ルールの 5 つ目の出口**: 横断する client 状態 → `stores`([0021](0021-frontend-responsibility.md))

### 移植性 / 非ロックイン([0010](0010-standards-and-non-lockin.md))

Zustand は de-facto の軽量 store で、`create()` + hook の標準形に乗る(vendor-independent = ストア API は React 慣用の hook で、Zustand を抜いても「横断 client 状態を hook で読む」構造は可搬)。ストアを feature/component に直書きせず `stores` に集約することで差し替え可能に保つ。exact-pin + `pnpm audit`([0004](0004-library-management.md))。

## 禁止事項

- ❌ `stores` に server state(API レスポンス)を二重キャッシュすること(server state は RSC/adapters)。**選択の記録に含む表示値のスナップショットはこれに当たらない**(§選択の記録)
- ❌ 単一 feature の状態を `stores` へ上げること(横断性が無ければ feature 内 local)
- ❌ `components` が `stores` を import すること(合成は feature 経由)
- ❌ `stores` に UI マークアップ / secret / `serverConfig` / 業務ロジックを置くこと
- ❌ Zustand ストアを feature/component に直書きして横断参照させること(横断は `stores` へ集約)

## 関連 ADR

- [0060-state-management.md](0060-state-management.md) — 状態管理方針(server=RSC / client=local 既定。本 ADR が横断 client 状態の家を持つ)
- [0022-capabilities-kernel.md](0022-capabilities-kernel.md) — 横断 client hook カーネル(本 ADR と同型の独立カーネル)
- [0071-bff-api-integration.md](0071-bff-api-integration.md) — server state(RSC/adapters。store と二重にしない境界)
- [0021-frontend-responsibility.md](0021-frontend-responsibility.md) — 昇格ルール(横断 client 状態 → stores の出口)
- [0010-standards-and-non-lockin.md](0010-standards-and-non-lockin.md) — Zustand 標準準拠 + 差し替え可能性
