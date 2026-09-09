---
test-requirement: unit
coverage-exclusions:
  - ".storybook/css.d.ts"
  - ".storybook/lib/sample-asset.ts"
  - ".storybook/main.ts"
  - ".storybook/manager.ts"
  - ".storybook/msw/handlers.ts"
  - ".storybook/msw/worker.ts"
  - ".storybook/preview.tsx"
---

# .storybook

部品カタログ（Storybook）の設定と、カタログ自身が持つ判定の置き場
（[0054](../docs/adr/0054-ui-catalog-storybook.md)）。story そのものは部品の隣に置き、ここには
置かない。例外は design token の目録で、対象が特定の部品ではなく token の全件であるため
[`design-token.stories.tsx`](design-token.stories.tsx) をここに持つ（配置の根拠は
[`src/components/README.md`](../src/components/README.md)）。

## 構成

| パス | 役割 |
| --- | --- |
| `main.ts` | 読み込む story の範囲・addon・配信する資材 |
| `preview.tsx` | 配色と系統の切り替え、横断 Provider の mount、Server Action の差し替え |
| `manager.ts` | カタログの外枠の見た目 |
| `msw/` | カタログが自分で答える `/api/*`（契約からの生成物ではない。置き場を分ける理由は [`mocks/README.md`](../mocks/README.md)） |
| [`lib/`](lib/) | カタログ自身の module —— 表示のための計算、例外の受け止め、横取りの対象判定、配る資材の綴り |

`lib/` は部品の隣に置いた story からも読む。経路は `~catalog/*` で、宣言は
[`tsconfig.json`](../tsconfig.json) の `paths`、写しが [`vitest.config.ts`](../vitest.config.ts) にある。
**`@` で始まる別名にはしない。** `@x/y` は npm の scope と同じ形なので、biome の
`noUndeclaredDependencies` が未宣言の依存として弾く。

## story がカタログの器から受ける制約

部品ではなくカタログの器に由来する決まりは、ここが持つ。story を書く側の規約は
[`src/components/README.md`](../src/components/README.md) と
[`src/features/README.md`](../src/features/README.md) にある。

- **overlay の中身は canvas の外に出る。** dialog / menu / combobox の面は Portal で `document.body`
  直下へ描かれるので、`play` は開く操作を `within(canvasElement)` から、開いた面を
  `within(document.body)` から引く。canvas の内側で待つと、開いているのに見つからないまま timeout する
- **同じ store を読む story を 1 つの docs ページへ並べるときは、iframe を分ける**
  （`parameters.docs.story.inline: false`）。docs ページは載せた story を 1 つの木で描くので、開いた状態と
  閉じた状態のように store の値が違う story を並べると、後の story が立てた値が先の story にも及ぶ。
  focus を閉じ込める面も同じ形で分ける —— 展開すると資料そのものを操作できなくなる

## `msw/` の答え方

- **契約が区別している 2 つの結果は、別々に到達できる入力を持つ。** 「該当なし」と「機構が使えない」の
  ように、契約が別の印で返し画面も言い分ける結果を、モックが片方へ畳むと、画面が言い分けている側を
  カタログで確かめられない
- **読み進める一覧に続きを持たせない**（cursor は `null`）。カタログの一覧は数件しか置かないので末尾の
  目印が最初から見えており、続きを返すと届いた先でまた末尾が見え、際限なく取りに行く。DOM が静止しない
  ので基準画像も撮れない（[`vrt/README.md`](../vrt/README.md)「揺らぎを止めてある」）

## テストの責務

frontmatter の `test-requirement: unit` が掛かるのは `lib/` である。

**判定を持つものは `lib/` へ置く。** `main.ts` / `preview.tsx` / `manager.ts` は設定で、読み込まれた
時点で副作用を起こす（資材の複製・書体の class 付与・mock の宣言）ため単体では回せない。`msw/worker.ts`
も同じく、ブラウザの service worker を立てるだけである。設定や配線の中に判定を書くと、そこは検査の
届かない場所になる。

**この配下は丸ごと 1:1 ゲートとカバレッジ母数に乗る**（[`vitest.config.ts`](../vitest.config.ts) /
[`scripts/one-to-one.gate.test.ts`](../scripts/one-to-one.gate.test.ts)）。外れるものは
[`scripts/lib/untested-modules.ts`](../scripts/lib/untested-modules.ts) が理由と撤去条件つきで
宣言する。範囲を狭めて外すと、外した記録がどこにも残らない。
