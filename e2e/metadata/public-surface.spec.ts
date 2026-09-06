// 索引させる設定（`SITE_INDEXABLE=on`）で build して起動したアプリの公開面を、クローラが読む形で
// 確かめる。何を見るか・なぜ別の build かは `e2e/README.md`「索引させる側だけは別の build で回る」。
//
// **`e2e/lib/test.ts` の test は使わない。** 理由は同じ節にあるが、ここで開くのは画面ではなく応答
// なので、見張りも要らない。
import { expect, test } from "@playwright/test";

import {
  findCanonicalHref,
  findOpenGraphContent,
  findOpenGraphImage,
  isNoindex,
  isSameLocation,
  listIconHrefs,
  listRobotsDirectives,
  listSitemapLocations,
} from "../lib/public-surface";

/** 起動側が `SITE_PUBLIC_ORIGIN` に渡した値と同じ。canonical と sitemap はこれを土台に組まれる。 */
const PUBLIC_ORIGIN = process.env["E2E_BASE_URL"] ?? "http://127.0.0.1:3000";

/**
 * アイコンと OG 画像を名乗る画面。
 *
 * @remarks
 * どちらも root layout の宣言を継ぐので、継ぐ画面ならどれでも同じものを名乗ります。入口を選ぶのは
 * **題材に依らず、しかも索引を断らない**唯一の画面だからです —— ログインと停止画面は自分で
 * `noindex` を名乗るため、サイトマップが挙げる公開面にはなりません。
 */
const ENTRY_PATH = "/";

test("robots.txt が巡回を許し、サイトマップの場所を知らせる", async ({ request }) => {
  const response = await request.get("/robots.txt");

  expect(response.status()).toBe(200);

  const text = await response.text();

  expect(listRobotsDirectives(text, "Allow")).toContain("/");
  expect(listRobotsDirectives(text, "Disallow")).not.toContain("/");
  expect(listRobotsDirectives(text, "Sitemap")).toEqual([`${PUBLIC_ORIGIN}/sitemap.xml`]);
});

test("sitemap.xml が挙げる URL は、すべて外から見た origin の下にある", async ({ request }) => {
  const response = await request.get("/sitemap.xml");

  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("xml");

  for (const location of listSitemapLocations(await response.text())) {
    expect(location.startsWith(`${PUBLIC_ORIGIN}/`)).toBe(true);
  }
});

test("sitemap.xml が挙げる URL は実在し、自分を正規 URL として名乗り、索引を断らない", async ({
  request,
}) => {
  const locations = listSitemapLocations(await (await request.get("/sitemap.xml")).text());

  for (const location of locations) {
    const response = await request.get(location);

    expect(response.status(), location).toBe(200);

    const html = await response.text();

    const canonical = findCanonicalHref(html);

    expect(canonical, location).not.toBeNull();
    expect(isSameLocation(canonical ?? "", location), `${location} → ${canonical}`).toBe(true);
    expect(isNoindex(html), location).toBe(false);
  }
});

test("画面が名乗る OG 画像は、実際に絵として返る", async ({ request }) => {
  const html = await (await request.get(ENTRY_PATH)).text();
  const image = findOpenGraphImage(html);

  expect(image).not.toBeNull();
  expect(findOpenGraphContent(html, "og:image:alt")).not.toBeNull();
  expect((image ?? "").startsWith(`${PUBLIC_ORIGIN}/`)).toBe(true);

  const response = await request.get(image ?? "");

  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toMatch(/^image\//);
  expect((await response.body()).byteLength).toBeGreaterThan(0);
});

test("画面が名乗るアイコンは、すべて絵として返る", async ({ request }) => {
  const html = await (await request.get(ENTRY_PATH)).text();
  const hrefs = listIconHrefs(html);

  expect(hrefs.length).toBeGreaterThan(0);

  for (const href of hrefs) {
    const response = await request.get(href);

    expect(response.status(), href).toBe(200);
    expect(response.headers()["content-type"], href).toMatch(/^image\//);
  }
});
