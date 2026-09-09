import { expect, test } from "@playwright/test";

import { CONSENT_BANNER_COPY } from "@/components/shell/consent-banner/consent-banner.definition";
import { MEASUREMENT_ID_COOKIE_NAME } from "@/model/consent";

/**
 * 同意を尋ねる面と、その裏で配られる計測 id。
 * `e2e/lib/test.ts` の test を使わない理由は [README](../README.md)「同意は選び終えた状態から始める」。
 */

/**
 * 尋ねる面を出す画面。
 *
 * @remarks
 * 尋ねる面は root layout が置くので、どの画面でも出ます。ログインを選ぶのは 2 つの理由です ——
 * **題材に依らない**画面であること（[README](../README.md)）と、**バックエンドから何も取らない**
 * こと（モックの応答に依る画面を指すと、同意の検査がその取得と一緒に落ちます）。
 */
const ENTRY_PATH = "/login";

/** その名前の cookie が配られているか。 */
async function hasCookie(
  context: { cookies: () => Promise<{ name: string }[]> },
  name: string,
): Promise<boolean> {
  return (await context.cookies()).some((cookie) => cookie.name === name);
}

test("選び終えるまで尋ね続ける", async ({ page }) => {
  await page.goto(ENTRY_PATH);

  const asking = page.getByRole("dialog", { name: CONSENT_BANNER_COPY.title });

  await expect(asking).toBeVisible();

  await page.keyboard.press("Escape");

  await expect(asking, "Escape で閉じられると、選ばれないまま尋ねるのをやめてしまう").toBeVisible();
});

test("同意する前は計測 id を配らない", async ({ page }) => {
  await page.goto(ENTRY_PATH);

  await expect(page.getByRole("dialog", { name: CONSENT_BANNER_COPY.title })).toBeVisible();

  expect(await hasCookie(page.context(), MEASUREMENT_ID_COOKIE_NAME)).toBe(false);
});

test("同意すると尋ねるのをやめ、計測 id を配る", async ({ page }) => {
  await page.goto(ENTRY_PATH);
  await page.getByRole("button", { name: CONSENT_BANNER_COPY.accept }).click();

  await expect(page.getByRole("dialog", { name: CONSENT_BANNER_COPY.title })).toBeHidden();

  await page.reload();

  expect(await hasCookie(page.context(), MEASUREMENT_ID_COOKIE_NAME)).toBe(true);
});

test("必要なものだけを選ぶと、尋ねるのをやめたうえで計測 id を配らない", async ({ page }) => {
  await page.goto(ENTRY_PATH);
  await page.getByRole("button", { name: CONSENT_BANNER_COPY.reject }).click();

  await expect(page.getByRole("dialog", { name: CONSENT_BANNER_COPY.title })).toBeHidden();

  await page.reload();

  expect(await hasCookie(page.context(), MEASUREMENT_ID_COOKIE_NAME)).toBe(false);
});
