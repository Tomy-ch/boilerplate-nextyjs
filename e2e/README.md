---
test-requirement: unit
coverage-exclusions:
  - "e2e/**/*.spec.ts"
  - "e2e/lib/test.ts"
---

# e2e

**画面を通した検証**。組み上げたアプリを実際のブラウザで動かし、部品単体では
見えないものだけを見る。

story 単位の検査（[`vrt/`](../vrt/README.md)）とは**見ている対象が違う**。あちらは部品を単独で
描いた姿で、ここは部品を組み上げた画面と、画面をまたぐ経路である。部品が個別に緑でも、並べた
ときに崩れる形も、遷移が繋がっていない状態も作れる。

## 何を見ているか

| | 見ているもの | ここでしか見えない理由 |
| --- | --- | --- |
| ジャーニー | 画面をまたぐ遷移・絞り込み・認証の前捌き | 経路が繋がっているかは、画面 1 枚では答えられない |
| Browser Errors | hydration の不一致・描画中の例外・通信の失敗・CSP 違反 | **hydration の不一致は build も型検査も通る。**実機で描いたときにしか現れない。CSP の違反も同じで、ヘッダを読む検査（DAST）は enforce の結果を見ない |
| Responsive | 帯ごとの出し分け（[`docs/rules.md`](../docs/rules.md) #71） | 帯は viewport の関数であり、jsdom には幅が無い |
| 履歴 | 被せた面と画面遷移が同じ履歴を奪い合わないか | 競合するのは実ブラウザの履歴操作どうしで、jsdom には相手が居ない |
| Cross Browser | 描画エンジン固有の破綻 | 1 つのエンジンで通ることは、他の 2 つで通ることを意味しない |
| 別 origin | 宣言した origin から BFF が読めること・宣言に無い origin からの書き込みが止まること | preflight の自動発行と CORS の読み取り制限は実ブラウザにしか無い。宣言した origin の文書は起動側が別ポートに立てる（`scripts/e2e/partner-origin.ts`。偽装すると Chromium の Private Network Access に止められる） |
| 画面単位の見た目 | 画面 1 枚ぶんの基準画像との比較 | 部品の比較を全部足しても、並べた結果にはならない |
| 画面単位の a11y | landmark・`main`・h1 と、配信される document（[`lib/a11y-rules.ts`](lib/a11y-rules.ts)） | story は部品を単独で描くのでこの 4 つが成立せず、Storybook の iframe document を評価してしまう |
| フォーカス | 被せた面が焦点を受け取り、閉じ込め、閉じたら返すか | **jsdom はフォーカスの実装を持たない。**`inert` も focus trap も無く、`Tab` の巡回順は近似である |
| 配信の停止 | `APP_MAINTENANCE_MODE=on` で起動したプロセスが、実際に全ルートを差し替えるか | **入口の分岐も設定も、層ごとには mock 越しにしか確かめていない。**結線は起動してみないと分からない |
| 公開面 | `robots.txt` / `sitemap.xml` / 各画面の canonical / アイコンと OG 画像が、クローラが読む形で成立しているか。索引させる設定と索引させない設定の両方（[`docs/rules.md`](../docs/rules.md) #63） | **metadata は中身が壊れていても画面が壊れない。**空の sitemap・他人を指す canonical・実行時に落ちる `ImageResponse` は build も単体テストも通る |

**ジャーニーの実体は題材と一緒に消えるが、観点は消えない。** 上の表はテンプレートから作った側が自分の画面へ
書き換えたあとも成り立つもので、題材の破棄で失われるのは spec ファイルだけである。**書き換える
ときは、観点ごと落とさないこと** —— とくに履歴は、単体テストが原理的に届かない唯一の観点で、
ここを落とすと「押しても移らない導線」を誰も見張らなくなる。

## テストの責務

