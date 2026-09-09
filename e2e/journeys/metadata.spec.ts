import { isNoindex, listRobotsDirectives } from "../lib/public-surface";
import { expect, test } from "../lib/test";

/**
 * 索引させない起動（`SITE_INDEXABLE` 未指定 = `off`）で、公開面が索引を断っていること
 * （`docs/rules.md`「設定と環境」の「索引させてよい環境だけが `SITE_INDEXABLE=on` を宣言する」）。
 * 索引させる側は `make e2e-metadata` が別の build で確かめる（`e2e/metadata/`）。両方が通ってはじめて、切り替えが設定で効いていると言える。
 */

/**
 * 索引させない起動でも開ける画面。
 *
 * @remarks
 * `noindex` は root layout が置くので、継ぐ画面ならどれでも同じものを名乗ります。入口を選ぶのは
 * **題材に依らない**画面だからです（[README](../README.md)）。
 */
const ENTRY_PATH = "/";

test("索引させない起動では、robots.txt が全経路を断り、サイトマップを知らせない", async ({
  request,
}) => {
  const response = await request.get("/robots.txt");

  expect(response.status()).toBe(200);

  const text = await response.text();

  expect(listRobotsDirectives(text, "Disallow")).toEqual(["/"]);
  expect(listRobotsDirectives(text, "Sitemap")).toEqual([]);
});

test("索引させない起動では、画面が noindex を名乗る", async ({ request }) => {
  const response = await request.get(ENTRY_PATH);

  expect(response.status()).toBe(200);
  expect(isNoindex(await response.text())).toBe(true);
});
