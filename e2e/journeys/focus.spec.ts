import type { Locator, Page } from "@playwright/test";

import { expect, test } from "../lib/test";
import { loadBreakpoints, VIEWPORT_HEIGHT } from "../lib/viewports";

/**
 * 被せた面を開いたときの焦点の行き先。
 *
 * @remarks
 * jsdom はフォーカスの実装を持ちません（[README](../README.md) の「フォーカス」）。component
 * テストの `toHaveFocus` が確かめているのは「その要素へ focus を当てられること」であって、
 * **開いたときに焦点が入るか・Tab が背面へ抜けないか・閉じたときに戻るか**ではありません。
 * ここが唯一の検査地点です。
 *
 * 見るのはその 3 点だけで、網羅はしません。**題材の画面ではなく機構を見ている**ので、ジャーニーを
 * 自分の画面へ書き換えるときも、機構ごとに 1 本という形は残してください（[README](../README.md)）。
 *
 * **menu も面の中へ閉じ込めます。** WAI-ARIA の作法では menu は `Tab` で閉じますが、Radix の
 * menu は既定で modal であり、dialog と同じく巡回を閉じ込めます。ここが確かめるのは作法への
 * 適合ではなく「**開いている面の外へ焦点が漏れないこと**」なので、実装が現に約束している形を
 * 当てます。
 */

/** 面の中と外を往復させるのに十分な回数。巡回が閉じていれば、何周しても外へは出ない。 */
const TAB_COUNT = 12;

/** いま焦点がある要素が、指定した面の中に居るか。 */
async function focusIsInside(surface: Locator): Promise<boolean> {
  return surface.evaluate((element) => {
    const active = element.ownerDocument.activeElement;

    return active !== null && element.contains(active);
  });
}

/**
 * 開いた面が焦点を受け取り、閉じたら開いた導線へ返すことを確かめる。
 *
 * @remarks
 * 2 点を 1 本にまとめてあります。**順序そのものが検査**だからです。焦点が入っていない状態で
 * 戻り先を見ても、戻ったのか一度も動いていないのかが区別できません。
 *
 * @param page - 対象のページ
 * @param trigger - 面を開く操作。閉じたあとに焦点が戻る先でもある
 * @param surface - 開いた面。`dialog` / `menu` などの role で引く
 */
async function expectsFocusEntersAndReturns(
  page: Page,
  trigger: Locator,
  surface: Locator,
): Promise<void> {
  await trigger.click();
  await expect(surface).toBeVisible();

  // 開いた直後。焦点が背面に残っていると、支援技術の利用者には面が開いたことが伝わらない。
  expect(await focusIsInside(surface)).toBe(true);

  await page.keyboard.press("Escape");
  await expect(surface).toBeHidden();

  // 開いた導線へ戻す。戻さないと、閉じた利用者は文書の先頭から辿り直すことになる。
  await expect(trigger).toBeFocused();
}

test.describe("ドロワー", () => {
  // 被せる姿の入口が出る幅。脇に常設できる幅では、そもそもこの面が無い。
  test.use({
    viewport: { width: (loadBreakpoints().get("md") as number) - 1, height: VIEWPORT_HEIGHT },
  });

  test("開くと焦点が面へ入り、閉じると導線へ戻る", async ({ page }) => {
    await page.goto("/about");

    await expectsFocusEntersAndReturns(
      page,
      page.getByRole("button", { name: "メニューを開く" }),
      page.getByRole("dialog"),
    );
  });

  test("開いている間、Tab が背面へ抜けない", async ({ page }) => {
    await page.goto("/about");

    const surface = page.getByRole("dialog");

    await page.getByRole("button", { name: "メニューを開く" }).click();
    await expect(surface).toBeVisible();

    for (let step = 0; step < TAB_COUNT; step += 1) {
      await page.keyboard.press("Tab");

      // 一度でも外へ出れば、そこから先は背面を触れてしまう。周回の途中で見る。
      expect(await focusIsInside(surface)).toBe(true);
    }
  });
});

test.describe("モーダル", () => {
  test("開くと焦点が面へ入り、閉じると導線へ戻る", async ({ page, signIn }) => {
    await signIn("admin");
    await page.goto("/admin/analytics");

    await expectsFocusEntersAndReturns(
      page,
      page.getByRole("button", { name: "期間を指定" }),
      page.getByRole("dialog"),
    );
  });

  test("開いている間、Tab が背面へ抜けない", async ({ page, signIn }) => {
    await signIn("admin");
    await page.goto("/admin/analytics");

    const surface = page.getByRole("dialog");

    await page.getByRole("button", { name: "期間を指定" }).click();
    await expect(surface).toBeVisible();

    for (let step = 0; step < TAB_COUNT; step += 1) {
      await page.keyboard.press("Tab");

      expect(await focusIsInside(surface)).toBe(true);
    }
  });
});

test.describe("メニュー", () => {
  // 行操作の trigger は、操作を持つ行が 1 行も無いと描かれない。契約から生成したモックは
  // 要求ごとに固定の応答を返すので（`mocks/stable-responses.ts`）、行の顔ぶれは実行のたびに
  // 変わらない。ただし固定の根拠は要求 URL であり、一覧の取り方（頁の大きさ・絞り込み）を
  // 変えると別の応答になる。ここが要素なしで落ちたときは、まず一覧側の変更を疑う。
  test("開くと焦点が面へ入り、閉じると導線へ戻る", async ({ page, signIn }) => {
    await signIn("admin");
    await page.goto("/admin/users");

    await expectsFocusEntersAndReturns(
      page,
      page.getByRole("button", { name: /の操作$/ }).first(),
      page.getByRole("menu"),
    );
  });

  test("開いている間、Tab が背面へ抜けない", async ({ page, signIn }) => {
    await signIn("admin");
    await page.goto("/admin/users");

    const surface = page.getByRole("menu");

    await page
      .getByRole("button", { name: /の操作$/ })
      .first()
      .click();
    await expect(surface).toBeVisible();

    for (let step = 0; step < TAB_COUNT; step += 1) {
      await page.keyboard.press("Tab");

      expect(await focusIsInside(surface)).toBe(true);
    }
  });
});
