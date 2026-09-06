import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { userEvent, within } from "storybook/test";

import { failedActionState, idleActionState } from "@/model/action-state";
import { AUTHORIZE_ERROR } from "../../authorize-error";
import type { IssueDevSessionAction } from "../../form-state";
import { DevSessionForm } from "./session-form";

/** canvas では発行しない。押した先で何も起きないことを、待ち続けない形で示す。 */
const idle: IssueDevSessionAction = () => Promise.resolve(idleActionState());

/** 指定が読めずに弾かれた状態を作る。 */
const rejecting: IssueDevSessionAction = () =>
  Promise.resolve(
    failedActionState({
      formError: "指定を確認してください。",
      fieldErrors: { expiresInSeconds: ["1 以上の整数で入力してください。"] },
    }),
  );

const meta = {
  title: "Features/DevSession/SessionForm",
  component: DevSessionForm,
  parameters: {
    layout: "padded",
    docs: {
      story: { inline: false, iframeHeight: 900 },
      description: {
        component: [
          "IdP を通さずに session を発行する指定です。**「API 接続モード」が入っていると、トークンは",
          "こちらで取ります** —— 実物の API へ繋いでいる間、検証されない前提のトークンは 401 で弾かれ、",
          "それを避けるための手作業（別の口を叩いて写す）は写し間違いと期限切れとして現れます。",
          "**貼る欄は、入っていないときだけ出します** —— 両方が同時に見えていると、どちらが効くのかを",
          "見た目から決められません。**認可の往復の途中では素の form 送信**になり、送信中の表示と項目",
          "ごとの理由はそのとき出ません。",
        ].join(""),
      },
    },
  },
  args: {
    returnUrl: "/",
    authorization: null,
    action: idle,
    connectsLiveApi: false,
    defaultIssuer: "http://localhost:8080/realms/dev",
  },
  decorators: [(Story) => <div className="max-w-xl">{Story()}</div>],
} satisfies Meta<typeof DevSessionForm>;

export default meta;
type Story = StoryObj<typeof meta>;

/** モックへ繋いでいる状態。トークンを貼る欄が出る。 */
export const Mocked: Story = {};

/** 実物の API へ繋いでいる状態。既定で取りに行くので、貼る欄の代わりに接続先が出る。 */
export const LiveApi: Story = {
  args: { connectsLiveApi: true },
};

/** モックへ繋いだまま、取りに行く側へ切り替えた状態。繋ぎ先と違う組み合わせも試せる。 */
export const IssueTokenToggled: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByLabelText("API 接続モード"));
  },
};

/** 指定が読めずに弾かれた状態。項目ごとの理由と、全体の 1 文が両方出る。 */
export const Rejected: Story = {
  args: { action: rejecting },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole("button", { name: "この内容で入る" }));
    await canvas.findByText("session を発行できませんでした");
  },
};

/** 認可の往復の途中で開かれ、IdP からトークンを取れなかった状態。 */
export const AuthorizationFailed: Story = {
  args: {
    authorization: {
      state: "0195f0c2-0000-7000-d000-000000000001",
      notice: AUTHORIZE_ERROR.UNAVAILABLE,
    },
  },
};
