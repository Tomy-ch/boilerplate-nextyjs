/**
 * 層構造の宣言。依存マトリクスの単一の正であり、ESLint の境界検査（`eslint.config.ts`）と
 * 層 README の frontmatter 突合（`scripts/architecture/`）の双方がここを読む。
 *
 * @remarks
 * 宣言と強制を別々に書くと、片方だけを直したコミットが何にも咎められずに通ります。マトリクスの
 * 表現をこの 1 ファイルに閉じ、強制側は生成でも複製でもなく直接の import で受け取ります。
 *
 * **ここが持つのは強制へ変換できる構造だけです。** 各層が何を担うかはここでは決めません
 * （`docs/rules.md`「層境界と依存」）。責務の記述をここへ書き足すと、機械が読めない散文が
 * 依存表の中に居座り、直す側がどちらを正とすればよいか分からなくなります。
 */

/** 物理化されている層。`src/<kernel>/` に 1 対 1 で対応する。 */
export const KERNELS = [
  "app",
  "features",
  "model",
  "components",
  "adapters",
  "capabilities",
  "stores",
  "config",
  "errors",
  "logging",
  "observability",
] as const;

export type Kernel = (typeof KERNELS)[number];

/**
 * UI を置いてよい層。
 *
 * @remarks
 * ここに無い層で描画を組み立てると、外部接続や横断状態の内側に画面が生まれ、置き場を辿れなく
 * なります（`docs/rules.md`「層境界と依存」）。
 *
 * 強制が届くのは **DOM マークアップだけ**です。Provider の合成は許されており、React 19 では
 * Provider も JSX なので、JSX の有無では分けられません。層に class 名や見た目の定数を置く経路も
 * 残るため、これは「UI 禁止」の全部ではなく、機械で読める部分です。
 */
export const UI_KERNELS = ["app", "features", "components"] as const satisfies readonly Kernel[];

/**
 * 層ごとに import を許す層。ここに無い組み合わせはすべて禁止される。
 *
 * @remarks
 * 依存は内向きの一方向です。`app` が最も外側で、`errors` / `logging` / `observability` /
 * `config` は他の層を参照しない末端に置きます。`features` が `features` を含まないのは、
 * 機能スライス同士の相互参照を禁じているためです。唯一の抜け道は {@link SHARED_AREAS} の
 * `features-facade` で、層の粒度ではなく区画の粒度で許します。
 */
export const DEPENDENCIES = {
  app: [
    "features",
    "components",
    "capabilities",
    "stores",
    "adapters",
    "errors",
    "logging",
    "config",
    "model",
    "observability",
  ],
  features: [
    "model",
    "components",
    "adapters",
    "capabilities",
    "stores",
    "errors",
    "logging",
    "observability",
  ],
  model: ["errors"],
  components: ["model", "errors"],
  adapters: ["model", "errors", "logging", "config", "observability"],
  capabilities: ["model", "errors", "logging", "config"],
  stores: ["model", "errors", "config"],
  config: [],
  errors: [],
  logging: [],
  observability: [],
} as const satisfies Record<Kernel, readonly Kernel[]>;

/**
 * 層を検査の要素へ切り出すときの経路。既定は `src/<kernel>` を 1 つの要素として扱う。
 *
 * @remarks
 * 境界検査は要素の間しか見ません（`RESTRICTED_AREAS` の注記）。層をディレクトリ 1 つに
 * 対応させると、`features` は全スライスがまとめて 1 要素になり、feature 同士の直接 import が
 * 内部の参照として黙って通ります。スライスごとに要素を切って、初めて依存表の禁止が効きます。
 */
export const KERNEL_PATTERNS: Partial<Readonly<Record<Kernel, string>>> = {
  features: "src/features/*",
};

