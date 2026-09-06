/**
 * 検査対象から外すモジュールの宣言。
 *
 * @remarks
 * カバレッジの母数と 1:1 ゲートは、同じ理由で同じモジュールを外します。宣言をここ 1 箇所に
 * 置くのは、2 箇所に書くと片方だけを直したときに黙ってずれるためです。ずれる向きは
 * 「カバレッジからは外れているのにゲートは要求する」(開発が止まる)か、「ゲートからは
 * 外れているのにカバレッジは要求する」(検査されない判定が増える)のどちらかで、後者は
 * 気づかれないまま進みます。
 *
 * パターンはリポジトリルート相対で、`*` は区切りを跨がない任意文字、末尾 `/**` は
 * ディレクトリ接頭辞として扱います。vitest のカバレッジ除外もこの配列をそのまま読みます。
 */

/**
 * 入口ファイル。CLI 引数の受け取り・外との遣り取り・終了コードを担い、**それ無しでも下せる
 * 判定は同じディレクトリの判定モジュールへ切り出してある。**
 *
 * @remarks
 * **線を引くのは「遣り取りをせずに答えを出せるか」で、分量でも分岐の数でもありません。**
 * 子プロセスの結果やソケットの応答から次を決める形は、純粋にしても「差し替えたものを呼んだ」
 * しか確かめられないので入口に残します。
 *
 * 撤去条件は、遣り取り無しで下せる判定が生えた時点。隣の判定モジュールへ移す。
 */
export const ENTRYPOINT_PATTERNS = [
  "scripts/*/index.ts",
  "scripts/setup/*/index.ts",
  // portal と openapi は 1 ディレクトリに入口が複数あるツール群で、`index.ts` へ畳めない。
  "scripts/portal/gen-*.ts",
  "scripts/portal/build-site.ts",
  "scripts/openapi/fetch-api.ts",
  "scripts/openapi/gen-api.ts",
  "scripts/openapi/check-generated.ts",
  "scripts/openapi/extract-limits.ts",
  "scripts/lighthouse/diagnose.ts",
] as const;

/**
 * 契約から生成されるモジュール。
 *
 * @remarks
 * 書き手が居ないコードにテストを課しても、検証しているのは生成器であって本リポジトリの
 * 判断ではありません([0072](../../docs/adr/0072-api-type-generation.md))。生成物の正しさは
 * 契約からの再生成が一致するか(drift ゲート)と、`mocks/contract-conformance.test.ts` の
 * 全ハンドラ検査が担保します。
 *
 * 並ぶのは題材の契約から生成したものだけなので、サンプルを破棄すると空になります。fork 先は
 * 自分の契約を生成した先をここへ並べます。
 */
// sample:replace-begin
export const GENERATED_MODULES = ["src/adapters/gen/**", "mocks/api/**"] as const;
// sample:replace-with
// = export const GENERATED_MODULES = [] as const;
// sample:replace-end

