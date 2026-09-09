import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { mocked, userEvent, within } from "storybook/test";

import { getDefaultErrorMeta } from "@/errors/error-catalog";
import { ErrorKind } from "@/errors/error-kind";
import { failedActionState } from "@/model/action-state";

import { setCartItemQuantityAction } from "../../actions";
import { EARPHONE_LINE } from "../../cart.fixture";
import { CartQuantityStepper } from "./quantity-stepper";

const meta = {
  title: "Features/Cart/QuantityStepper",
  component: CartQuantityStepper,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: [
          "明細 1 行の数量を動かす操作です。押した先の数量をそのまま送るため、",
          "増減の計算を client の状態として持ちません。",
          "**1 から減らす操作はありません。** 数量 0 は契約の範囲外で、行を無くすのは削除の操作です。",
        ].join(""),
      },
    },
  },
  args: { label: EARPHONE_LINE.name ?? "", productId: EARPHONE_LINE.productId },
} satisfies Meta<typeof CartQuantityStepper>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 既定。減らす・増やすの両方が使える。 */
export const Default: Story = {
  args: { quantity: 3 },
};

/** 数量が 1 の場合。これ以上減らせないため、減らす操作を押せなくする。 */
export const AtMinimum: Story = {
  args: { quantity: 1 },
};

/** 在庫が足りない場合。今買える上限で増やす操作を押せなくする。 */
export const AtAvailableMax: Story = {
  args: { max: 3, quantity: 3 },
};

/**
 * 変更が通らなかった場合。操作の隣に、何ができなかったかと理由が出る。
 *
 * @remarks
 * 送信先は Server Action で、カタログでは差し替えてあります。失敗は props では作れないため、
 * 戻り値の側から作ります。
 */
export const Failed: Story = {
  args: { quantity: 3 },
  beforeEach: () => {
    mocked(setCartItemQuantityAction).mockResolvedValue(
      failedActionState({ formError: getDefaultErrorMeta(ErrorKind.UNAVAILABLE).message }),
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(
      canvas.getByRole("button", { name: `${EARPHONE_LINE.name} を 1 つ増やす` }),
    );
    await canvas.findByText("数量を変更できませんでした");
  },
};
