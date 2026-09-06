import { defineConfig, devices } from "@playwright/test";

import { deviceFor, SHOT_ENGINE } from "./e2e/lib/browsers";

/**
 * 配信を止めた状態のアプリを歩く設定。
 *
 * @remarks
 * 巡回（`playwright.e2e.config.ts`）と分けてあるのは、**開く相手の状態が違う**ためです。
 * `APP_MAINTENANCE_MODE` は全ルートに効き、切り替えには起動し直しが要るので
 * （`docs/spec/route/maintenance/page.function.md`）、同じ 1 回の起動へ混ぜられません。
 *
 * **基準画像を撮りません。** 見るのは応答の成立であって見た目ではなく、停止画面の見た目は
 * 通常の巡回が `/maintenance` を開いて撮っています。したがってフォントのラスタライズを
 * 揃える必要が無く、描画エンジンも 1 つで足ります。
 *
 * 開く先はこの手元の宿に固定します。測る相手は**この設定自身が起動させたアプリ**であり、
 * 繋ぎ先が配信物に入ることはありません。別の宿へ向けるときだけ `E2E_BASE_URL` を渡します。
 */
const BASE_URL = process.env["E2E_BASE_URL"] ?? "http://127.0.0.1:3000"; // DevSkim: ignore DS162092

export default defineConfig({
  testDir: "./e2e/maintenance",
  testMatch: "**/*.spec.ts",
  outputDir: "tmp/e2e/maintenance-results",
  fullyParallel: true,
  timeout: 60_000,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: BASE_URL,
    timezoneId: "Asia/Tokyo",
    locale: "ja-JP",
    trace: "retain-on-failure",
  },
  projects: [{ name: SHOT_ENGINE, use: { ...devices[deviceFor(SHOT_ENGINE)] } }],
});