/**
 * 起動 / ビルド境界のエントリ。置き場を framework が決めるためカーネルの下へ入れられない。
 *
 * @remarks
 * カーネルではないので README も層も持ちませんが、分類の外へ出すと「どの層でもない」ファイルが
 * 正常系に紛れ、未分類を検出するガードが機能しなくなります。層と同じ表に載せて分類させます。
 *
 * 検証の要求（`testRequirement`）もここが持ちます。カーネルなら層 README の frontmatter が宣言
 * しますが、エントリには README が無く、宣言する場所が他にありません。値の意味は層 README が
 * 宣言するものと同じで、ここだけの綴りを増やしません。
 */
export const ENTRY_POINTS = [
  {
    category: "bootstrap",
    pattern: "src/instrumentation*",
    dependencies: ["config", "logging", "observability"],
    testRequirement: "unit",
  },
  {
    // リクエスト完了前に走る境界。`app` ではないので層の表には載らず、置き場も framework が
    // 決める。参照できるのは cookie から身元を読むための境界アダプタと、その判定に使う表示用の
    // 型だけで、feature も UI も持たせない。
    category: "proxy",
    pattern: "src/proxy*",
    dependencies: ["model", "config", "errors"],
    // 関数として呼べば分岐も差し替え先も行使できるので unit である。matcher の選び足りなさだけは
    // 関数を呼ぶ経路を通らないため e2e が負う。
    testRequirement: "unit",
  },
  {
    // 画面の合成を見せる story。合成は `app` 層の管轄だが、route segment は薄い層なので `app` に
    // story は置けない。そのため feature 配下の story にだけ、`app` と同じく feature を跨いで
    // 組む権限を与える。対象は story ファイルのみで、実装は `features` の層として検査された
    // ままになる。
    category: "feature-story",
    pattern: "src/features/**/*.stories.tsx",
    dependencies: ["features", "components", "model", "stores", "capabilities", "errors"],
    // story 自体はテストの対象ではなく、story 全数を実ブラウザで検査する側の入力である。
    testRequirement: "none",
  },
] as const satisfies readonly {
  category: string;
  pattern: string;
  dependencies: readonly Kernel[];
  testRequirement: "unit" | "component" | "integration" | "route" | "feature" | "none";
}[];

/**
 * `app` 層の element。置き場ではなく**ファイル名**が役割を決めるため、層ではなくファイルの分類で持つ。
 *
 * @remarks
 * `app` を 1 層に畳むと許可は全 element の和集合になり、`route.ts` が UI 部品や横断状態へ手を
 * 伸ばしても咎められません。thin proxy という原則が散文だけになります。
 *
 * 境界検査の要素はディレクトリに対応するため（`RESTRICTED_AREAS` の注記）、同じディレクトリに
 * 居るファイルを名前で分けるには**層の許可を狭める禁止**として書きます。`forbidden` はそのための
 * 列で、層の許可より後に評価されます。
 *
 * - `app-route-handler`: 唯一の HTTP 口。バックエンドへの中継とその応答の組み立てだけを持つため、
 *   UI 部品・横断状態・設定と、feature の内側を落とします。**feature を指すなら `facade/` から**
 *   —— 送り先に要るのはルートの識別子だけで、それは所有する feature が `facade/` へ出しています。
 *   スライスの内側まで開けると、業務ロジックがここへ降りてくる経路になります。受け口の本体を隣の
 *   モジュールへ薄く出す形（`app` 内の相互参照）は残ります
 *
 * - `app-server-action`: `"use server"` の変更口。action id を知る者は任意の route から呼べるため、
 *   **主体の断言をここで行う**公開の口です。持てるのは `adapters/server` と feature、`model` /
 *   `errors` / `logging` だけなので、UI 部品・横断状態と `observability` を落とします —— 計装の
 *   mount は `route-segment` の名指しの例外であって、変更の口が span を立てる場所ではありません。
 *   **`config` は落としていません**: 禁じているのは server config の直読で、`actions.ts` が読んで
 *   いるのは `NEXT_PUBLIC` の公開定数です。層の粒度ではその 2 つを分けられないため、扱いは
 *   [BACKLOG](docs/adr/BACKLOG.md) の GB-1 が持ちます
 *
 * - `app-metadata`: クローラと共有先が読む配信物。`config`（外から見た origin・索引の可否）と
 *   `model`（保護している経路の宣言）を読み、要求時に一覧を辿る `sitemap.ts` だけが
 *   `adapters/server` と feature の `facade/` へ届きます。UI 部品と横断状態は持ちません ——
 *   描くのは絵 1 枚か文書 1 つで、画面ではないためです。判定を持つ `sitemap.ts` / `robots.ts` は
 *   `unit` で検証し、絵を返すだけの 3 つは判定を持たないので単体では回しません
 *   （`scripts/lib/untested-modules.ts`）
 *
 * `route-segment` はまだこの表に無く、`app` の粒度で検査されます。`observability` も `config` も、
 * 許されているのは計装の mount と、Next.js の規約が route segment に置くことを要求する値だけ
 * ですが、その限定は「何を import してよいか」ではなく「どう使ってよいか」なので、層の許可を削る
 * 形では表せません。残りは意味的な監査と人のレビューが拾います。表を実態へ揃える作業は
 * [BACKLOG](docs/adr/BACKLOG.md) の GB-1 が持ちます。
 *
 * `testRequirement` をここが持つのは、負う観点を決めるのが**置き場ではなく element** だからです。
 * ディレクトリから遡る README は、`api/` の外に置いた Route Handler へ届きません。対象のテストは
 * `<pattern>` の `.ts` を `.test.ts` に読み替えた位置に居ます。
 */
