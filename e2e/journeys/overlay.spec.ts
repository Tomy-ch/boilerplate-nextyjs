import { expect, test } from "../lib/test";
import { loadBreakpoints, VIEWPORT_HEIGHT } from "../lib/viewports";

/**
 * 被せた面から画面を移す。
 *
 * @remarks
 * 背面を塞ぐ overlay は開いた時点で履歴を 1 つ積み、戻る操作でそれを消して自分だけを閉じます。
 * **この積み下ろしと、面の中から始まる画面遷移は同じ履歴を奪い合います。** 閉じる動きが先に走ると
 * 遷移が打ち消され、押しても移らない導線ができます。
 *
 * **単体テストでは捕まりません。** 競合するのは実ブラウザの履歴操作どうしで、jsdom には再現する
 * 相手が居ません。ここが唯一の検査地点です。
 *
 * 題材の画面を使いますが、**見ているのは題材ではなく overlay と履歴の関係**です。ジャーニーを
 * 自分の画面へ書き換えるときも、この観点は残してください（[README](../README.md)）。
 */

/** 被せる姿の入口が出る幅。脇に常設できる幅では、そもそもこの面が無い。 */
const NARROW_WIDTH = (loadBreakpoints().get("md") as number) - 1;

/**
 * 面を開いた画面と、その中から選ぶ導線。
 *
 * @remarks
 * 行き先には**自分で URL を書き換えない画面**を選びます。一覧のように状態を URL へ載せる画面は
 * 着いた直後に履歴を 1 つ積むため、戻る操作の判定がその 1 件に吸われます。
 */
const ORIGIN_PATH = "/about";
const DESTINATION = { label: "マイページ", path: "/mypage" };

test.use({ viewport: { width: NARROW_WIDTH, height: VIEWPORT_HEIGHT } });

test("被せた面の中の導線が、その画面へ移る", async ({ page, signIn }) => {
  await signIn();
  await page.goto(ORIGIN_PATH);

  await page.getByRole("button", { name: "メニューを開く" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();

  await page.getByRole("link", { name: DESTINATION.label }).click();

  await expect(page).toHaveURL(DESTINATION.path);
  await expect(page.getByRole("dialog")).toBeHidden();
});

test("移ったあとの戻る操作が、面を開く前の画面へ帰る", async ({ page, signIn }) => {
  await signIn();
  await page.goto(ORIGIN_PATH);

  await page.getByRole("button", { name: "メニューを開く" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("link", { name: DESTINATION.label }).click();
  await expect(page).toHaveURL(DESTINATION.path);

  // 1 回で帰ること自体が判定である。面が積んだ 1 件が残っていると、ここが同じ URL の
  // 何も起きない 1 回になり、元の画面へは 2 回目でしか帰れない。
  await page.goBack();

  await expect(page).toHaveURL(ORIGIN_PATH);
});
