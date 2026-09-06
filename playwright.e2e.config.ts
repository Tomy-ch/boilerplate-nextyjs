import { defineConfig, devices } from "@playwright/test";
import { SCREEN_AREA } from "./baseline/lib/store";
import { deviceFor, ENGINES, SHOT_ENGINE } from "./e2e/lib/browsers";
import { loadBands, VIEWPORT_HEIGHT } from "./e2e/lib/viewports";
import { getEnvironment } from "./src/config/environment";
import { loadEnvironment } from "./src/config/load-environment";

/**
 * 画面を通した検証の設定（[0090](docs/adr/0090-testing-strategy.md) / [0091](docs/adr/0091-test-verification-methods.md)）。
 *
 * @remarks
 * story 単位の撮影（`playwright.config.ts`）と分けてあります。開く相手が違い（build 済み
 * Storybook / 起動したアプリ）、走らせる単位も違う（配色テーマ / 描画エンジンと viewport の帯）
 * ためです。
 *
 * 実行は story 単位の撮影と同じ Playwright 公式イメージのコンテナ内で行います（`make e2e`）。
 * 基準画像を撮る以上フォントのラスタライズを固定する必要があり、加えて 3 つの描画エンジンを
 * 揃った版で持っているのがこのイメージだけだからです。
 */

if (process.platform !== "linux") {
  throw new Error(
    "E2E はコンテナ内で実行してください（make e2e）。ホストのブラウザでは基準画像も版も一致しません。",
  );
}

// 相手はモックでなければならない。実物のバックエンドへ当てると、応答が変わるたびに落ち、
// 落ちた理由が退行なのか向こうのデータなのか区別できなくなる（[0090](docs/adr/0090-testing-strategy.md)）。
loadEnvironment();

if (getEnvironment().APP_API_MODE !== "mock") {
  throw new Error(
    "E2E は APP_API_MODE=mock でのみ実行できます。APP_ENV を mock の環境（ci）にしてください（env/README.md）。",
  );
}

/**
 * 開くアプリの場所。
 *
 * @remarks
 * アプリを起動するのはこの設定ではなく `make e2e` です。ブラウザはコンテナの中、アプリは
 * ホストで動くため、Playwright の `webServer` では起動できません（コンテナの中から見た
 * `127.0.0.1` はコンテナ自身です）。分けている理由は `docker-compose.dev-tools.yml` にあります。
 */
const BASE_URL = process.env["E2E_BASE_URL"] ?? "http://127.0.0.1:3000";

const bands = loadBands();

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  outputDir: "tmp/e2e/results",
  // 画面単位の基準画像は story 単位と同じ置き場の、専用の区画に入る（baseline/lib/store.ts）。
  snapshotPathTemplate: `baseline/images/${SCREEN_AREA}/{arg}{ext}`,
  fullyParallel: true,
  workers: 4,
  timeout: 60_000,
  // 撮り直して通る差分は無い。ジャーニー側も同じで、再試行は不安定な経路を隠すだけになる。
  retries: 0,
  reporter: [
    ["list"],
    ["html", { outputFolder: "tmp/e2e/report", open: "never" }],
    ["json", { outputFile: "tmp/e2e/report.json" }],
  ],
  expect: {
    timeout: 20_000,
    // 比較条件は story 単位と同じ。理由は playwright.config.ts に書いてある。
    toHaveScreenshot: {
      threshold: 0.01,
      maxDiffPixels: 0,
      animations: "disabled",
      caret: "hide",
      scale: "css",
    },
  },
  use: {
    baseURL: BASE_URL,
    deviceScaleFactor: 1,
    timezoneId: "Asia/Tokyo",
    locale: "ja-JP",
    trace: "retain-on-failure",
    contextOptions: {
      // Framer Motion の動きは CSS animation ではないため撮影時の停止では止まらない
      // （[0051](docs/adr/0051-styling-system.md)）。動きを求めない設定で初期状態に固定する。
      reducedMotion: "reduce",
    },
  },
  projects: [
    // ジャーニーは 3 つの描画エンジンで回す。見るのは見た目ではなく成立で、対象を 3 つに絞った
    // 根拠は e2e/lib/browsers.ts にある。
    ...ENGINES.map((engine) => ({
      name: engine,
      // 画面単位の a11y は DOM の構造を見るので、エンジンでは変わらない。実行時に飛ばすと
      // **飛ばす回数だけブラウザの器が立つ**ので、収集の段で外す。
      // 停止中の検証は開く相手の状態が違い、索引させる側の公開面は開く相手の build が違うので、
      // こちらの起動では成立しない（`playwright.maintenance.config.ts` / `playwright.metadata.config.ts`）。
      testIgnore:
        engine === ENGINES[0]
          ? ["**/visual/**", "**/maintenance/**", "**/metadata/**"]
          : ["**/visual/**", "**/a11y/**", "**/maintenance/**", "**/metadata/**"],
      use: { ...devices[deviceFor(engine)], viewport: { width: 1280, height: VIEWPORT_HEIGHT } },
    })),
    // 画面の比較は 1 つのエンジンで、帯の数だけ回す。project 名がそのまま基準画像を分ける区画に
    // なる（e2e/lib/viewports.ts）。
    ...bands.map((band) => ({
      name: band.name,
      testMatch: "**/visual/**",
      use: {
        ...devices[deviceFor(SHOT_ENGINE)],
        viewport: { width: band.width, height: VIEWPORT_HEIGHT },
      },
    })),
  ],
});
