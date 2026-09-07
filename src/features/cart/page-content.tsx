import { getMyCart } from "@/adapters/server/api/cart";
import { withScreenSpan } from "@/observability/render-span";
import { CartView } from "./view";

/**
 * カートの取得と組み立て。
 *
 * @remarks
 * 取得のたびに明細ごとの再評価が入ります。前に開いたときから買えなくなった明細や値の変わった
 * 明細は、この取得の結果として現れます。
 *
 * 未ログインでも取得できます。主体はゲストの識別子で、持っていない利用者には空のカートが返ります。
 *
 * 失敗は route の `error` 境界が受けます。
 */
export const CartPageContent = withScreenSpan("features/cart/page-content", async () => {
  return <CartView cart={await getMyCart()} />;
});