export const APP_ELEMENTS = [
  {
    category: "app-route-handler",
    patterns: ["src/app/**/route.ts", "src/app/**/route.dev.ts"],
    forbidden: ["components", "capabilities", "stores", "config", "features", "observability"],
    testRequirement: "integration",
  },
  {
    category: "app-server-action",
    patterns: ["src/app/**/actions.ts"],
    forbidden: ["components", "capabilities", "stores", "observability"],
    testRequirement: "route",
  },
  {
    category: "app-metadata",
    patterns: [
      "src/app/**/sitemap.ts",
      "src/app/**/robots.ts",
      "src/app/**/opengraph-image.tsx",
      "src/app/**/icon.tsx",
      "src/app/**/apple-icon.tsx",
    ],
    forbidden: [
      "components",
      "capabilities",
      "stores",
      "features",
      "errors",
      "logging",
      "observability",
    ],
    testRequirement: "unit",
  },
] as const satisfies readonly {
  category: string;
  patterns: readonly string[];
  forbidden: readonly Kernel[];
  testRequirement: "component" | "feature" | "integration" | "route" | "unit";
}[];

/**
 * 層の内側にありながら、外の層から import してよい区画。
 *
 * @remarks
 * {@link RESTRICTED_AREAS} と向きが逆です。あちらは層の許可より狭め、ここは層の禁止より広げます。
 *
 * - `features-facade`: feature が他の feature へ見せる唯一の面。`features` 同士の import は
 *   禁じたまま、この区画だけを通します。
 *   区画自身が import できるものは `features` と同じで、**`features` を含みません**。facade が
 *   feature の内部を参照できると、内部が facade 経由で外へ素通しになり、面を分けた意味が消えます。
 *   **区画同士も許しません。** 同じ feature の中は 1 つの要素なので宣言なしで通り、宣言を足すと
 *   別の feature の面まで通ってしまいます
 */
export const SHARED_AREAS = [
  {
    type: "features-facade",
    pattern: "src/features/*/facade",
    allowedFrom: ["app", "features"],
    allowedFromCategories: ["feature-story"],
    dependencies: DEPENDENCIES.features,
  },
] as const satisfies readonly {
  type: string;
  pattern: string;
  allowedFrom: readonly Kernel[];
  allowedFromCategories: readonly string[];
  dependencies: readonly Kernel[];
}[];

