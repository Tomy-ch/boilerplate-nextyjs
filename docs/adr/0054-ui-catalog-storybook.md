# UI カタログ(Storybook)方針

コンポーネントの視覚的仕様の置き場として **UI カタログ(Storybook)を採用**する。これは機能 seam ではなく **開発ツール選択** であり、テスト検証手段([0091](0091-test-verification-methods.md))とは別主題として本 ADR が所有する。

## Status

Accepted

## 背景

[0141](0141-portal-operations.md) の portal はドキュメント portal であって UI カタログではないため、コンポーネントの視覚的仕様・使い方・状態バリエーションを並べて見る置き場が別に要る。`components` カーネルの層別 README は責務と設計意図を叙述するが、見た目と操作を canvas 上で確かめる面は持てない。本 ADR はその面を Storybook に置き、README との役割分担・story の置き場・server の無い面での外部の口の扱いを定める。

## 決定

- **UI カタログとして Storybook を boilerplate 本体に採用する**。コンポーネントの視覚的仕様・使い方・状態バリエーションのカタログ置き場を Storybook が担う
- **カタログ性は Storybook を第一の担保とし、`components` カーネルの層別 README([0021](0021-frontend-responsibility.md) per-package README / [0141](0141-portal-operations.md) portal)の叙述と併走**させる。README は責務・設計意図の叙述、Storybook は視覚的仕様・インタラクションのカタログという役割分担で、ドキュメント portal(0141)と UI カタログを混同しない
- **Storybook を部品の唯一の在庫リストとする。** 全画面を並べて見る場が他に無いため、一貫性は「story を持たない部品が存在しない」ことで担保する。story を持たない component を新規に作らない(feature 配下も同じ)
- **`.stories.*` ファイルは対象コンポーネントに co-locate する**([0027](0027-directory-structure.md) の co-location に story ファイルを乗せる)
- Storybook 本体および addon の依存追加は **exact pin + `pnpm audit`**([0004](0004-library-management.md))。CI 上のビルド組込は [0153](0153-ci-configuration.md) が持つ(本 ADR では二重に決めない)
- **story は「そのコンポーネントが何のためにあるか」を、開いた canvas から読める形で示す。** default 1 本で終えず、その部品自身が表現する状態(variant / disabled / invalid / 開いた状態など)へ canvas 上で到達できるようにする。**story 名が約束した状態に canvas が届いていないものはカタログとして成立していない**
  - **hover でだけ現れる面は、play で focus まで進めて開く。** 撮影は pointer を持たないため、hover に任せた面は開いた姿が基準画像に一度も写らない。focus で同じ面が開くことは a11y 契約([0053](0053-ui-component-interaction-seam.md))が要求しており、play はその経路を使う
- **画面固有の業務語彙・API・route を story に埋め込まない。** カタログは boilerplate を利用する人が参照する中立な面であり、業務文脈を伴う実例は feature 側の story か画面実装に置く
- **story の表示分類は実装の配置や依存方向を決めない。** 分類は閲覧のためのものであり、`title` の具体的な体系は `components/README.md` が所有する(本 ADR では固定しない)。ただし**画面まるごとの story は feature を跨いで合成してよい**([0021](0021-frontend-responsibility.md) の昇格ルールの例外)。これは分類が依存を決めるのではなく、確認専用の面に限って製品コードと別の権限を与える判断である
- **画面まるごとの story は route と同じ器で包む。** その route の layout が置く shell と、page が置く見出し・階層・読み幅を story 側で再現する。再現しないと余白と重心が実物とずれ、画面がどう収まるかを取得なしで確かめるというこの story の目的を果たせない
  - **再現に含めるのは layout / page が置くものだけではない。** 本文の取り分を変える常設領域(脇に開く panel など)の開閉と、`Suspense` の殻の側に居て view の外にある節も含める。前者は開閉で本文の幅が変わり、後者は枠に置かないと段の見え方が実物とずれる
  - **story のための種まきが立てた副作用は、その場で畳む。** 初期状態を作るために store へ値を入れると、実際の操作と同じ通知や要求が立つことがある。種まきは初期状態の再現であって利用者の追加操作ではないので、それらは畳んでから描く
- **story ごとに違う値を要る器は、decorator ではなく component として組む。** decorator は `parameters` 経由でしか値を受けられず、効いている条件が型を失う。component なら条件を story の args として型のまま扱える
- **a11y の自動検査を Storybook に載せる。** story 全数へ検査を効かせ、違反ゼロを取り込みの完了条件に含める([0100](0100-accessibility-target.md) の自動検査手段の 1 つ)。検査の実体は **visual regression と同じコンテナで走る axe**([0091](0091-test-verification-methods.md) §2)で、`addon-a11y` は対話パネルとして手元の確認に使う

## 1 部品あたりの主題

**story は主題で数え、1 部品あたり 15 主題を上限の原則とする。** 主題とは確認したい 1 つの状態であり、同じ主題を帯ごとに分けたもの(PC / タブレット / スマホ)は 1 主題と数える。

上限は網羅を諦めるための数ではなく、**カタログを一度に見渡せる範囲に保つ**ための数である。超える必要がある画面(状態の組み合わせが本質的に多いもの)は、**アーキテクトまたはテックリードの確認を得て超えてよい**。確認なしに増やさない。

