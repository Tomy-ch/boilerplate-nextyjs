import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { getDefaultErrorMeta } from "@/errors/error-catalog";
import { ErrorKind } from "@/errors/error-kind";
import { failedActionState } from "@/model/action-state";
import type { CartActionState } from "../../actions";
import { CartActionError } from "./action-error";

const UNAVAILABLE: CartActionState = failedActionState({
  formError: getDefaultErrorMeta(ErrorKind.UNAVAILABLE).message,
});

const CONFLICT: CartActionState = failedActionState({
  formError: "在庫が足りないため、数量を変更できませんでした。",
});

const meta = {
  title: "Features/Cart/ActionError",
  component: CartActionError,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component: [
          "カートの操作が失敗したことを、その操作の隣に出します。**成功したときは何も出しません** —— 結果は更新後のカートそのものに現れるためです。",
          "操作ごとに置くのは、どれが通らなかったのかを離れた場所の 1 行では指せないからです。",
        ].join(""),
      },
    },
  },
  args: { state: UNAVAILABLE, title: "数量を変更できませんでした" },
  decorators: [(Story) => <div className="max-w-md">{Story()}</div>],
} satisfies Meta<typeof CartActionError>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 一時的に受け付けられなかった状態。 */
export const Unavailable: Story = {};

/** 在庫の都合で通らなかった状態。見出しは操作ごとに呼び出し元が渡す。 */
export const Conflicted: Story = {
  args: { state: CONFLICT, title: "数量を変更できませんでした" },
};

/** 取り除く操作が通らなかった状態。 */
export const RemoveFailed: Story = {
  args: { title: "商品を取り除けませんでした" },
};