/**
 * 判定を持たないモジュール。
 *
 * - `scripts/setup/lib/runtime.ts` — リポジトリルートの解決と共通フラグ（`--dry-run` / `--help`）の解析だけ。
 * - `src/app/fonts.ts` — `next/font` の呼び出しと、返った変数名を連結するだけ。分岐を持たず、
 *   単体で回しても `next/font` の mock が返した値をそのまま読むことにしかならない。変数が
 *   `<html>` へ届くことは `layout.test.tsx` が見ている。
 * - `src/app/icon.tsx` / `apple-icon.tsx` / `opengraph-image.tsx` — `ImageResponse` へ 1 枚の
 *   絵を渡すだけ。分岐を持たず、単体で回しても渡した JSX をラスタライザが受け取ったことしか
 *   確かめられない。絵として返ることは `make e2e-metadata` が起動したアプリから取って見ている
 *   （`e2e/metadata/`）。
 * - `src/components/icon.ts` — 供給元のアイコンを名前を付け替えて再輸出するだけ。分岐も式も持たず、
 *   回しても「再輸出したものが再輸出されている」しか確かめられない。名前が実在することは型検査が、
 *   使っていないものが束へ乗らないことは `pnpm bundle-budget` の予算が見ている。
 * - `src/model/generated/design-token.ts` — トークン名の一覧を並べた生成物。分岐も式も持たず、
 *   読み手はカタログの story だけで、値そのものは表示する側が実行時に CSS から読む。名前が
 *   SSOT と一致することは `check:tokens` の再生成比較が見ている。
 * - `docs-viewer/src/main.tsx` — ビューアーの entry。読み込まれた時点で DOM を触るため、
 *   判断はすべて `mount/` 側に置いてある。
 * - `vrt/lib/settle.ts` — Playwright の Page が描き切るのを待ち、スクロールを先頭へ戻すだけ。
 *   分岐を持たず、Vitest からは呼べない。撮影と a11y 検査が同じ待ち方をする必要があるため
 *   spec から切り出してあるだけで、判断は持たない。
 * - `e2e/lib/test.ts` — Playwright の Page へ購読を張り、fixture を組み立てるだけ。何を異常と
 *   数えるかは `e2e/lib/browser-errors.ts` が持つ。全 spec へ同じ見張りを効かせるため spec から
 *   切り出してあるだけで、Vitest からは呼べない。
 * - `.storybook/main.ts` / `preview.tsx` / `manager.ts` — カタログの設定。読み込まれた時点で
 *   副作用を起こす（資材の複製・書体の class 付与・mock の宣言）ため単体では回せない。**判定は
 *   `lib/` へ置く**という規約を `.storybook/README.md` が持ち、ここに残るのは設定だけである。
 * - `.storybook/lib/sample-asset.ts` — カタログへ配る資材の URL を並べた表。分岐も式も持たず、
 *   読み手は story だけである。綴りと実体のずれは、資材が 404 になった絵として VRT が示す。
 * - `.storybook/css.d.ts` — 型宣言のみ。
 * - `.storybook/msw/worker.ts` — ブラウザの service worker を立てるだけ。何を警告と数えるかは
 *   `.storybook/lib/unhandled-request.ts` が持つ。Vitest からは呼べない。
 */
const NON_DECIDING_MODULES = [
  "scripts/setup/lib/runtime.ts",
  "src/app/fonts.ts",
  "src/app/icon.tsx",
  "src/app/apple-icon.tsx",
  "src/app/opengraph-image.tsx",
  "src/components/icon.ts",
  "src/model/generated/design-token.ts",
  "docs-viewer/src/main.tsx",
  "vrt/lib/settle.ts",
  "e2e/lib/test.ts",
  ".storybook/main.ts",
  ".storybook/preview.tsx",
  ".storybook/manager.ts",
  ".storybook/lib/sample-asset.ts",
  ".storybook/css.d.ts",
  ".storybook/msw/worker.ts",
] as const;

/**
 * テスト専用の組み立て。
 *
 * @remarks
 * 判定を持たず、検証を通る入力一式を用意するだけ。テストが自分の分だけを組み立てると、
 * 他の purpose の欠落で落ちて検査したい判定へ到達しないため 1 箇所に置いてあります。
 *
 * `account.fixture.ts` は story とテストの双方が読みます。都道府県の 47 件のように、
 * 実物どおりの件数でなければ器の幅を確かめられない入力があるためです。
 *
 * `experimental-react.fixture.ts` が返すのは Next.js 同梱の experimental React の位置です。本番は
 * Next.js が `react` の解決先を差し替えるため、この位置を綴るのはテストだけです
 * （[0030](../../docs/adr/0030-environment-variable-management.md) §8）。
 */
const TEST_FIXTURE_MODULES = [
  "src/config/environment.fixture.ts",
  "src/adapters/server/taint/experimental-react.fixture.ts",
  "src/features/account/account.fixture.ts", // sample:line
  "src/features/cart/cart.fixture.ts", // sample:line
  "src/features/checkout/checkout.fixture.ts", // sample:line
] as const;

