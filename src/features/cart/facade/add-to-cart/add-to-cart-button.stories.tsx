import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { mocked, userEvent, within } from "storybook/test";

import { getDefaultErrorMeta } from "@/errors/error-catalog";
import { ErrorKind } from "@/errors/error-kind";
import { failedActionState } from "@/model/action-state";
import { EARPHONE_LINE } from "../../cart.fixture";
import { addToCartAction } from "./add-to-cart";
import { AddToCartButton } from "./add-to-cart-button";

const meta = {
  title: "Features/Cart/AddToCartButton",
  component: AddToCartButton,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: [
          "商品をカートへ入れる操作です。**カートの中身はバックエンドが持ち**、入った結果は同じ往復で描き直される脇の領域と header の点数に現れます。",
          "**押した時点でカートを開きます** —— 結果を待つと、往復のあいだ何も起きていないように見えます。",
          "在庫が無い商品は押せません。",
        ].join(""),
      },
    },
  },
  args: { productId: EARPHONE_LINE.productId, stockQuantity: 12 },
} satisfies Meta<typeof AddToCartButton>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 詳細の画面での姿。主操作として幅を占め、大きく出す。 */
export const Detail: Story = {};

/** 一覧の 1 件ぶんの枠での姿。他の情報と並ぶため内容の幅に収める。 */
export const List: Story = {
  args: { placement: "list" },
};

/** 在庫が無い商品。押せない。 */
export const OutOfStock: Story = {
  args: { stockQuantity: 0 },
};

/**
 * 入れられなかった状態。理由はこのボタンの下に出る。
 *
 * @remarks
 * 送信先は Server Action で、カタログでは差し替えてあります。失敗は props では作れないため、
 * 戻り値の側から作ります。
 */
export const Failed: Story = {
  beforeEach: () => {
    mocked(addToCartAction).mockResolvedValue(
      failedActionState({ formError: getDefaultErrorMeta(ErrorKind.UNAVAILABLE).message }),
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole("button", { name: /カートに追加/ }));
    await canvas.findByText("カートに追加できませんでした");
  },
};