## server の無い面で外部の口を差し替える

カタログに server は無い。**押せる操作を置きながら、押すと壊れる状態のままにしない。** 差し替えの口は 2 つあり、相手が何であるかで決まる。

**差し替えるのは外部の口だけで、主題そのものは差し替えない。** 入力欄の配線や補完を偽物にすると、label と control の対応まで偽物になり、確かめたいものも a11y 検査の対象も無くなる。

### Server Action — モジュールごと差し替える

- 差し替えの**宣言は `.storybook/preview.tsx`** に置く。抽出はこのファイルだけを読むため、他所へ書いても効かない
- **パスは拡張子まで書く。** 省くと解決に失敗し、宣言はしているのに 1 件も登録されないまま進む(失敗は表に出ない)
- 差し替えの**実体は対象の隣の `__mocks__/`** に置く([0027](0027-directory-structure.md) が置き場の例外を持つ)。実体を持たない自動差し替えは元のモジュールの import をそのまま残すため、`adapters/server` と `config` がブラウザで読まれる状態が消えない
- 既定の戻り値は**成功**とする。失敗の見え方を出す story は `mocked()` で戻り値を差し替える
- **送信を起こさない口も解決済みで返す。** 押した先で何も起きないことを、待ち続けない形で示す(永久 pending にしない)
- **submit を持つ部品の story は、`action` を持つ `form` で包む。** `action` の無い `form` の submit は現在 URL への GET になり、押した瞬間にカタログごと読み込み直される。送信先は実物でも器が配るので、story でも器が配る
- カタログのために**本番コードへ口を足さない**(Server Action を props で受け取る形へ変える等。[0090](0090-testing-strategy.md) の禁止事項と同じ線)

### Route Handler — 同一オリジンの `/api/*` を横取りする

- ブラウザ側の interception をカタログに立て、`/api/*` の応答をカタログ自身が返す
- ハンドラは**契約から生成したモックの置き場へ混ぜない。** `/api/*` が返すのは Route Handler が組み立てた表示用の形であり、契約からは生成できない。あちらの「置いてあるのは生成物だけ」という前提を崩さないよう、カタログの手書きは `.storybook/` に置く
- **story の中で `fetch` を差し替えない。** 差し替えると、部品が通るはずの経路(応答の検証・失敗の分岐)がカタログでは通らなくなる
- 横取りに要する資材は**追跡しない**。カタログの設定が依存の持つ実体から置き直し、配信もアプリの `public/` と分ける(本番の配信物に検証用の資材を混ぜない)。置き直しを起動コマンドではなく設定に持たせるのは、道具を直接叩いた起動でも同じ前提が揃うようにするため

## 禁止事項

- ❌ Storybook を「機能 seam」として扱い、アプリ本体のランタイム経路や機能フラグに結合させること(あくまで開発ツール = カタログである)
- ❌ ドキュメント portal([0141](0141-portal-operations.md))と UI カタログ(Storybook)の役割を混同し、叙述ドキュメントを Storybook へ、視覚カタログを portal へ二重化すること
- ❌ `.stories.*` を co-location 外(集約ディレクトリ等)に散在させること([0027](0027-directory-structure.md) co-location に従う)
- ❌ story を持たない component を新規に作ること(Storybook が唯一の在庫リスト)
- ❌ Storybook / addon 依存を exact pin / `pnpm audit` なしに追加すること([0004](0004-library-management.md))
- ❌ story の中で `fetch` を差し替えて応答を作ること(部品が通る経路を迂回する)
- ❌ 契約から生成したモックの置き場へ、手書きのハンドラを足すこと
- ❌ カタログのためだけの口を本番コードへ足すこと
- ❌ Storybook のバージョン固定方針・CI ビルド組込を本 ADR で確定すること([0004](0004-library-management.md) / [0153](0153-ci-configuration.md) が所有。二重決定しない)

## 補足

- Storybook の具体的な設定(builder / framework 統合)は本 ADR の射程外である。visual regression の運用は [0091](0091-test-verification-methods.md) が所有し、Storybook 採用がそれを決めるものではない
- 本 ADR は機能 seam でない開発ツール選択であり、[0090](0090-testing-strategy.md) のテスト層(unit / component / integration / e2e)とは独立である。テスト検証手段の確定は [0091](0091-test-verification-methods.md) が所有する

## 関連 ADR

- [0091-test-verification-methods.md](0091-test-verification-methods.md) — テスト検証手段(async RSC の寄せ先 / a11y 自動テスト / visual regression)
- [0141-portal-operations.md](0141-portal-operations.md) — ドキュメント portal(UI カタログではない)。Storybook と役割分担
- [0021-frontend-responsibility.md](0021-frontend-responsibility.md) — per-package README(カタログ性の併走供給元)
- [0027-directory-structure.md](0027-directory-structure.md) — co-location(`.stories.*` の配置先)
- [0004-library-management.md](0004-library-management.md) — Storybook / addon 依存の exact pin / audit
- [0153-ci-configuration.md](0153-ci-configuration.md) — Storybook のビルド CI 組込の所有先
