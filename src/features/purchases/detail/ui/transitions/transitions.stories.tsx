import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { mocked, userEvent, within } from "storybook/test";

import { ErrorKind } from "@/errors/error-kind";
import { failedActionState } from "@/model/action-state";
import { cancelPurchaseAction } from "../../../actions";
import {
  DELIVERED_PURCHASE,
  PAID_PURCHASE,
  PURCHASE_DETAIL,
} from "../../../facade/purchase.fixture";
import { PurchaseTransitions } from "./transitions";

/** 確認を開いて、その中の実行まで押す。dialog は portal で `body` の側へ出る。 */
function confirm(label: string) {
  return async ({ canvasElement }: { canvasElement: HTMLElement }): Promise<void> => {
    const body = within(document.body);

    await userEvent.click(within(canvasElement).getByRole("button", { name: label }));

    const dialog = await body.findByRole("alertdialog");

    await userEvent.click(within(dialog).getByRole("button", { name: label }));
  };
}

const meta = {
  title: "Features/Purchases/Detail/Transitions",
  component: PurchaseTransitions,
  parameters: {
    layout: "padded",
    docs: {
      story: { inline: false, iframeHeight: 480 },
      description: {
        component: [
          "その購入にいまできる操作と、成立の知らせです。**成立の知らせをこの段が持ちます** —— 成立すると画面は取り直され、押した操作はその場から消えるためです。",
          "**通らなかったことは確認の中が伝えます。** 何も送っておらず出す操作も無い購入では、余白ごと現れません。",
        ].join(""),
      },
    },
  },
  args: { purchase: PURCHASE_DETAIL },
  decorators: [(Story) => <div className="max-w-2xl">{Story()}</div>],
} satisfies Meta<typeof PurchaseTransitions>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 支払い前。支払うと取り消すの両方ができる。取り消しは縁だけにして進む操作に前を譲る。 */
export const Unprocessed: Story = {};

/** 支払い済み。発送されるまでは取り消せる。 */
export const Paid: Story = {
  args: { purchase: PAID_PURCHASE },
};

/** 配達済み。できる操作が無く、まだ何も送っていないので段ごと現れない。 */
export const None: Story = {
  args: { purchase: DELIVERED_PURCHASE },
};

/** 取り消しが成立した状態。確認は閉じ、知らせだけが残る。 */
export const Canceled: Story = {
  play: confirm("キャンセルする"),
};

/**
 * 状態が変わっていて取り消せなかった状態。確認は開いたままで、読み込み直す導線が添う。
 *
 * @remarks
 * 送信先は Server Action で、カタログでは差し替えてあります。失敗は props では作れないため、
 * 戻り値の側から作ります。
 */
export const CancelConflicted: Story = {
  beforeEach: () => {
    mocked(cancelPurchaseAction).mockResolvedValue(
      failedActionState({
        formError: "この注文はすでに発送されているため、キャンセルできません。",
        kind: ErrorKind.CONFLICT,
      }),
    );
  },
  play: confirm("キャンセルする"),
};
