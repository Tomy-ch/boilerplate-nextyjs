import { readShellCart } from "../../shell-cart";
import { CartHeaderAction } from "../header-action/header-action";
import { CartPanel } from "../panel/panel";

/**
 * 外枠の header に出すカートの入口。
 *
 * @remarks
 * **取得をこの中に閉じます。** 外枠が cookie を読むと、その器を通る画面がすべて動的描画になり、
 * 静的な殻を持てなくなります（[0041](../../../../../docs/adr/0041-cache-components-decision.md)）。
 * 穴の内側で読めば、殻は主体を知らないまま固められます。
 *
 * **読めなかったときは何も出しません。** 判断は `readShellCart` が持ち、ここはその結果を置くだけです。
 *
 * カタログには置けません。取得が server の側にあり、ブラウザで描く面には持ち込めないためです
 * （[0091](../../../../../docs/adr/0091-test-verification-methods.md) の async RSC）。中身の
 * `CartHeaderAction` / `CartPanel` はそれぞれ story を持ちます。
 */
export async function CartHeaderSlot() {
  const cart = await readShellCart();

  return cart === null ? null : <CartHeaderAction cart={cart} />;
}

/**
 * 外枠の脇に出すカートの中身。
 *
 * @remarks
 * 取得を閉じる理由は {@link CartHeaderSlot} と同じです。header の入口と同じ要求を読むため、
 * 2 つの穴が並んでも取得は 1 回です（`getMyCart` は `cache()` で畳まれます）。
 */
export async function CartPanelSlot() {
  const cart = await readShellCart();

  return cart === null ? null : <CartPanel cart={cart} />;
}
