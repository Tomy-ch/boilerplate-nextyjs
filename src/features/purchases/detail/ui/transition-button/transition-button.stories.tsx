import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn, userEvent, within } from "storybook/test";

import { ErrorKind } from "@/errors/error-kind";
import { failedActionState, idleActionState } from "@/model/action-state";
import { neverSettlingAction } from "~catalog/lib/pending-action";
import type { PurchaseTransitionState } from "../../../form-state";
import { PURCHASE_TRANSITION } from "../../available-transitions";
import { PRESENTATIONS } from "../transitions/presentation";
import { PurchaseTransitionButton } from "./transition-button";

const CANCEL = PRESENTATIONS[PURCHASE_TRANSITION.CANCEL];

const IDLE: PurchaseTransitionState = idleActionState();

const CONFLICTED: PurchaseTransitionState = failedActionState({
  formError: "この注文はすでに発送されているため、キャンセルできません。",
  kind: ErrorKind.CONFLICT,
});

const UNAVAILABLE: PurchaseTransitionState = failedActionState({
  formError: "ただいま処理できません。時間をおいて再試行してください。",
  kind: ErrorKind.UNAVAILABLE,
});

/** 確認を開く。dialog は portal で `body` の側へ出るため、canvas の内側からは辿れない。 */
async function openConfirm(canvasElement: HTMLElement, label: string) {
  await userEvent.click(within(canvasElement).getByRole("button", { name: label }));
  await within(document.body).findByRole("alertdialog");
}

const meta = {
  title: "Features/Purchases/TransitionButton",
  component: PurchaseTransitionButton,
  parameters: {
    layout: "centered",
    docs: {
      story: { inline: false, iframeHeight: 520 },
      description: {
        component: [
          "購入の状態を 1 つ進める操作です。**戻せない操作なので確認を挟み**、確認は form の submit で行います（送信中の表示を利用者が見ている場所に出すためです）。",
          "**開く操作と確定する操作で見た目を分けます** —— 開く側は並びの中での主従、確定する側は起きることの重さです。",
          "**成立したことは伝えません** —— 進んだ購入ではこの操作ごと消えます。",
        ].join(""),
      },
    },
  },
  args: {
    purchaseCode: "0195f0c2-0000-7000-9000-000000000001",
    formAction: fn(),
    label: CANCEL.label,
    pendingLabel: CANCEL.pendingLabel,
    confirmTitle: CANCEL.confirmTitle,
    confirmDescription: CANCEL.confirmDescription,
    state: IDLE,
    failureTitle: CANCEL.failureTitle,
    reloadHref: "/purchases/0195f0c2-0000-7000-9000-000000000001",
    variant: CANCEL.variant,
    confirmVariant: CANCEL.confirmVariant,
  },
} satisfies Meta<typeof PurchaseTransitionButton>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 閉じている状態。並んだ操作の中では縁だけにして、進む操作に前を譲る。 */
export const Closed: Story = {};

/** 確認を開いた状態。戻せないことは確認の中の実行ボタンが赤で伝える。 */
export const Confirming: Story = {
  play: async ({ canvasElement }) => {
    await openConfirm(canvasElement, CANCEL.label);
  },
};

/** 送信中。確認は開いたまま留まり、実行ボタンが待っていることを示す。 */
export const Pending: Story = {
  args: { formAction: neverSettlingAction },
  play: async ({ canvasElement }) => {
    await openConfirm(canvasElement, CANCEL.label);
    await userEvent.click(
      within(await within(document.body).findByRole("alertdialog")).getByRole("button", {
        name: CANCEL.label,
      }),
    );
  },
};

/** 状態が変わって拒まれた状態。確認の中に理由が出て、読み込み直す導線が添う。 */
export const Conflicted: Story = {
  args: { state: CONFLICTED },
  play: async ({ canvasElement }) => {
    await openConfirm(canvasElement, CANCEL.label);
  },
};

/** 一時的に受け付けられなかった状態。読み込み直しても変わらないので、導線は添えない。 */
export const Unavailable: Story = {
  args: { state: UNAVAILABLE },
  play: async ({ canvasElement }) => {
    await openConfirm(canvasElement, CANCEL.label);
  },
};
