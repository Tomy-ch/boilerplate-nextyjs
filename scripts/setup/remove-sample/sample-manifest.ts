// 破棄する対象の宣言。ここはデータだけを持ち、消し方の判定は plan.ts、実行は index.ts が担う。
//
// 宣言を 1 箇所に集めるのは、削除と検証が同じ表を読む必要があるためである。片方が独自の
// 一覧を持つと、消したのに検証が知らない対象や、検証だけが要求する対象が生まれる。

/**
 * まるごと消すパス（リポジトリルート相対）。ディレクトリは配下ごと消す。
 *
 * @remarks
 * サンプルは EC の題材を持つ画面群と、その題材に固有のカーネルモジュール・契約・モックで
 * 構成されます。**外から参照されていないことを前提に自己完結した集合**にしてあり、ここに
 * 挙げていないものへの参照が残ると削除後の build が落ちます。
 *
 * 契約（`openapi/*.gen.yaml`）と生成物（`src/adapters/gen`）も対象です。どちらもサンプルの
 * バックエンドから取り込んだもので、テンプレートから作った側は自分の契約を置いて生成し直します。
 * 生成物を残すと、題材の型が大量に残って「消してよいのか」の判断を作った側に負わせます。
 *
 * 破棄の道具そのものも対象です。**ディレクトリごと挙げる**のは、判定モジュールを足したときに
 * 列挙から漏れ、消えたはずの道具の一部だけが作った側へ居座るのを防ぐためです。
 *
 * `baseline/images` はサブモジュールなので、ここからは中身を消せません。題材の基準画像は
 * 作った側が `make setup-baseline-store` で自分の置き場へ張り替えた時点で参照が切れます
 * （[vrt/README.md](../../../vrt/README.md)）。
 */
export const SAMPLE_PATHS: readonly string[] = [
  // 画面
  "src/app/(shop)",
  "src/app/(site-info)",
  "src/app/admin",
  // 2 つの器が読む global nav。行き先が題材の画面なので、器と一緒に消える。
  "src/app/global-nav.ts",
  "src/app/global-nav.test.ts",
  // 認証の器（`src/app/(auth)`）はコア残留で、その配下の登録だけが題材の画面である。
  "src/app/(auth)/onboarding",
  "src/features/products",
  "src/features/cart",
  "src/features/checkout",
  "src/features/purchases",
  "src/features/home",
  "src/features/account",
  "src/features/site-info",
  "src/features/admin",
  // 題材の取得を中継する BFF。`src/app/api` ごとではなく題材の口だけを挙げる。
  // 認証の口（`src/app/api/auth`）は同じ場所にあるコア残留である。
  "src/app/api/products",
  "src/app/api/addresses",
  "src/app/api/purchases",
  // 題材に固有のカーネルモジュール
  "src/model/cart",
  "src/model/dashboard",
  "src/model/product",
  "src/model/purchase",
  "src/model/user",
  "src/stores/cart-store.ts",
  "src/stores/cart-store.test.ts",
  // 題材の契約に固有の adapter
  "src/adapters/server/api",
  "src/adapters/client/api",
  // 契約と生成物
  "src/adapters/gen",
  "openapi/api.gen.yaml",
  // 契約から生成したモック
  "mocks/api",
  "mocks/contract-conformance.test.ts",
  "mocks/handlers.test.ts",
  // 口をまたいで指し合う項目の表。契約ごとの知識なので、整合を取る機構（`stable-responses.ts`）
  // とは別に置いてある。
  "mocks/references.ts",
  "mocks/references.test.ts",
  // 題材の画面の一覧。全 24 画面と API の対応表で、中身は題材そのものである。
  // 画面ごとの約束は `docs/spec/route/**` が持ち、契約は `openapi/api.gen.yaml` が持つので、
  // ここは索引であって正ではない。題材と一緒に消える。
  "docs/spec/screens.md",
  // 題材の画面の仕様書。実装と 1 対 1 で対応するため、画面が消えれば仕様書も消える。
  // 残るのは `docs/spec/README.md` と、コア残留の画面（`auth` の器 / `/login` / `/dev/session`）の分。
  "docs/spec/route/shop",
  "docs/spec/route/site-info",
  "docs/spec/route/admin",
  "docs/spec/route/auth/onboarding",
  // 題材の画面を通す E2E。土台（`e2e/lib` / `e2e/visual`）と、題材に依らない認証の前捌きは残す。
  // 焦点の spec も題材側である —— 見ているのは機構だが、確かめる相手（ドロワー・モーダル・
  // メニュー）を持つ画面が残る木に 1 枚も無い。観点は `e2e/README.md` の表が引き継ぐ。
  "e2e/journeys/browse.spec.ts",
  "e2e/journeys/responsive.spec.ts",
  "e2e/journeys/overlay.spec.ts",
  "e2e/journeys/focus.spec.ts",
  // 破棄の道具（使い終わったら不要）。ディレクトリごと挙げれば、判定モジュールを足しても漏れない。
  "scripts/setup/remove-sample",
];

// verify 自身は検証の後に自分で消える（`selfDestructTargets`）。ここへ登録すると、検証の前に
// 消えて検証そのものが走らない。

/** 破棄後に置き直すファイル 1 つ。`from` の内容を `to` へ書く。 */
export type SampleRestoration = {
  /** 中身の出所。**削除対象の内側に置く** —— 置き直したあとにテンプレートから作った側が持ち続ける理由が無い。 */
  readonly from: string;
  /** 書き出す先（リポジトリルート相対）。削除対象の内側は指せない。 */
  readonly to: string;
};