frontmatter の `test-requirement: unit` が掛かるのは、**Vitest から回る `lib/` の判定**である。
`*.spec.ts` は Playwright が実行する本体で Vitest からは呼べない。何を異常と数えるか・どの画面を
開くかといった判定を `lib/` へ切り出してあるのは、spec の中に置くと 1:1 の対象にできないためである。

## 使い方

```bash
make e2e          # 主要ジャーニーを回し、画面の見た目を基準画像と比較する
make e2e-maintenance  # 配信を止めた状態で起動し、停止の機構が成立することを確かめる
make e2e-metadata # 索引させる設定で build して起動し、公開面が成立することを確かめる
make e2e-update   # 画面の基準画像を撮り直す（置き場へ送るのは make baseline-push）
make e2e-report   # 直前の実行の HTML レポートを開く
make e2e-review   # CI が落とした画面を手元で開く（後述「落ちた画面を手元で開く」）
make review-clean # 見直しで生やした作業ツリーを片付ける
```

`E2E_ARGS` で Playwright へそのまま引数を渡せる。

```bash
make e2e E2E_ARGS='--project=chromium --grep "ログイン"'
```

`E2E_PORT` でアプリを待ち受けるポートを変えられる（既定 `3100`）。既に何かが待ち受けている
ポートを指定すると、実行の手前で落ちる —— 起動待ちが他人のサーバへの疎通で満たされると、
その相手に対してテストが走ってしまうためである。

**待ち受けるアドレスは、コンテナが到達に使う経路 1 本だけに絞ってある。**この起動は
`APP_ENV=ci` を使い、その環境ではテスト専用の session 発行の口が開いている（後述）。全ての
インターフェースで待ち受けると、その口が同じ LAN の他のホストから叩ける状態になる。宛先は
`make e2e` が解決する（Docker Desktop はホストの loopback、Linux は bridge の gateway）。
明示したいときは `E2E_HOSTNAME` を渡す。

### 落ちた画面を手元で開く

画素が違った PR のコメントには、**落ちた画面をそのまま開く 1 行**が付く。別の端末へ貼るだけでよい。

**撮り直しのコメントにも同じ 1 行が付く。**並べるのは**画素が実際に動いた画面**だけで、撮り直しの
範囲もそれと同じ集合である（story 単位の側と同じ扱い —— [`vrt/README.md`](../vrt/README.md)）。

```bash
make e2e-review BRANCH=<ブランチ> RUN=<run-id> E2E_ONLY=<画面名>,<画面名>
```

| 項目 | 値 |
| --- | --- |
| `BRANCH` | 見る対象のブランチ。**必須** |
| `E2E_ONLY` | 落ちた画面の名前をカンマで並べる。**必須** |
| `RUN` | CI の実行 id。渡すとその実行の `e2e-diff` を落として隣のポートで配る（`gh` が要る） |
| `E2E_REVIEW_PORT` | アプリを待ち受けるポート。既定 `3200`（`make e2e` の `3100` とも開発サーバの `3000` とも別にする） |

`tmp/review/e2e/<ブランチ>` に使い捨ての作業ツリーを生やし、`origin/<ブランチ>` の先端へ合わせて
依存を入れ、**本番ビルドを起動して**落ちた画面の URL を並べる。開発サーバで見ないのは、基準画像が
本番ビルドで撮られているためである。**手元の作業ツリーは動かさない**ので、編集中の変更を抱えたまま
呼べる。見終わったら Ctrl-C で止める。

役割の要る画面（`signedIn` を宣言した画面）は、直接開くとログインへ送られる。並ぶのは行き先を
持たせた開発用 session の面の URL なので、役割を選べばそのまま目的の画面へ着く。

**作業ツリーは残る。**`node_modules` と本番ビルドを抱えたまま `tmp/review/` に溜まっていくので、
片付けるときは **`make review-clean`**（story 単位の側で生やしたものも一緒に片付く）。ディレクトリを
直接消すと実体を失った登録が `.git` に残るため、この入口を使う。

