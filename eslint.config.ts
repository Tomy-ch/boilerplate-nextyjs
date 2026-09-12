// Biome では import 元の層ごとの依存方向を表現できないため、境界検査だけを担う。
// 整形・汎用 lint は Biome の責務。
//
// 依存マトリクスは architecture.ts が正であり、ここは宣言を写さず import して強制へ変換する。
import boundaries from "eslint-plugin-boundaries";
import reactHooks from "eslint-plugin-react-hooks";
import security from "eslint-plugin-security";
import tseslint from "typescript-eslint";

import {
  APP_ELEMENTS,
  DEPENDENCIES,
  ENTRY_POINTS,
  KERNEL_PATTERNS,
  KERNELS,
  NODE_RUNTIME_ACCESS,
  RESTRICTED_AREAS,
  SHARED_AREAS,
} from "./architecture";
import noAnonymousDefaultExport from "./eslint-rules/no-anonymous-default-export";
import noCapturedBearerToken from "./eslint-rules/no-captured-bearer-token";
import noInternalAnchor from "./eslint-rules/no-internal-anchor";
import noMarkupOutsideUiLayers from "./eslint-rules/no-markup-outside-ui-layers";
import noRawFontWeight from "./eslint-rules/no-raw-font-weight";
import noUserScopedInCachedModule from "./eslint-rules/no-user-scoped-in-cached-module";

/** Node の組み込みモジュールの締め出し。 */
const nodeBuiltinImports = {
  group: ["node:*"],
  message:
    "Node の組み込みモジュールは client の束へ載った時点で壊れます。server 側へ寄せるか、config カーネルを通してください。",
};

/**
 * アイコンの供給元の締め出し。
 *
 * 供給元を名指しできるのは `src/components/icon.ts` だけで、そこは締め出しの側から外してある。
 * 散らすと差し替えのときに取り残しが出る。
 */
const iconVendorImports = {
  group: ["@tabler/icons-react"],
  message:
    "アイコンの供給元は `@/components/icon` へ閉じます（ADR 0052）。アイコンはそこから import してください。",
};

/**
 * どのファイルでも締め出すもの。
 *
 * **新しい締め出しは原則ここへ足す。**flat config は同名ルールを配列ごと後勝ちで置き換えるので、
 * 適用範囲の広いブロックの側だけへ足すと、それを外している例外ファイルには黙って効かない。
 * 例外ファイルを持つ締め出しは、この基底へではなく、例外を外した側のブロックで足す。
 */
/**
 * `process` の直読を落とす選択子。
 *
 * @remarks
 * `.property` を外すのは `foo.process` のような無関係な名前を拾わないため。ただし
 * `globalThis.process` はその除外にそのまま当たってしまう同じ global の別の綴りなので、名指しで
 * 塞ぐ。塞がないと規則が 1 語で迂回できる。
 */
const PROCESS_ACCESS_SELECTOR = {
  selector:
    'Identifier[name="process"]:not(MemberExpression > .property):not(Property > .key), MemberExpression[object.name="globalThis"][property.name="process"]',
  message:
    "`process` を読んでよいのは config カーネルと起動境界だけです（ADR 0030）。値は config を通して受け取ってください。",
};

/**
 * 購読の口を落とす選択子。
 *
 * @remarks
 * `EventSource` / `WebSocket` は import を持たない global なので、層の依存表（boundaries）には
 * 掛からない。整列・重複排除・張り直しを持たない購読が画面ごとに生まれるのを止めるのは、この
 * 選択子だけである。
 *
 * 見るのは組み立てだけで、型としての参照は落とさない —— 型は接続を開かない。
 */
const SUBSCRIPTION_CONSTRUCTION_SELECTOR = {
  selector: "NewExpression[callee.name=/^(EventSource|WebSocket)$/]",
  message:
    "購読を開けるのは `adapters/client/stream` だけです（ADR 0074）。画面は購読 adapter を通してください。",
};

const commonImportRestrictions = [nodeBuiltinImports];

const elements = [
  // 層より先に並べる。区画は層の内側にあるため、層の要素が先に一致すると区画としては
  // 見えなくなり、層の粒度の許可がそのまま区画への許可になる。
  ...RESTRICTED_AREAS.map(({ type, pattern }) => ({ type, pattern, partialMatch: false })),
  ...SHARED_AREAS.map(({ type, pattern }) => ({ type, pattern, partialMatch: false })),
  ...KERNELS.map((type) => ({
    type,
    pattern: KERNEL_PATTERNS[type] ?? `src/${type}`,
    partialMatch: false,
  })),
];

