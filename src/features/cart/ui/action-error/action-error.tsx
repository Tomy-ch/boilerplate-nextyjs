import { FormFeedback } from "@/components/app-starter/form-feedback/form-feedback";
import { withPartSpan } from "@/observability/render-span";
import type { CartActionState } from "../../actions";

/** `CartActionError` の props。 */
export type CartActionErrorProps = {
  /** 直前の操作の結果。 */
  state: CartActionState;
  /** 何ができなかったかを示す見出し。 */
  title: string;
};

/**
 * カートの操作が失敗したことを、その操作の隣に出す。
 *
 * @remarks
 * 成功したときは何も出しません。結果は更新後のカートそのものに現れるため、それ以上の通知は画面を
 * 騒がせるだけです。
 *
 * 操作ごとに置くのは、カートに操作が複数あり、どれが通らなかったのかを離れた場所の 1 行では
 * 指せないためです。
 */
export const CartActionError = withPartSpan(
  "features/cart/ui/action-error/action-error",
  ({ state, title }: CartActionErrorProps) => {
    if (state.status !== "error" || state.formError === null) {
      return null;
    }

    return <FormFeedback description={state.formError} title={title} variant="destructive" />;
  },
);