この起動も `APP_ENV=ci` なので、待ち受けは loopback へ絞ってある（理由は前述のとおり、テスト専用の
session 発行の口が開いているため）。

> **story 単位の側（[`vrt/README.md`](../vrt/README.md)）と同じ限界がある。**ここで見えるのは
> 「なぜ変わったか」であって、画素の一致ではない。手元のブラウザとホストのフォントで描くので、
> CI が撮った画像とは元から一致しない。

## 停止中だけは別の起動で回る

`APP_MAINTENANCE_MODE` は**全ルートに効き、切り替えに起動し直しが要る**
（[仕様書](../docs/spec/route/maintenance/page.function.md)）。1 回の起動の中に「止まっている画面」
と「止まっていない画面」を同居させられないので、`maintenance/` だけは自分の設定
（`playwright.maintenance.config.ts`）と自分の起動を持つ。

```bash
make e2e-maintenance   # 止めた状態で起動し、3 つの応答を確かめる
```

見るのは応答の成立だけで、**基準画像を撮らない**。停止画面の見た目は通常の巡回が `/maintenance`
を開いて撮っている —— この画面は止めていなくても URL で開けるためである。

`lib/test.ts` の `test` を使わないのもここだけである。あれはサーバ側の 5xx を異常として数えるが、
停止中の 503 は意図した応答なので、見張りに掛けると成立が失敗として現れる。

## 索引させる側だけは別の build で回る

`SITE_INDEXABLE` は **build 時に読まれ、静的に描かれる画面の metadata と `robots.txt` へ焼き込まれる**
（`src/config/site/site.server.ts`）。通常の巡回は既定（`off` = 索引させない）で build するので、
索引させる側の公開面はその build には存在しない。`metadata/` だけは自分の設定
（`playwright.metadata.config.ts`）と、`SITE_INDEXABLE=on` を build から渡す自分の起動を持つ。

```bash
make e2e-metadata   # 索引させる設定で build して起動し、公開面を読む
```

見るのはクローラが読む応答だけで、**基準画像を撮らない**。`robots.txt` が巡回を許しサイトマップの
場所を知らせること、`sitemap.xml` が挙げる URL がすべて実在して自分を正規 URL として名乗り索引を
断っていないこと、画面が名乗るアイコンと OG 画像が絵として返ることを確かめる。外から見た origin
（`SITE_PUBLIC_ORIGIN`）にはコンテナから見たアプリの場所を渡すので、画面が名乗る URL と spec が
開く URL は同じ綴りになる。

索引させない側は通常の巡回が見る（`journeys/metadata.spec.ts`）。`robots.txt` が全経路を断り、
画面が `noindex` を名乗ること。両方が通ってはじめて、切り替えが設定で効いていると言える。

`lib/test.ts` の `test` を使わないのは停止中の検証と同じ理由に加えて、あれが画像の要求を 1 枚の
代替に差し替えるためである。絵として返るかを見たい相手を、絵に差し替えた上では確かめられない。

## 最初の一式から外した島は、描き終わりを待ってから撮る

`next/dynamic` で最初の読み込みから外した島（作図など）は、**枠だけを置いて後から描かれる**。
届く前に撮ると枠のまま写り、しかも**枠は連続して撮っても同じ絵**なので、Playwright の
「同じ絵が 2 回続いたら撮る」判定では待てない。届いた日と届かなかった日の絵が交互に基準へ入る。

撮る側が待つ相手を知っている必要があるので、画面の宣言（[`lib/screens.ts`](lib/screens.ts)）へ
`settled` として**中身にしか現れない要素**を書く。枠そのものを指しても意味がない。

```ts
{ route: "/<route>", name: "<画面名>", path: "/<開く URL>", settled: "<中身にしか現れない要素>" }
```

