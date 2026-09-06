import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

import { EXCLUDED_FROM_CHECKS } from "./scripts/lib/untested-modules";

/**
 * 100% を要求する 4 指標。
 *
 * @remarks
 * **1 台で全量を走らせた実行だけが判定できます。** 分割した実行が見るのは自分に割り当てられた
 * ファイルだけで、他の分に覆われている行は未到達として数えられます。分割の各実行へ掛けると、
 * 割り方を変えるたびに落ち方が変わる検査になります。
 *
 * 判定は blob を合流させた側が行います（`vitest run --mergeReports --coverage`）。合流後の
 * 母数と到達は 1 台で走らせたときと同じものになるため、**閾値そのものは緩みません**。
 */
const COVERAGE_THRESHOLDS = {
  branches: 100,
  functions: 100,
  lines: 100,
  statements: 100,
} as const;

/**
 * この実行が分割の 1 台かどうか。
 *
 * @remarks
 * `--shard` は CLI にしか現れず、設定からは読めません。分割して走らせる側（CI）が宣言し、
 * ここはそれを読むだけにします。**未設定が既定**なので、手元の `pnpm test` と保護ブランチの
 * 実行は今までどおり閾値を持ちます。
 */
const isShard = process.env["VITEST_SHARDED"] === "1";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // カタログ自身の module を story から読む経路。`tsconfig.json` の宣言が正で、ここは
      // その写しである（vitest は tsconfig の `paths` を読まない）。
      "~catalog": fileURLToPath(new URL("./.storybook", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    // src の外にも実行可能なテストがある。tokens の書き出しはアプリのコードではないが、
    // 壊れると生成物が黙って変わるため同じ suite で回す。docs-viewer は別パッケージだが、
    // 同じ gate に載せる。別 suite にすると片方だけが緑という状態を作れてしまい、CI の判定が
    // 「全部通った」を意味しなくなる。
    //
    // `scripts/` だけは [vitest.scripts.config.ts](vitest.scripts.config.ts) の別 suite で回す。
    // あちらに居るのは lint とゲートそのもので、落ちたときにアプリの退行と読み違えたくない。
    include: [
      "{src,tokens,docs-viewer,mocks,eslint-rules,baseline,vrt,e2e}/**/*.test.{ts,tsx}",
      // カタログが自分で持つ判定。設定ファイルは判定を持てないので、外すものは
      // `scripts/lib/untested-modules.ts` の宣言が持つ。
      ".storybook/**/*.test.{ts,tsx}",
    ],
    setupFiles: ["./vitest.setup.ts"],
    // client config はビルド時に置換されるリテラルを前提に `process.env` を静的に読む。この実行は
    // その置換を行わないので、ここで供給しないと値が `NaN` のまま client 側の経路へ渡る。
    env: {
      NEXT_PUBLIC_HTTP_MAX_URL_BYTES: "8000",
      NEXT_PUBLIC_HTTP_MAX_UPLOAD_BYTES: "4194304",
      // 時差を UTC 以外へ固定する。UTC のままだとオフセットが 0 になり、符号の取り違えや
      // 二重補正が「たまたま正しい」結果になって、時差を扱う判定の誤りが構造上検出できない。
      TZ: "Asia/Tokyo",
    },
    coverage: {
      provider: "istanbul",
      // テストを持つ範囲は実行対象と計測対象を揃える。片方だけ広げると、テストは走るのに
      // ゲートに載らない範囲ができ、未テストの分岐を足しても緑のまま通る（ADR 0090）。
      include: [
        "src/**/*.{ts,tsx}",
        "docs-viewer/src/**/*.{ts,tsx}",
        "tokens/**/*.ts",
        "eslint-rules/**/*.ts",
        "baseline/lib/**/*.ts",
        "vrt/**/*.ts",
        "e2e/**/*.ts",
        ".storybook/**/*.{ts,tsx}",
      ],
      // 検査対象から外すモジュールは scripts/lib/untested-modules.ts の宣言 1 箇所が持ち、
      // カバレッジ母数と 1:1 ゲートの双方がそれを読む（ADR 0090）。ここへ直接足すと、
      // ゲート側だけが要求し続ける／カバレッジ側だけが要求し続けるずれが黙って生まれる。
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/**/*.stories.{ts,tsx}",
        "docs-viewer/src/**/*.test.{ts,tsx}",
        "docs-viewer/src/**/*.stories.{ts,tsx}",
        "eslint-rules/**/*.test.ts",
        "baseline/lib/**/*.test.ts",
        "vrt/**/*.test.ts",
        "e2e/**/*.test.ts",
        ".storybook/**/*.test.{ts,tsx}",
        ".storybook/**/*.stories.{ts,tsx}",
        ...EXCLUDED_FROM_CHECKS,
      ],
      thresholds: isShard ? undefined : COVERAGE_THRESHOLDS,
    },
  },
});