export default [
  {
    ignores: [
      ".next/**",
      "coverage/**",
      "node_modules/**",
      "out/**",
      "storybook-static/**",
      // カタログへ配る資材の置き場。中身は依存が持つ生成物で、書き手が居ない。
      ".storybook/public/**",
      "graphify-out/**",
      // 配信ツリーの組み立て先。docs の複製と Storybook / ビューアーのバンドルが入る。
      // ワークスペースのパッケージ配下にも出るため先頭を固定しない。
      "**/dist/**",
    ],
  },
  {
    files: ["src/**/*.{js,jsx,ts,tsx}"],
    languageOptions: { parser: tseslint.parser },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
      boundaries,
      "react-hooks": reactHooks,
      "project-rules": {
        rules: {
          "no-anonymous-default-export": noAnonymousDefaultExport,
          "no-captured-bearer-token": noCapturedBearerToken,
          "no-internal-anchor": noInternalAnchor,
          "no-markup-outside-ui-layers": noMarkupOutsideUiLayers,
          "no-raw-font-weight": noRawFontWeight,
          "no-user-scoped-in-cached-module": noUserScopedInCachedModule,
        },
      },
    },
    settings: {
      "boundaries/files": [
        ...ENTRY_POINTS.map(({ category, pattern }) => ({ category, pattern })),
        ...APP_ELEMENTS.map(({ category, patterns }) => ({ category, pattern: [...patterns] })),
      ],
      // 境界検査は import 先を実ファイルまで解決できて初めて成立する。解決できない import は
      // 「どの層でもない」と見なされ、違反があっても黙って通る。`@/*` を含めて解決させる。
      "import/resolver": { typescript: { project: "./tsconfig.json" } },
      "boundaries/include": [
        "src/**/*",
        ...RESTRICTED_AREAS.map(({ pattern }) => `${pattern}/**/*`),
        ...SHARED_AREAS.map(({ pattern }) => `${pattern}/**/*`),
      ],
      "boundaries/elements": elements,
    },
    rules: {
      // Biome では effect で state を導出する形や描画中の副作用を表現できないため、React Compiler
      // 由来の診断だけを担う。
      //
      // **React Compiler を使うかどうかとは独立に維持する。** これらが止めるのは通常実装のバグで
      // あって、Compiler の前提充足ではない。
      "react-hooks/capitalized-calls": "error",
      "react-hooks/error-boundaries": "error",
      "react-hooks/gating": "error",
      "react-hooks/globals": "error",
      "react-hooks/immutability": "error",
      "react-hooks/incompatible-library": "error",
      "react-hooks/memoized-effect-dependencies": "error",
      "react-hooks/no-deriving-state-in-effects": "error",
      "react-hooks/preserve-manual-memoization": "error",
      "react-hooks/purity": "error",
      "react-hooks/refs": "error",
      "react-hooks/set-state-in-effect": "error",
      "react-hooks/set-state-in-render": "error",
      "react-hooks/static-components": "error",
      "react-hooks/unsupported-syntax": "error",
      "react-hooks/use-memo": "error",
      "react-hooks/void-use-memo": "error",
      "boundaries/dependencies": [
        "error",
        {
          default: "disallow",
          policies: [
            ...Object.entries(DEPENDENCIES).map(([from, types]) => ({
              from: { element: { type: from } },
              allow: { to: { element: { types: { anyOf: types } } } },
            })),
            // 区画自身の依存。層としては `features` に居るが、要素としては別の型になるため、
            // 層の policy が当たらない。
            ...SHARED_AREAS.map(({ type, dependencies }) => ({
              from: { element: { type } },
              allow: { to: { element: { types: { anyOf: dependencies } } } },
            })),
            ...SHARED_AREAS.map(({ type, allowedFrom }) => ({
              from: { element: { types: { anyOf: allowedFrom } } },
              allow: { to: { element: { type } } },
            })),
            // 画面まるごとの story は feature を跨いで組むため、面にも届く必要がある。
            ...SHARED_AREAS.flatMap(({ type, allowedFromCategories }) =>
              allowedFromCategories.map((category) => ({
                from: { file: { categories: category } },
                allow: { to: { element: { type } } },
              })),
            ),
            // 区画自身の依存。層の許可は要素の型に当たるため、区画へ切り出すと層の許可が届かない。
            ...RESTRICTED_AREAS.filter(({ dependencies }) => dependencies.length > 0).map(
              ({ type, dependencies }) => ({
                from: { element: { type } },
                allow: { to: { element: { types: { anyOf: dependencies } } } },
              }),
            ),
            ...RESTRICTED_AREAS.filter(({ allowedFrom }) => allowedFrom.length > 0).map(
              ({ type, allowedFrom }) => ({
                from: { element: { types: { anyOf: allowedFrom } } },
                allow: { to: { element: { type } } },
              }),
            ),
            ...RESTRICTED_AREAS.filter(
              ({ allowedFromCategories }) => allowedFromCategories.length > 0,
            ).map(({ type, allowedFromCategories }) => ({
              from: { file: { categories: allowedFromCategories } },
              allow: { to: { element: { type } } },
            })),
            ...ENTRY_POINTS.map(({ category, dependencies }) => ({
              from: { file: { categories: category } },
              allow: { to: { element: { types: { anyOf: dependencies } } } },
            })),
            // co-location したテストが対象を読む経路。カーネル内では同一層の import に収まるが、
            // エントリは層を持たないため category 内の相互参照として明示する。
            ...ENTRY_POINTS.map(({ category }) => ({
              from: { file: { categories: category } },
              allow: { to: { file: { categories: category } } },
            })),
            // `app` の element（`architecture.ts` の `APP_ELEMENTS`）。
            ...APP_ELEMENTS.map(({ category, forbidden }) => ({
              from: { file: { categories: category } },
              disallow: { to: { element: { types: { anyOf: forbidden } } } },
            })),
          ],
        },
      ],
      "boundaries/no-unknown-files": "error",
      "boundaries/no-unknown-dependencies": "error",
      "project-rules/no-anonymous-default-export": "error",
      "project-rules/no-captured-bearer-token": "error",
      "project-rules/no-internal-anchor": "error",
      "project-rules/no-markup-outside-ui-layers": "error",
      "project-rules/no-user-scoped-in-cached-module": "error",
      "@typescript-eslint/consistent-type-assertions": [
        "error",
        {
          assertionStyle: "never",
        },
      ],
    },
  },
  {
    // 実行場所の境界。層の依存表は import の向きしか見ておらず、server と client のどちらで動くかは
    // 見ていない（宣言は `architecture.ts` の `NODE_RUNTIME_ACCESS` が正）。
    //
    // テストは束に入らないので外す。ここが守っているのはブラウザへ届く成果物であって、Node で
    // 走る検査ではない。story は Storybook の束に入るため外さない。
    files: ["src/**/*.{js,jsx,ts,tsx}"],
    ignores: [
      ...NODE_RUNTIME_ACCESS.map((path) => (path.endsWith("/**") ? `${path}/*` : path)),
      "src/**/*.test.{js,jsx,ts,tsx}",
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        PROCESS_ACCESS_SELECTOR,
        SUBSCRIPTION_CONSTRUCTION_SELECTOR,
      ],
      "no-restricted-imports": [
        "error",
        { patterns: [...commonImportRestrictions, iconVendorImports] },
      ],
    },
  },
  {
    // 購読 adapter だけが接続を組み立てる。**規則ごと外さない** —— 同じ束の `process` の禁止は
    // ここでも効いたままにする（flat config は規則の値を後勝ちで置き換えるので、並べ直すのではなく
    // 残す側を書き下す）。
    files: ["src/adapters/client/stream/**/*.{js,jsx,ts,tsx}"],
    rules: {
      "no-restricted-syntax": ["error", PROCESS_ACCESS_SELECTOR],
    },
  },
  {
    // アイコンの公開面そのもの。`iconVendorImports` の締め出しから外す。
    files: ["src/components/icon.ts"],
    rules: {
      "no-restricted-imports": ["error", { patterns: commonImportRestrictions }],
    },
  },
  {
    // ビューアーは `@` alias でアプリ本体のソースを直接参照する（`docs-viewer/README.md`）ので、
    // アイコンも同じ公開面から取る（`iconVendorImports`）。
    files: ["docs-viewer/src/**/*.{js,jsx,ts,tsx}"],
    languageOptions: { parser: tseslint.parser },
    rules: {
      "no-restricted-imports": ["error", { patterns: [iconVendorImports] }],
    },
  },
  {
    // 器（route segment）を Client Component にしない。`"use client"` は bundle 境界なので、器に
    // 付けると配下の子まで束へ引き込む（`docs/design/rendering.md`）。島は葉に差す。
    //
    // `error.tsx` / `global-error.tsx` は framework が client を要求するため、ここに挙げない。
    //
    // **対象のファイル名を `architecture.ts` へ出さないのは、これが framework の綴りだから。**
    // 隣の `NODE_RUNTIME_ACCESS` はこのリポジトリが決めた区画（どの層が実行環境へ触れてよいか）
    // なので宣言を 1 箇所へ集めるが、`layout` / `page` / `template` / `default` を決めたのは
    // Next.js であり、リポジトリの構造の宣言に混ぜると出所の違う 2 種類が同居する。
    files: ["src/app/**/{layout,page,template,default}.tsx"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: 'Program > ExpressionStatement > Literal[value="use client"]',
          message:
            "route segment の器を Client Component にしないでください。client が要るのは葉で、そこへ島として差します。",
        },
      ],
    },
  },
  {
    // 太さの直接指定は画面が使う class にだけ禁じる。test は部品が持つ class を確かめる側で、
    // story は見本であり、どちらも画面が使う class ではない。
    files: ["src/**/*.{js,jsx,ts,tsx}"],
    ignores: ["src/**/*.test.{js,jsx,ts,tsx}", "src/**/*.stories.{js,jsx,ts,tsx}"],
    rules: {
      "project-rules/no-raw-font-weight": "error",
    },
  },
  {
    // 危険なパターンの検出。SAST（opengrep）と同じ問いを、**型を解決したうえで
    // 編集中に**答える層として置く。走査が CI にしか無いと、指摘が届くのは push の後になる。
    //
    // **推奨プリセット（`security.configs.recommended`）は当てない。** 能力ベース分担は束の適用
    // を禁じており、束を当てれば biome と重なる規則と、この層に対象の無い規則が同時に入る。有効化するのは、biome に相当が無く、かつ表示層のコードで実際に起こりうるものだけ。
    //
    // **入れる規則は、0 件の baseline を保てるものだけ。** 赤が常態になると、赤を見て手を
    // 止める習慣のほうが先に壊れる。除いた 5 つと、その理由:
    //
    // - `detect-object-injection` — `obj[key]` を全件鳴らす。TypeScript が型で保証している
    //   添字まで指摘になる
    // - `detect-unsafe-regex` — 星の高さだけで判定するため `/^\d+(\.\d+)?$/` すら鳴る。実測で
    //   55 件、その大半は生成物（`src/adapters/gen/**`）で、直す先がそもそも無い
    // - `detect-non-literal-fs-filename` — 対象は自分で組み立てたパスを読む build 時スクリプト
    //   だけで、外から来る値がそこへ入る経路が無い
    // - `detect-possible-timing-attacks` — 識別子の名前で判定する。比較の中身を見ていない
    // - `detect-non-literal-regexp` — 引数から RegExp を組む形をすべて鳴らす。ReDoS の判定は
    //   していないので、上の 1 つ目と同じく形だけを見ている
    files: ["src/**/*.{js,jsx,ts,tsx}"],
    plugins: { security },
    rules: {
      "security/detect-bidi-characters": "error",
      "security/detect-buffer-noassert": "error",
      "security/detect-child-process": "error",
      "security/detect-disable-mustache-escape": "error",
      "security/detect-eval-with-expression": "error",
      "security/detect-new-buffer": "error",
      "security/detect-no-csrf-before-method-override": "error",
      "security/detect-non-literal-require": "error",
      "security/detect-pseudoRandomBytes": "error",
    },
  },
  {
    files: ["src/errors/**/*.{js,jsx,ts,tsx}"],
    ignores: ["src/errors/**/*.test.{js,jsx,ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "Identifier[name=/^(http|status|response)$/i]",
          message: "errors カーネルへ transport 語彙を持ち込んではいけません。",
        },
        {
          selector: "Literal[value=/\\bhttps?\\b/i]",
          message: "errors カーネルへ transport 語彙を持ち込んではいけません。",
        },
      ],
    },
  },
];