**待つのは撮影だけである。** 巡回（journeys）は操作の前に対象を待つので、この宣言は要らない。

## 落ちたときにどれをやるか

**落ち方は 3 つあり、次にやることが違う。**撮り直しが直すのは画素だけで、残る 2 つは撮り直しても
直らない。宣言が足りていないまま撮り直すと、その状態が次の正になる。

| 落ち方 | 目印 | やること |
| --- | --- | --- |
| 画面の宣言が足りない | `画面の宣言がありません` | [`lib/screens.ts`](lib/screens.ts) へ宣言を足す（後述「何を開くか」） |
| ジャーニーが落ちた | `✘ … e2e/journeys/…` | trace を開いて原因を特定する。1 つの描画エンジンだけなら engine 固有の挙動か実行環境のゆらぎ |
| 画素が違う | `toHaveScreenshot` / `A snapshot doesn't exist` | 変化が意図したものか確かめてから撮り直す（後述「基準画像は story 単位と同じ置き場に入る」） |

CI の失敗コメントもこの 3 つで出し分ける。**落ちた画面それぞれについて、なぜ変わったかを言える
までは撮り直さない**（[docs/design/vrt.md](../docs/design/vrt.md) の「限界」）。

## アプリはホスト、ブラウザはコンテナ

ブラウザとフォントは digest を固定した Playwright 公式イメージが持つ
（[`docker-compose.dev-tools.yml`](../docker-compose.dev-tools.yml) の `browser_runner`）。基準画像が
一意なのは**どのイメージで撮ったか**によってであり、撮った人の環境によってではない
（[vrt/README.md](../vrt/README.md#コンテナの中でしか撮らない)）。3 つの描画エンジンが揃った版で
入っているのも、このイメージだけである。

一方で**アプリはホストで起動する**。`node_modules` は入れた OS と CPU 向けに解決されるので、
コンテナの中で `next start` を起動すると linux 向けのネイティブモジュールが無い。イメージの役目は
ブラウザとフォントを固定することであって、アプリの実行環境を固定することではない。

起動と後片付けは `make e2e` が持つ。コンテナの中から見たアプリの場所は `E2E_BASE_URL` で渡る。

## バックエンドは要らない

`APP_API_MODE=mock` で起動する（`make e2e` は `APP_ENV=ci` を使う）。相手が実物のバックエンドだと、
向こうのデータが変わるたびに落ち、落ちた理由が退行なのか向こうの都合なのか区別できない。
設定がモードを指していなければ、実行の手前で落ちる（[`playwright.e2e.config.ts`](../playwright.e2e.config.ts)）。

**モックは同じ要求へ同じ応答を返す**（[`mocks/stable-responses.ts`](../mocks/stable-responses.ts)）。
呼ぶたびに中身の変わるモックの上には、見た目の比較も中身の検証も載らない。

**「いま」も固定する**（`CLOCK_FIXED_NOW` / [`src/config/clock`](../src/config/clock)）。応答を決める
seed は要求の URL から導かれるので、暦日で区切る画面が実時計から区間を組み立てると、**URL が日ごとに
変わり、その画面の値が総入れ替えになる**。撮った暦日のあいだしか一致しない基準画像になり、撮り直しても
翌日また落ちる。日付を描く場所を `mask` で外しても届かない —— 外れるのは日付の表示であって、seed から
生まれる値そのものは画面じゅうに散っている。

実時計を読む場所は `app` に置く。`features` は `config` を参照できないため（`architecture.ts`）、
「いま」は合成の入口が解決して props で配る。

ログイン済みの状態は、テスト専用の session 発行の口
（`src/app/api/auth/test-session/route.dev.ts`）から作る。認証は OpenAPI 契約の外にあり、契約から
生成したモックでは偽装できないためである。口が開くのは `local` / `ci` だけで、開いていない環境では
`signIn` が落ちる。

## 画像は差し替える

配信元（`MEDIA_ORIGIN`）はモックしない。素通しにすると `next/image` の最適化が取得に失敗して
500 を返し、見張りが全ての画面で鳴る。代わりに `/_next/image` へ 1×1 の絵を返している
（[`lib/test.ts`](lib/test.ts)）。

**画像の取得経路はここの射程外である。** 配信元が在るときの挙動は、ここでは確かめられない。

## 何を異常と数えるか

見張りは全ての spec に効く。spec ごとに書かせると、書き忘れた spec だけが「異常があっても緑」に
なり、その状態は結果にも見た目にも現れない。

| 出所 | 数える | 数えない |
| --- | --- | --- |
| console の error | JavaScript が書いた行（React の hydration 不一致はこれ） | ブラウザ自身が書いた行（副資源の取得失敗の narration） |
| 描画中の例外 | すべて | — |
| 通信 | 5xx と transport の失敗 | 打ち切り（`net::ERR_ABORTED`）と 4xx |
| CSP 違反 | すべて（`securitypolicyviolation`） | — |

**4xx を数えないのは、それがアプリの設計された結果だから**である。存在しない資源は 404 を返し、
未認証は 401 を返す。どれも spec が名指しで確かめる対象であり、横断の見張りが一律に落とすと、
確かめたい経路そのものを通せなくなる。5xx と transport の失敗は設計された結果になり得ないので、
個別の spec ではなく見張りが持つ。

**console の見分けに文言を使わない。**文言は描画エンジンごとに違い、増える一方の除外表になる。
代わりに引数を持つかで分ける —— ブラウザ自身が書いた行は引数を持たない。

打ち切りだけは逆に文言で見分ける。Playwright が打ち切りとそれ以外を区別して渡さないためで、
綴りは描画エンジンごとに違う。**取りこぼしたときに出るのは偽陽性（赤くなる）であって見逃しでは
ない**ので、この向きなら文言に頼れる。一覧は回すエンジンに閉じており、際限なく伸びない。

判定は [`lib/browser-errors.ts`](lib/browser-errors.ts) が持つ。

**CSP の違反は console の見張りには掛からない。** ブラウザ自身が書く行なので引数を持たず、上の
規則で外される。document の `securitypolicyviolation` で受け、経路を分けて数える。見張りの外で
書く spec が 1 つだけある —— [`journeys/csp.spec.ts`](journeys/csp.spec.ts) は宣言に無い配信元を
自分で差して違反が報告されることを確かめるため、見張りの内側に置くと確かめた違反で落ちる。

## 同意は選び終えた状態から始める

同意を尋ねる面は、選び終えるまで画面を覆う。
[`lib/test.ts`](lib/test.ts) はこれを**拒否の側で選んだ状態**にしてから spec へ渡す。ジャーニーが
確かめたいのはその先の画面であり、全ての spec が最初に同意を押すことになると、押し忘れた spec
だけが「面に覆われたまま緑」になる。同意ではなく拒否から始めるのは、同意すると計測 id が配られ、
どのジャーニーも本題と関係のない cookie を持つことになるためである。

**この状態は `lib/test.ts` の便宜ではなく、画面を見る spec 全部の前提である。** 別の理由で
`lib/test.ts` を使えない spec は、同じ状態を自分で作る —— [`maintenance/stopped.spec.ts`](maintenance/stopped.spec.ts)
は 503 を意図した応答として確かめるため見張りの内側に置けないが、停止画面も器を通る以上、覆われる
側は同じである。作らないと、面が周囲を `aria-hidden` にするため役割で引く問い合わせが空になる。

**尋ねる面そのものを見る spec だけが、状態を作らない。**
[`journeys/consent.spec.ts`](journeys/consent.spec.ts) は選ぶ前の状態を確かめるので、`lib/test.ts`
ではなく Playwright の `test` を直接使う。CSP の spec と同じ理由で、見張りの内側に置けない側では
なく**前提の内側に置けない**側である。

### タグマネージャを読み込む側は、ここでは通らない

`env/.env.ci` の容器 ID は空である。したがって **`script-src` に配信元を足し
`Cross-Origin-Embedder-Policy` を降ろす分岐は、e2e でも DAST でも一度も踏まれない**。

**CI から Google を叩かせないための選択である。** ここは画像を差し替え API をモックして、外部の
状態で赤くならないようにしてある。実在の容器を撃つ spec を置くと、その原則をこの 1 本だけが破り、
外部の可用性と容器の中身の変更が CI の色に混ざる。

**代わりに担保しているもの**：ヘッダの組み立ては
[`security-headers.test.ts`](../src/config/security-headers/security-headers.test.ts) が両方の配備で
確かめ、読み込みの strategy は
[`analytics.test.tsx`](../src/app/analytics.test.tsx) が固定する。**担保されていないのは、組み立てた
ヘッダが実ブラウザで宣言どおり効くこと**だけである。

**撤去条件**：外部へ出ずに CSP の enforce を確かめる手段が入ったとき（配信元を差し替えられる形の
検査など）。そのときはこの節を消し、容器 ID を宣言した起動を 1 つ足す。

## 帯とエンジンは宣言から引く

**どちらもここに数値や銘柄を書かない。**

- **帯**は [0051](../docs/adr/0051-styling-system.md) §2 が 3 つに固定し、境界の値は design token
  （`tokens/primitives.json`）が持つ。撮るのは**帯の下端** —— `min-width` で切り替わる以上、その帯の
  指定が初めて効く幅であり、崩れるならまずそこで崩れる。モバイルだけは下端を token が持たない
  （下限は [0102](../docs/adr/0102-browser-support.md) が作った側へ委ねている）ので、上端（`md - 1`）を
  撮る。組み立ては [`lib/viewports.ts`](lib/viewports.ts)
- **エンジン**は [0102](../docs/adr/0102-browser-support.md) の「Next.js の既定 browserslist を追認
  （モダンブラウザ）」から引く。モダンブラウザは実装としては 3 つの描画エンジンに畳まれ、
  Playwright の `chromium` / `firefox` / `webkit` がそれぞれに対応する。**見ているのは 3 つだけで、
  ブラウザの銘柄も版も見ていない。**版はイメージが決める。宣言は [`lib/browsers.ts`](lib/browsers.ts)

見た目を撮るのは 1 つのエンジンだけである。同じ画面をエンジンを変えて撮ると必ず差分になり、
「3 通りの正しい絵」を持つことになって退行と描画差の区別が付かない。他の 2 つで見るのは
**見た目ではなく成立**である。

## 何を開くか

開く画面は **build の出力から列挙する**（`.next/app-path-routes-manifest.json`）。一覧を手で持つと、
新しく足した画面が黙って対象外のまま残る。

一方で URL は build の出力からは決まらない。動的区間へ何を入れるか、どの画面が URL では開けないかは
宣言でしか表せないため、**route ごとの宣言を必須にしている**（[`lib/screens.ts`](lib/screens.ts)）。
宣言の無い route が現れたら落ちるので、足した画面は必ず宣言に現れる。実体を失った宣言も落ちる。

外してよいのは**開く手段が無い**画面だけである。「まだ書けていない」は理由にならない。

### URL で決まらないものが絵に出ていれば、そこが食い違いになる

同じ URL には同じ応答が返る（[`mocks/stable-responses.ts`](../mocks/stable-responses.ts)）。動的区間の
ID を宣言で固定しているのはそのためである。**裏を返すと、URL で決まらない値が絵に出ていれば、基準
画像はそれが変わった時点で合わなくなる。**要求時刻から導く値がその代表で、放っておくと撮った日を
過ぎた画面が毎日落ちる。

**ブラウザ側の時計を固定しても届かない。**描いているのはサーバであり、story 単位の側が使う手立て
（[`vrt/lib/clock.ts`](../vrt/lib/clock.ts)）はページの中の `Date` しか差し替えない。手立ては 2 つで、
上から順に当てる。

1. **URL で条件を名指しできるなら、そうする。**それで応答も表示も決まるなら、絵は全面を検証できる
2. **名指しできないなら、値を描く場所を `mask` で撮影から外す**（[`lib/screens.ts`](lib/screens.ts) の
   `Screen.mask`）。**外すのは最小の範囲に留める** —— 広く覆うほど、崩れても気づけない面が増える

利用者が実際に降り立つ状態を撮ることに意味があるなら、1 は使えない。`/admin/analytics` を既定の
「今日」で開いたまま日付の升目だけを外しているのはその判断による。

## 基準画像は story 単位と同じ置き場に入る

置き場（サブモジュール `baseline/images`）は 2 種類の撮影が共有し、画面単位は `screen/` 区画に
閉じる（[`baseline/`](../baseline/README.md)）。共有するのは、掃除も撮り直しも
置き場 1 つに対して働くためで、分けると同じ機構を 2 組持つことになる。

撮り直しの経路も同じである。**`baseline-retake` ラベルは story と画面の両方を撮り直す** —— 置き場も
承認ラベルも 1 つである以上、撮り直しだけを 2 つに分ける理由が無い。範囲の決め方も同じで、E2E が
出したレポート（artifact `e2e-report`）が報告した画面だけを撮り直す。**報告した集合と撮り直す集合を
同じ出所から取る**のは、PR コメントが見せなかった画素が黙って置き場へ入らないようにするためで、
E2E の報告が無い commit では画面を 1 枚も撮り直さない。1 対 1 の対応が落ちたときだけ全数へ倒れる
——孤児は範囲を絞った撮り直しでは消えないため。

撮り直しと承認の関係も story 単位と同じである —— **撮り直しは承認ではない**。詳細は
[vrt/README.md](../vrt/README.md#撮り直しと承認は別の操作)。

## 構成

| パス | 役割 |
| --- | --- |
| [`lib/test.ts`](lib/test.ts) | 全 spec が使う `test`。異常の見張りと、ログイン済みの状態を作る手立て |
| [`lib/browser-errors.ts`](lib/browser-errors.ts) | 何を異常と数えるかの判定 |
| [`lib/browsers.ts`](lib/browsers.ts) | 回す描画エンジンと、見た目を撮るエンジンの宣言 |
| [`lib/viewports.ts`](lib/viewports.ts) | design token から帯を組み立てる |
| [`lib/screens.ts`](lib/screens.ts) | build の出力と宣言を突き合わせ、開く画面を決める |
| [`lib/screen-baselines.ts`](lib/screen-baselines.ts) | 画面と帯から、在るべき基準画像のパスを組み立てる |
| `journeys/` | ジャーニー・帯ごとの出し分け・CSP の enforce・同意の面。3 つのエンジンで回る |
| `visual/` | 画面単位の比較。1 つのエンジンで、帯の数だけ回る |
| `maintenance/` | 配信を止めた状態の成立。**別の起動で回る**（下記） |
| [`../playwright.e2e.config.ts`](../playwright.e2e.config.ts) | 実行環境と比較条件 |
| [`../.makefiles/testing/e2e.mk`](../.makefiles/testing/e2e.mk) | build・起動・後片付け。画面ごとの Core Web Vitals（`make lighthouse`）も同じ起動に相乗りする |

## spec が指す経路は、実在する route でなければならない

spec は開く先を文字列で書くので、**指す先が消えても型検査には掛からない**。実物で落ちるのは
E2E だが、E2E は費用のため PR ごとには回らない（`.github/workflows/e2e.yaml`）。
[`scripts/e2e-routes.gate.test.ts`](../scripts/e2e-routes.gate.test.ts) が、`*.spec.ts` の中の経路を
`src/app` の実在する route と突き合わせてこの隙間を埋める。

実在しないことが**意図**である経路（保護の判定が接頭辞だけで決まることを見る `/account`、
経路の有無に関わらず差し替わることを見る `/help`）は、理由を添えてそのゲートへ宣言する。
「まだ画面が無い」は理由にならない。どの spec も指さなくなった宣言と、画面が置かれて実在する
ようになった宣言は、どちらもゲートが落とす。

`lib/` の宣言はこのゲートの対象ではない。あちらは build の出力と突き合わせる判定を自分で持ち、
宣言の無い route も実体の無い宣言もそこで落ちる（[`lib/screens.ts`](lib/screens.ts)）。

<!-- sample:begin -->
## 同梱サンプルを破棄すると何が消えるか

**消えるのは、確かめる相手が題材と一緒に居なくなる spec だけである。**該当するのは 4 本で、
いずれも `journeys/` に居る。

| spec | 消える理由 |
| --- | --- |
| `journeys/browse` | 通す遷移そのものが題材の画面である |
| `journeys/responsive` | 残る画面に脇へ常設する領域が無い。帯そのものの組み立て（[`lib/viewports.ts`](lib/viewports.ts)）は残るので、そういう画面を置いた時点で書き足せる |
| `journeys/overlay` | 被せた面と履歴が競合する画面が残らない |
| `journeys/focus` | ドロワー・モーダル・メニューを持つ画面が残らない |

**残る spec は、残る画面しか指してはならない。**機構を見る spec（同意・CSP・別 origin・公開面・
認証の前捌き）はどれも題材を要求していないので、入口（`/`）・停止画面・ログインのいずれかを
指す。破棄した木でこれが守られているかは、上のゲートが `purge-verify` の中で見る。

**入口（`/`）は破棄後も残る。**題材の画面が占めているので削除の対象だが、破棄の最後に動作確認用の
最小ページが置き直される（`scripts/setup/remove-sample/sample-manifest.ts` の
`SAMPLE_RESTORATIONS`）。不在の面から戻る導線・役割の足りない要求の戻り先・サイトマップが挙げる
公開経路が、いずれもこの経路を指しているためである。
<!-- sample:end -->

`tmp/e2e/` に出る実行結果（trace / HTML レポート / サーバのログ）は追跡しない。

## 関連する ADR

- [0021](../docs/adr/0021-frontend-responsibility.md) — アプリ側の宣言を写すときに越えている境界
- [0028](../docs/adr/0028-naming-convention.md) — 画面の名前に許す綴り
- [0043](../docs/adr/0043-middleware-policy.md) — 認証の前捌きが立つ位置
- [0051](../docs/adr/0051-styling-system.md) — 帯の段数と、動きを止めて撮る根拠
- [0053](../docs/adr/0053-ui-component-interaction-seam.md) — 被せた面の焦点と履歴
- [0073](../docs/adr/0073-pagination-fetch-boundary.md) — 読み進めた件数が URL へ出ること
- [0079](../docs/adr/0079-auth-frontend-seam.md) — 認証の front 側の受け持ち
- [0090](../docs/adr/0090-testing-strategy.md) — 層別責務と、相手をモックに固定する理由
- [0091](../docs/adr/0091-test-verification-methods.md) — 実ブラウザでしか負えない観点
- [0100](../docs/adr/0100-accessibility-target.md) — 適合目標（WCAG 2.x レベル AA）
- [0102](../docs/adr/0102-browser-support.md) — 回す描画エンジンの引き出し元
- [0111](../docs/adr/0111-csp-security-headers.md) — CSP の enforce と別 origin の前捌き
- [0131](../docs/adr/0131-cookie-consent.md) — 同意を尋ねる面の扱い
- [0153](../docs/adr/0153-ci-configuration.md) — 公開の面へ出す文字集合
