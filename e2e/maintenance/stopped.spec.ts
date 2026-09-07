// 配信を止めた状態で起動したアプリを歩く。
//
// **層ごとの検査では、この結線は通らない。** 入口の分岐は `getMaintenanceConfig()` を差し替えて
// 確かめ、設定は設定だけで確かめている。実際のプロセスが `APP_MAINTENANCE_MODE=on` で起動して
// 差し替えが起きることは、起動してみなければ分からない。
//
// **`e2e/lib/test.ts` の test は使わない。** あれはブラウザが報告する異常の見張りを積んでおり、
// サーバ側の 5xx を失敗として扱う。ここで確かめたい 503 は意図した応答なので、見張りに掛けると
// 成立が失敗として現れる。停止画面そのものの見た目と hydration は、通常の巡回が `/maintenance`
// を開いて見ている（`e2e/lib/screens.ts`）。
import { expect, test } from "@playwright/test";

import { CONSENT_CHOICE, CONSENT_COOKIE_NAME, toConsentCookieValue } from "@/model/consent";

/** 止めていても通る生存確認。 */
const HEALTH_PATH = "/api/health";

/**
 * 停止中の扱いを確かめる経路。
 *
 * @remarks
 * **実在する画面を指しません。** 止めているあいだは経路の有無に関わらず入口が差し替えるので、
 * 実在は前提になりません。題材の画面を指すと、テンプレートから作ってサンプルを破棄した側で
 * この spec だけが指す先を失います。
 */
const STOPPED_PATH = "/help";

// 同意を尋ねる面はこの画面も覆い、周囲を `aria-hidden` にする。作らないと見出しを役割で引けない。
// `lib/test.ts` を使う spec は同じ状態を fixture から受け取る（`e2e/README.md`「同意は選び終えた
// 状態から始める」）。
test.beforeEach(async ({ context, baseURL }) => {
  await context.addCookies([
    {
      name: CONSENT_COOKIE_NAME,
      value: toConsentCookieValue(CONSENT_CHOICE.denied),
      url: baseURL,
    },
  ]);
});

test("止めているあいだ、経路を問わず停止画面が返る", async ({ page }) => {
  await page.goto(STOPPED_PATH);

  await expect(page.getByRole("heading", { name: "ただいまメンテナンス中です" })).toBeVisible();
});

test("止めていても URL は動かない", async ({ page }) => {
  await page.goto(STOPPED_PATH);

  expect(new URL(page.url()).pathname).toBe(STOPPED_PATH);
});

test("止めていても生存確認は通る", async ({ request }) => {
  const response = await request.get(HEALTH_PATH);

  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ status: "ok" });
});

test("止めているあいだ、状態を変える要求は断られる", async ({ request }) => {
  const response = await request.post(STOPPED_PATH);

  expect(response.status()).toBe(503);
});
