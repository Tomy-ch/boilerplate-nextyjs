import { defineConfig, devices } from "@playwright/test";

import { deviceFor, SHOT_ENGINE } from "./e2e/lib/browsers";

/**
 * 索引させる設定で起動したアプリの公開面を読む設定。
 *
 * @remarks
 * 巡回（`playwright.e2e.config.ts`）と分けてあるのは、**開く相手の build が違う**ためです。
 * `SITE_INDEXABLE` は build 時に焼き込まれるので（`src/config/site/site.server.ts`）、同じ 1 回の
 * build へ混ぜられません。
 *
 * **基準画像を撮りません。** 見るのはクローラが読む応答の成立であって見た目ではないため、
 * 描画エンジンは 1 つで足ります。
 *
 * 開く先はこの手元の宿に固定します。測る相手は**この設定自身が起動させたアプリ**であり、
 * 繋ぎ先が配信物に入ることはありません。別の宿へ向けるときだけ `E2E_BASE_URL` を渡します。
 */
const BASE_URL = process.env["E2E_BASE_URL"] ?? "http://127.0.0.1:3000"; // DevSkim: ignore DS162092

export default defineConfig({
  testDir: "./e2e/metadata",
  testMatch: "**/*.spec.ts",
  outputDir: "tmp/e2e/metadata-results",
  fullyParallel: true,
  timeout: 60_000,
  retries: 0,
  // 失敗の報告は JSON を読む（scripts/test-report）。ログの末尾を切り出すと、
  // 何件のうち何件が落ちたかが本文から消える。
  reporter: [["list"], ["json", { outputFile: "tmp/e2e/metadata-report.json" }]],
  use: {
    baseURL: BASE_URL,
    timezoneId: "Asia/Tokyo",
    locale: "ja-JP",
    trace: "retain-on-failure",
  },
  projects: [{ name: SHOT_ENGINE, use: { ...devices[deviceFor(SHOT_ENGINE)] } }],
});