/**
 * カタログ専用の差し替え。
 *
 * @remarks
 * server の無いカタログで、押せる操作を押しても壊れない状態にするためだけの module です
 * ([0054](../../docs/adr/0054-ui-catalog-storybook.md))。判定は持たず、隣にある本物の
 * Server Action がテストの対象です。
 *
 * `.storybook/msw/handlers.ts` も同じ genre で、カタログが自分で答える `/api/*` の据え置きです。
 * 郵便番号ごとの出し分けは題材そのもの（`sample:replace` で fork 時に空へ置き換わる）で、
 * 固定しても確かめられるのは並べた fixture が並べたとおりであることだけです。返す形が正しいことは
 * `adapters/client` の検証が担います。
 */
const CATALOG_MOCK_MODULES = [
  ".storybook/msw/handlers.ts",
  "src/features/account/__mocks__/**", // sample:line
  "src/features/cart/__mocks__/**", // sample:line
  "src/features/cart/facade/add-to-cart/__mocks__/**", // sample:line
  "src/features/checkout/__mocks__/**", // sample:line
] as const;

/**
 * 単体では回せないモジュール。
 *
 * @remarks
 * route segment は `params` / `searchParams` が Promise である App Router の規約と生成型に依存し、
 * 検証は route の経路ごと通す必要があります([0091](../../docs/adr/0091-test-verification-methods.md))。
 * 通す先は `e2e/` で、開く画面は build の出力から列挙されるため、足した route は宣言を求められます
 * （`e2e/lib/screens.ts`）。ここから外れるのは、route segment が単体で回せるようになったときです。
 *
 * feature 側の `page-content.tsx` はここに含めません。取得を `adapters` の module 境界で
 * 差し替えれば `render(await Component(props))` で検証できるためです。
 *
 * `page.dev.tsx` は開発と CI の build にしか含まれない route segment です（`next.config.ts` の
 * `pageExtensions`）。単体で回せない理由は `page.tsx` と同じで、含まれる build が違うだけです。
 */
const RUNTIME_ONLY_MODULES = ["src/app/**/page.tsx", "src/app/**/page.dev.tsx"] as const;

/**
 * それ自体がテストであるモジュール。
 *
 * @remarks
 * `vrt/*.spec.ts` と `e2e/**\/*.spec.ts` は Playwright が実行する本体で、Vitest からは
 * 呼ばれません。テストにテストを課す形になるため母数から外し、代わりに判定を持つ部分を
 * `vrt/lib/` / `e2e/lib/` へ切り出して 1:1 の対象にしています。
 */
const TEST_SUITE_MODULES = ["vrt/*.spec.ts", "e2e/**/*.spec.ts"] as const;

/**
 * 主語を持たないテストファイルの宣言。
 *
 * @remarks
 * 1:1 ゲートはソース側から歩くため、対応する production ファイルが無いテストファイルには
 * 入口が無く、放っておくと検査へ一度も掛かりません。ここへ並ぶものだけがそれを許されます。
 *
 * - `**\/*.contract.test.ts` — 契約から生成したハンドラを相手にする検査。相手は生成物であって
 *   production のモジュールではなく、確かめるのは「生成ハンドラの応答が adapter を通るか」。
 *   最上位 describe は隣の adapter の export 名を採る
 * - `scripts/*.gate.test.ts` — 開発機構そのもののゲート。subject はリポジトリ全体で、
 *   判定は隣の `lib/` が持つ。describe はゲートが名乗る規則の名前を採る
 * - `mocks/contract-conformance.test.ts` — 生成ハンドラ全件が契約に適合するかの検査。
 *   同じく相手が生成物で、production のモジュールに対応先が無い
 *
 * ここから外れるのは、そのテストが production のモジュールを主語に持ち直したとき。
 */
export const SUBJECTLESS_TESTS = [
  "**/*.contract.test.ts",
  "scripts/*.gate.test.ts",
  "mocks/contract-conformance.test.ts",
] as const;

/** カバレッジ母数と 1:1 ゲートの双方が外す対象(リポジトリルート相対)。 */
export const EXCLUDED_FROM_CHECKS = [
  ...ENTRYPOINT_PATTERNS,
  ...GENERATED_MODULES,
  ...NON_DECIDING_MODULES,
  ...TEST_FIXTURE_MODULES,
  ...CATALOG_MOCK_MODULES,
  ...RUNTIME_ONLY_MODULES,
  ...TEST_SUITE_MODULES,
] as const;