/**
 * 破棄後に置き直すファイル。
 *
 * @remarks
 * **削除だけでは表せない対象がここに来ます。** 入口（`/`）は題材の画面が占めているので削除の
 * 対象ですが、経路そのものは残らなければなりません。**何がその経路を指しているか**は、置き直す
 * 雛形（`templates/app-page.tsx.template`）が持ちます —— 破棄後に残るのはそちらで、理由を必要と
 * するのもテンプレートから作った側だからです。
 *
 * 置き直すのは**動作確認用の最小ページ**で、画面実装で置き換わる足場です
 * （[計画](../../../docs/plan/v1-implementation-plan.md) §3.12）。破棄は画面実装の逆操作なので、
 * 足場へ戻すのが元の状態です。
 *
 * 雛形を `.template` で持つのは、**残る木の route になってはいけない**ためです。`src/app` へ
 * 置けば `/` が 2 つになって build が落ち、`.tsx` として `scripts/` へ置けば、どこからも
 * import されない module が残ります。中身の妥当性は `purge-verify` が破棄後の木へ `typecheck`
 * と `build` を掛けて確かめます。
 */
export const SAMPLE_RESTORATIONS: readonly SampleRestoration[] = [
  {
    from: "scripts/setup/remove-sample/templates/app-page.tsx.template",
    to: "src/app/page.tsx",
  },
];

/**
 * 破棄後に実装へ残っていてはいけない題材の語彙。
 *
 * @remarks
 * 検証側はこれをスナップショット経由で受け取ります。**検証は削除の後に走り、その時点でこの
 * モジュールは消えている**ため、import では渡せません。宣言をここに置くのは、破棄する対象と
 * 残留を探す語彙が同じ表から出る必要があるからです。
 *
 * 英語の語には語境界を付けます。付けないと別語の一部に当たります（`CartesianGrid` が `cart` に
 * 一致し、題材と無関係な部品が消し残しとして報告されます）。
 */
export const DANGLING_PATTERN = String.raw`商品|カート|在庫|購入|注文|\bproducts\b|\bcart\b`;

/** マーカーの名前。`sample:begin` / `sample:end` / `sample:line` / `sample:replace-*` を作る。 */
export const SAMPLE_MARKER = "sample";

/**
 * 走査から外すディレクトリ名。
 *
 * @remarks
 * 依存の取得物と VCS の内部、および生成物です。除去しても再生成で戻るものへ書き込むと、
 * 次の生成で消えるうえ drift ゲートが落ちます。
 */
export const EXCLUDED_DIRECTORIES: Set<string> = new Set([
  ".git",
  "node_modules",
  "dist",
  "coverage",
  ".next",
  "storybook-static",
]);

/**
 * 走査から外す相対パス接頭辞。生成物・作業用の置き場と、マーカーの形をデータとして持つ区画。
 *
 * @remarks
 * マーカー行のベースライン（`scripts/marker-baseline/`）をファイル単位ではなく接頭辞で外すのは、
 * あの区画を boilerplate 限定節の剥がしが**丸ごと消す**からです。`MARKER_LITERAL_FILES` へ並べると、
 * 剥がしだけを走らせた木で「宣言したファイルが実在しない」になります。
 */
export const EXCLUDED_PATH_PREFIXES: readonly string[] = [
  ".storybook/public/",
  "docs/portal/guides/",
  "graphify-out/",
  "scripts/marker-baseline/",
  "tmp/",
  "src/app/generated/",
  "src/model/generated/",
];

/**
 * マーカーを持てない拡張子。
 *
 * @remarks
 * コメントを書けない形式なので、マーカーの対象になり得ません。削除の対象にはなりますが、走査では
 * 読み込む前に外します。読んでから「テキストではなかった」と判る形にすると、実行のたびに意味の
 * ない警告が出ます。
 */
export const BINARY_EXTENSIONS: readonly string[] = [
  ".ico",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".avif",
  ".woff",
  ".woff2",
  ".ttf",
  ".otf",
  ".pdf",
  ".zip",
];

/**
 * マーカー文字列を「データ・散文」として持つファイル。走査の対象から外す。
 *
 * @remarks
 * 除去はリポジトリを走査します。対象ファイルの一覧を持たないのは、**一覧の外側にマーカーを
 * 書けてしまい、しかもその取りこぼしが無言だから**です。代わりに要るのがこの逆向きの宣言です。
 *
 * 非対称なのは、こちらの取りこぼしが**声を出す**点です。ただし声が出るのは**対応の取れていない
 * マーカーを持つ場合**に限ります。閉じたペアを散文が持っていると、その区間は例外を出さずに消え、
 * 文章が欠けただけでは検査を通ります。除去した行数を実行時に出しているのは、その場合に人が
 * 気づけるようにするためです。
 */
export const MARKER_LITERAL_FILES: readonly string[] = [
  // マーカー除去そのもののテスト。入力としてマーカーの形を持つ。
  "scripts/setup/lib/markers.test.ts",
  // マーカーの名前と形を宣言・説明している当ファイル自身。
  "scripts/setup/remove-sample/sample-manifest.ts",
  // 破棄の手順を説明する散文。マーカーの書き方をそのまま載せている。
  "docs/plan/v1-implementation-plan.md",
  // 前提の検査が剥がし後の本文を読むことのテスト。入力としてマーカーの形を持つ。
  "scripts/premise-lint/scan.test.ts",
];
