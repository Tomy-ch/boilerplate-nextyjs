import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { ConnectionStatus } from "./connection-status";
import { CONNECTION_STATUS } from "./connection-status.definition";

const meta = {
  title: "Status/ConnectionStatus",
  component: ConnectionStatus,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: [
          "継続的な受信がいまどうなっているかを示す短いラベルです。通信そのものは持たず、",
          "渡された状態に対応する文言を出すだけです。**出したままにする前提の部品**で、",
          "切れている間だけ出すと「出ていない」が 2 通りに読めます。",
          "色は文言に重ねているだけで、色だけで区別させません。",
        ].join(""),
      },
    },
  },
  args: { status: CONNECTION_STATUS.RECEIVING },
} satisfies Meta<typeof ConnectionStatus>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 受け取れている。 */
export const Receiving: Story = {};

/** 繋ぎにいっている。 */
export const Connecting: Story = { args: { status: CONNECTION_STATUS.CONNECTING } };

/** 切れたので繋ぎ直している。 */
export const Reconnecting: Story = { args: { status: CONNECTION_STATUS.RECONNECTING } };

/** 回線が無い。購読の状態より先にこちらを出す。 */
export const Offline: Story = { args: { status: CONNECTION_STATUS.OFFLINE } };

/** 受け取る対象がまだ無い。繋ぎにいっていないことを、接続中と言い分ける。 */
export const Suspended: Story = { args: { status: CONNECTION_STATUS.SUSPENDED } };

/** 打ち切った。繋ぎ直しても同じ結果になる。 */
export const Halted: Story = { args: { status: CONNECTION_STATUS.HALTED } };

/** 資格が切れた。入り直せば再開できる。 */
export const Expired: Story = { args: { status: CONNECTION_STATUS.EXPIRED } };
