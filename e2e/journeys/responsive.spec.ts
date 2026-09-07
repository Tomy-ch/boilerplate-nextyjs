import { expect, test } from "../lib/test";
import { loadBands, loadBreakpoints, VIEWPORT_HEIGHT } from "../lib/viewports";

/**
 * 帯ごとの出し分け（`docs/rules.md`「レイアウトと帯」の「脇に常設する領域は `lg` 以上でだけ出す」）。
 *
 * @remarks
 * 規約が決めているのは「本文の脇に常設する領域は `lg` 以上でだけ出す」ことです。幅は design token
 * が持ち、帯は [viewports](../lib/viewports.ts) がそこから組み立てます。ここに数値はありません。
 *
 * 見た目の比較（`../visual/`）とは別に持ちます。あちらが答えるのは「前と変わったか」で、ここが
 * 答えるのは「決めたとおりに出し分けているか」です。基準画像を撮り直せば前者は通りますが、
 * 出し分けが壊れたことは後者でしか分かりません。
 */

/** 本文の脇に常設する領域。 */
const SIDE_RAIL = "絞り込み条件";

/** 脇の領域を出してよい下限。 */
const RAIL_MIN_WIDTH = loadBreakpoints().get("lg") as number;

for (const band of loadBands()) {
  test.describe(band.name, () => {
    test.use({ viewport: { width: band.width, height: VIEWPORT_HEIGHT } });

    const expected = band.width >= RAIL_MIN_WIDTH;

    test(`幅 ${band.width}px で脇の領域を${expected ? "出す" : "出さない"}`, async ({ page }) => {
      await page.goto("/products");

      const rail = page.getByRole("complementary", { name: SIDE_RAIL });

      if (expected) {
        await expect(rail).toBeVisible();
      } else {
        await expect(rail).toBeHidden();
      }
    });
  });
}
