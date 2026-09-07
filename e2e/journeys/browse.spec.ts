import { expect, test } from "../lib/test";

/**
 * 商品を探して 1 件へ辿り着くまで。
 *
 * @remarks
 * 画面をまたぐ遷移は story では代替できません。部品単体が緑でも、組み合わせた導線が繋がって
 * いない状態は作れます。
 */

test("トップから一覧へ入り、1 件の詳細まで辿り着く", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("ようこそ");

  await page.getByRole("navigation").getByRole("link", { name: "商品", exact: true }).click();
  // 読み進めた件数は URL へ書き戻される（[0073](../../docs/adr/0073-pagination-fetch-boundary.md)）
  // ため、着いた直後の URL に条件が付く。
  await expect(page).toHaveURL(/\/products(\?|$)/);

  const link = page.getByRole("list", { name: "商品の一覧" }).getByRole("link").first();
  // 遷移先は一覧が組み立てた href そのもの。名前で照合しないのは、モックが口ごとに独立して応答を
  // 組み立てるためで、一覧の 1 件と詳細の 1 件が同じ商品を指す保証は契約の側に無い。
  const href = await link.getAttribute("href");

  await link.click();

  await expect(page).toHaveURL(new RegExp(`${href}$`));
  await expect(page.getByRole("heading", { level: 1 })).not.toBeEmpty();
});

test("絞り込みの条件が URL に残り、開き直しても同じ一覧になる", async ({ page }) => {
  await page.goto(`/products?keyword=${encodeURIComponent("鞄")}`);

  await expect(page.getByRole("searchbox", { name: "商品名で探す" })).toHaveValue("鞄");

  await page.reload();

  await expect(page.getByRole("searchbox", { name: "商品名で探す" })).toHaveValue("鞄");
});

test("脇に絞り込みを常設できる幅では、選んだ時点で一覧へ効く", async ({ page }) => {
  await page.goto("/products");

  const sidebar = page.getByRole("complementary", { name: "絞り込み条件" });

  await sidebar.getByRole("checkbox").first().check();

  // 確定の操作を持たない。選ぶことがそのまま確定になる
  // （`docs/rules.md`「レイアウトと帯」の「脇に常設する領域は `lg` 以上でだけ出す」）。
  await expect(page).toHaveURL(/categoryCodes=/);
  await expect(sidebar.getByRole("checkbox").first()).toBeChecked();
});

test("脇に領域を持てない幅では、overlay で組んだ条件が確定で一覧へ載る", async ({ page }) => {
  // 脇に絞り込みを常設できない幅でだけ overlay が出る
  // （`docs/rules.md`「レイアウトと帯」の「脇に常設する領域は `lg` 以上でだけ出す」）。
  await page.setViewportSize({ width: 720, height: 900 });
  await page.goto("/products");

  await page.getByRole("button", { name: "絞り込み" }).click();

  const sheet = page.getByRole("dialog", { name: "絞り込み" });
  await sheet.getByRole("checkbox").first().check();

  // overlay の中では選んだだけでは効かない。効くのは確定したときだけ。
  await expect(page).not.toHaveURL(/categoryCodes=/);

  await sheet.getByRole("button", { name: /^この条件で見る/ }).click();

  await expect(page).toHaveURL(/categoryCodes=/);
  await expect(sheet).toBeHidden();

  // overlay が積んだ 1 件は結果で差し替わる（`docs/rules.md`「UI 部品と操作」の「overlay の中から
  // 遷移するときは閉じる操作を同時に撃たない」）。積み増すと、この戻る操作が 1 度空振りしてから
  // 条件が外れる。
  await page.goBack();

  await expect(page).not.toHaveURL(/categoryCodes=/);
});

test("存在しない経路が 404 の面になる", async ({ page }) => {
  const response = await page.goto("/この経路は存在しない");

  expect(response?.status()).toBe(404);
});
