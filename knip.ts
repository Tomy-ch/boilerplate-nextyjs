import type { KnipConfig } from "knip";

import { ENTRYPOINT_PATTERNS, GENERATED_MODULES } from "./scripts/lib/untested-modules";

/**
 * 未使用の file / export / dependency を検出する設定。
 *
 * @remarks
 * 1:1 ゲート（[`scripts/one-to-one.gate.test.ts`](scripts/one-to-one.gate.test.ts)）は export に
 * 対応する describe があるかを見ますが、その export をどこかが呼んでいるかは見ません。ここが
 * その隙間を埋めます。
 *
 * **公開面と内部で扱いを変えます。** boilerplate はテンプレートから作った側が使う口を意図的に export するため、
 * `src/components/**` は内部から呼ばれないことが正常であり、未使用がそのまま欠陥になりません。
 * これらを入口として宣言し、export の未使用を問いません。それ以外の層（`features` / `app` /
 * `adapters` / `capabilities` / `stores` / `model` / `config` / `errors` / `logging` /
 * `observability` / `scripts`）は内部であり、どこからも呼ばれない export は死んだコードです。
 *
 * 入口と生成物の宣言は
 * [`scripts/lib/untested-modules.ts`](scripts/lib/untested-modules.ts) を読み直します。同じ事実を
 * 2 箇所に書くと、片方だけを直したときに黙ってずれます。
 */

/** テンプレートから作った側が使う口。内部から呼ばれないことが正常な層。 */
const PUBLISHED_SURFACE = ["src/components/**/*.{ts,tsx}"];

/**
 * import では現れない依存。
 *
 * - `date-fns` — 日付演算の採用ライブラリ（[0120](docs/adr/0120-locale-aware-formatting.md)）。
 *   置いてあること自体が提供物で、テンプレートから作った側が日付を扱い始めた時点で使われる。
 *   撤去条件は、採用そのものを取り下げたとき。
 * - `@commitlint/cli` — `make commitlint` が binary として起動する。knip は Makefile を読まない。
 *   撤去条件は、起動元が TypeScript 側へ移ったとき。
 * - `lefthook` — git hook から起動する。knip は `.git/hooks` の中身で使用を判定するため、hook を
 *   入れていないチェックアウト（CI）でだけ未使用に見える。撤去条件は、hook の導入が
 *   チェックアウトの時点で済むようになったとき。
 * - `lighthouse` — `scripts/lighthouse/` が CLI を子プロセスとして起動する。import にしない理由は
 *   同ディレクトリの `index.ts` にある（tsx の変換がページの中で評価される関数を壊す）。撤去条件は、
 *   その変換が問題にならなくなって import へ戻せたとき。
 * - `babel-plugin-react-compiler` — `next.config.ts` の `reactCompiler` が名前で解決する
 *   （[0042](docs/adr/0042-react19-rendering-api.md) 決定 4）。設定に文字列すら現れないため、
 *   knip からは辿れない。撤去条件は、`"use memo"` を持つ component が 1 つも無くなり、
 *   `reactCompiler` の設定ごと外したとき。
 * - `chrome-devtools-mcp` — CLI（`chrome-devtools`）を `pnpm exec` から起動する。実装が依存しない
 *   道具のため import に現れない（[0156](docs/adr/0156-browser-observation-tooling.md)）。撤去条件は、
 *   観測の「掘る」レーンの道具を差し替えたとき。
 */
const NON_IMPORTED_DEPENDENCIES = [
  "date-fns",
  "@commitlint/cli",
  "lefthook",
  "lighthouse",
  "babel-plugin-react-compiler",
  "chrome-devtools-mcp",
];

/**
 * 依存として持たない実行ファイル。
 *
 * - `make` — `scripts/review/` が build のレシピ（`make e2e-build`）を呼ぶ。build の手順を写して
 *   持つと、`.makefiles/` を直したときにこちらだけ古くなる。撤去条件は、build の起動元が
 *   TypeScript 側へ移ったとき。
 */
const NON_DEPENDENCY_BINARIES = ["make"];

const config: KnipConfig = {
  // playwright.config.ts はコンテナ外で読み込むと落ちるため、knip の plugin では扱えない
  // (plugin は設定を読み込む)。spec と設定は root の entry が直接指す — 静的に辿るだけなら
  // 読み込みは起きない。ignore へ回すと、設定だけが使う宣言(撮る配色テーマなど)が
  // 未使用に見える。
  playwright: false,
  workspaces: {
    ".": {
      entry: [
        // 開発と CI の build にだけ含まれる route segment（`next.config.ts` の `pageExtensions`）。
        // Next の plugin は既定の拡張子しか入口と見なさないため、ここで名指しする。
        "src/app/**/page.dev.tsx",
        ...ENTRYPOINT_PATTERNS,
        ...PUBLISHED_SURFACE,
        "vrt/*.spec.ts",
        "playwright.config.ts",
        "e2e/**/*.spec.ts",
        "playwright.e2e.config.ts",
        "playwright.maintenance.config.ts",
        "playwright.metadata.config.ts",
      ],
      ignore: [...GENERATED_MODULES],
      ignoreDependencies: NON_IMPORTED_DEPENDENCIES,
      ignoreBinaries: NON_DEPENDENCY_BINARIES,
    },
    "docs-viewer": {
      // stylesheet が `@import "tailwindcss"` を辿るだけで、TypeScript には現れない。
      ignoreDependencies: ["tailwindcss"],
    },
  },
};

export default config;
