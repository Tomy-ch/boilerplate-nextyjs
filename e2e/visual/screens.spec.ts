import { readFileSync } from "node:fs";
import path from "node:path";

import type { TestInfo } from "@playwright/test";
import { listBaselines } from "../../baseline/lib/orphans";
import { noteBaselineGap } from "../../baseline/lib/report-gap";
import { isRetaking } from "../../baseline/lib/store";
import { expectedScreenBaselines, SCREEN_BASELINE_TAG } from "../lib/screen-baselines";
import {
  listScreenRoutes,
  resolveScreens,
  SCREEN_MANIFEST_FILE,
  SCREENS,
  selectScreens,
} from "../lib/screens";
import { expect, test } from "../lib/test";
import { loadBands } from "../lib/viewports";

/**
 * 画面 1 枚ぶんの見た目を基準画像と比べる。
 *
 * @remarks
 * story 単位の撮影（`vrt/`）とは撮る対象が違います。あちらは部品を単独で描いた姿で、ここは
 * 部品を組み上げた画面です。部品が個別に緑でも、並べたときに崩れる形は作れます。
 *
 * 帯（viewport の幅）ごとに撮ります。project 名がそのまま帯であり、基準画像を分ける区画にも
 * なります（[viewports](../lib/viewports.ts)）。
 *
 * 中身が固定されるのは、モックが同じ要求へ同じ応答を返すからです（`mocks/stable-responses.ts`）。
 * 応答が呼ぶたびに変わる状態では、この比較そのものが成立しません。
 */

const screens = selectScreens(
  resolveScreens(listScreenRoutes(readFileSync(SCREEN_MANIFEST_FILE, "utf8")), SCREENS),
  process.env["E2E_ONLY"],
);
const bands = loadBands();

for (const screen of screens) {
  test(screen.name, async ({ page, signIn }, testInfo) => {
    if (screen.signedIn !== undefined) {
      await signIn(screen.signedIn);
    }

    await page.goto(screen.path);

    // 最初の一式から外した島は、枠だけを置いて後から描かれる。枠は連続して撮っても同じなので、
    // Playwright の安定判定では待てない（`e2e/lib/screens.ts` の `settled`）。
    if (screen.settled !== undefined) {
      await page.locator(screen.settled).first().waitFor({ state: "visible" });
    }

    // フォントは差し替わった瞬間に字形が変わる。待たずに撮ると同じ画面が撮るたび違う絵になる。
    await page.evaluate(() => document.fonts.ready);

    // 配列で渡す。1 本の文字列にすると Playwright が `/` をファイル名として無害化するので、
    // 帯ごとに分かれず 1 階層へ平置きされる。
    await expect(page).toHaveScreenshot([testInfo.project.name, `${screen.name}.png`], {
      fullPage: true,
      mask: (screen.mask ?? []).map((selector: string) => page.locator(selector)),
    });
  });
}

test("基準画像 / 撮影対象と 1 対 1 で対応する", { tag: SCREEN_BASELINE_TAG }, ({}, testInfo) => {
  // 対応は置き場に対して 1 回見れば足りる。帯ごとに走らせると同じ失敗が帯の数だけ並ぶ。
  test.skip(testInfo.project.name !== bands[0]?.name, "帯を 1 つ選んで 1 回だけ見る");
  test.skip(isRetaking(process.env), "撮り直しの最中は対応を見ない");
  // 範囲を絞った実行では対応を見ない（理由は selectScreens の doc）。
  test.skip(Boolean(process.env["E2E_ONLY"]), "範囲を絞った実行では対応を見ない");

  const { orphans, missing } = noteBaselineGap(
    testInfo.annotations,
    listBaselines(baselineRoot(testInfo)),
    expectedScreenBaselines(screens, bands),
  );

  expect(orphans, "撮り直して置き場へ送るか、対応する画面を戻してください").toEqual([]);
  expect(missing, "make e2e-update で撮り直してください").toEqual([]);
});

// 置き場の位置は `playwright.e2e.config.ts` の `snapshotPathTemplate` が決める。撮影と同じ解決を
// 通してから 2 区画(帯 / ファイル名)ぶん遡る。
function baselineRoot(testInfo: TestInfo): string {
  return path.resolve(testInfo.snapshotPath("band", "screen.png"), "../..");
}