/**
 * 名指しした相手からしか import できない区画。
 *
 * @remarks
 * 境界検査が働くのは宣言された要素の間だけで、要素はディレクトリに対応します。同じ要素の中の
 * import は依存表に載っていなくても「内部の参照」として通り、層より細かい単位や `src/` の外は、
 * 宣言しない限り違反ではなく「検査の対象外」として黙って通ります。区画を独立した要素として
 * 宣言し、許す相手を名指しすることで、層の粒度では表せない制約を機械で持ちます。
 *
 * - `adapters-gen`: 契約から生成した wire 型。`adapters` の内側にあるため、層として `adapters` を
 *   import できる `app` / `features` から素通しで届き、生成型が内層へ漏れます
 * - `adapters-http`: 両 element が従う要求の形の規則。片方の element に置くともう片方から届かず、
 *   規則が 2 つに割れます
 * - `mocks`: 契約駆動モック。生成された HTTP client を含み、それは本番が使わないものです。一方で
 *   モックの起動そのものは起動境界の仕事であるため、そこからだけ届くようにします
 * - `adapters-auth`: session の封緘と復元。入口の楽観判定がここだけを必要とするため、`proxy` へ
 *   `adapters` 全体を開けずに済ませます。開けてしまうと、**前捌きでのデータ取得**が境界検査を
 *   通り抜けます
 *
 * 区画は自分が何を import してよいかも宣言します。層の許可は要素の型に対して当たるため、区画へ
 * 切り出した時点で層の許可が届かなくなり、宣言しないと自分自身の import がすべて禁止になります。
 */
export const RESTRICTED_AREAS = [
  {
    type: "adapters-gen",
    pattern: "src/adapters/gen",
    allowedFrom: ["adapters"],
    allowedFromCategories: [],
    dependencies: [],
  },
  {
    type: "adapters-http",
    pattern: "src/adapters/http",
    allowedFrom: ["adapters"],
    allowedFromCategories: [],
    dependencies: ["errors"],
  },
  {
    type: "adapters-auth",
    pattern: "src/adapters/server/auth",
    allowedFrom: ["app", "adapters"],
    allowedFromCategories: ["proxy"],
    dependencies: ["adapters", "model", "errors", "logging", "config"],
  },
  {
    type: "mocks",
    pattern: "mocks",
    allowedFrom: [],
    allowedFromCategories: ["bootstrap"],
    dependencies: [],
  },
] as const satisfies readonly {
  type: string;
  pattern: string;
  allowedFrom: readonly Kernel[];
  allowedFromCategories: readonly string[];
  dependencies: readonly Kernel[];
}[];

/**
 * Node.js の実行環境そのものへ触ってよい場所。
 *
 * @remarks
 * 層の依存表が見ているのは「どの層がどの層を import してよいか」だけで、**その層のコードが
 * server と client のどちらで動くか**は見ていません。`process` と `node:` の組み込みモジュールは
 * client の束へ載った時点で壊れるため、届く範囲を層とは別の軸で宣言します。
 *
 * - `src/config/**` — 環境変数の読み取りはこのカーネルへ閉じます。`process.env` の直読が
 *   他所へ散ると、値の出所と既定値がコードのどこにでも書けるようになります
 * - `src/instrumentation.ts` — 起動境界。どの runtime に居るかを `NEXT_RUNTIME` で分けるため、
 *   config を読む前に `process` へ触る必要があります
 * - `src/components/scripts/**` — リポジトリ自身を操作する道具（`pnpm add:ui` /
 *   `pnpm check:ui` / `pnpm check:classes`）で、アプリの束には入りません。部品の隣に置いてあるのは
 *   対象が部品だからで、実行するのは Node であってブラウザではありません
 */
export const NODE_RUNTIME_ACCESS = [
  "src/config/**",
  "src/instrumentation.ts",
  "src/components/scripts/**",
] as const;
