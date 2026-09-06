import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { userEvent, within } from "storybook/test";

import { failedActionState, idleActionState } from "@/model/action-state";
import { SESSION_ROLE, type Session } from "@/model/session";
import type { DiscardDevSessionAction } from "../../form-state";
import { CurrentSession } from "./current-session";

const SESSION: Session = {
  userId: "0195f0c2-0000-7000-c000-000000000001",
  role: SESSION_ROLE.user,
  expiresAt: new Date("2026-09-06T12:00:00+09:00"),
};

/** canvas では捨てない。押した先で何も起きないことを、待ち続けない形で示す。 */
const idle: DiscardDevSessionAction = () => Promise.resolve(idleActionState());

/** 捨てられなかった状態を作る。 */
const rejecting: DiscardDevSessionAction = () =>
  Promise.resolve(failedActionState({ formError: "いま持っている session が見つかりません。" }));

const meta = {
  title: "Features/DevSession/CurrentSession",
  component: CurrentSession,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component: [
          "いま持っている session と、それを捨てる操作です。**Access Token は出しません** —— ブラウザから観測できないことが session をこの形にしている理由そのものだからです。",
          "捨てたあとも画面に留まり、結果はこの表示に現れます。",
        ].join(""),
      },
    },
  },
  args: { session: SESSION, action: idle },
  decorators: [(Story) => <div className="max-w-md">{Story()}</div>],
} satisfies Meta<typeof CurrentSession>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 一般利用者として持っている状態。 */
export const User: Story = {};

/** 管理者として持っている状態。役割の違いはそのまま値に出る。 */
export const Admin: Story = {
  args: { session: { ...SESSION, role: SESSION_ROLE.admin } },
};

/** 持っていない状態。捨てる操作も出さない。 */
export const None: Story = {
  args: { session: null },
};

/** 捨てられなかった状態。理由は操作の隣に出る。 */
export const DiscardFailed: Story = {
  args: { action: rejecting },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole("button", { name: "session を捨てる" }));
    await canvas.findByText("session を捨てられませんでした");
  },
};
