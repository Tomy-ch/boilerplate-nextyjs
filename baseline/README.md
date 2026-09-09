---
test-requirement: unit
---

# baseline

基準画像の置き場と、その置き場に対して働く操作（撮り直し・送出・承認・掃除）を持つ。
**story 単位の撮影（[vrt](../vrt/README.md)）と画面単位の撮影（[e2e](../e2e/README.md)）が
1 つを共有する**ため、どちらにも属さないここに置いてある。

| どこ | 何 |
| --- | --- |
| `images/` | **サブモジュール**。基準画像の置き場を指す gitlink |
| [`lib/store.ts`](lib/store.ts) | 置き場の区画割り。2 種類の撮影の住み分けと、撮り直し中かの判定 |
| [`lib/orphans.ts`](lib/orphans.ts) | 置き場にある画像と、在るべき画像の突き合わせ |
| [`lib/targets.ts`](lib/targets.ts) | 置き場のパスから、見直しの入口が取る対象名への逆変換 |

在るべき一覧の組み立てだけは撮影対象の数え方が違うので、それぞれが持つ
（[vrt](../vrt/lib/expected-baselines.ts) / [e2e](../e2e/lib/screen-baselines.ts)）。

## 置き場を 1 つにしている理由

承認の単位が**置き場のポインタ 1 つ**だからである。撮り直しだけを 2 つに割ると、1 つのラベルで
承認する範囲を 2 つのラベルで撮り直すことになり、承認と撮影の粒度がずれる。掃除も同じで、
生きた ref から到達しない一式を落とす操作は置き場 1 つに対して働く。

区画は `screen/` が画面単位、それ以外が story の系統である。story の系統がこの予約区画を
名乗っていないことは撮影のたびに検査する（[`lib/store.ts`](lib/store.ts)）。

## 操作

| したいこと | 手元 | CI |
| --- | --- | --- |
| story を撮り直して送る | `make vrt-retake` | `baseline-retake` ラベル |
| 画面を撮り直して送る | `make e2e-retake` | 同上（1 つのラベルが両方を撮る） |
| 撮ったものを送る | `make baseline-push` | 撮り直しに含まれる |
| 履歴を掃除する | `make baseline-prune` | 月次で促す issue が立つのみ。**実行は必ず人が起こす** |

CI 側の撮り直しは story と画面をまとめて行う。範囲の取り方だけは別で、story は比較が報告した
ものに絞られ、画面は報告を持たないので常に全数を撮る。

## 撮り直しは承認ではない

`baseline-retake` は画素を**見られる形にするだけ**で、見た目を受け入れたことは `baseline-approve`
が表す。承認をラベルに取る理由と、承認が今の一式にだけ効く仕組みは
[docs/design/vrt.md](../docs/design/vrt.md) の「撮り直しは承認ではない」以降が持つ。

機構の全体像は [docs/design/vrt.md](../docs/design/vrt.md) にある。
