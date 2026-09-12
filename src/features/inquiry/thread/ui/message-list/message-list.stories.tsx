import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { toConversationDays } from "@/model/inquiry/conversation";

import { HISTORY, LONG_BODY_HISTORY } from "../../../inquiry.fixture";
import { InquiryMessageList } from "./message-list";

const meta = {
  title: "Features/Inquiry/Thread/MessageList",
  component: InquiryMessageList,
  parameters: {
    docs: {
      description: {
        component: [
          "やり取りの並びです。取得も並べ替えも持たず、確定した並びを描くだけです。",
          "自分の発言を右、サポートを左に置き、日付が変わる位置に区切りを挟みます。",
          "送信中の 1 通は確定したものと同じ向き・同じ面で末尾に置くため、届いた瞬間に行が",
          "入れ替わったようには見えません。",
        ].join(""),
      },
    },
  },
  args: { days: toConversationDays(HISTORY.messages), pending: [] },
} satisfies Meta<typeof InquiryMessageList>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 日付をまたぐやり取り。 */
export const Default: Story = {};

/** 送信中の 1 通が末尾に並ぶ。 */
export const Sending: Story = {
  args: { pending: [{ id: "draft-1", body: "追跡番号を教えてください。" }] },
};

/** 長い本文と、区切りの無い連続文字列。 */
export const LongBody: Story = {
  args: { days: toConversationDays(LONG_BODY_HISTORY.messages) },
};

/** まだ 1 通も無い状態。並びとしては空で、案内は画面の側が出す。 */
export const Empty: Story = { args: { days: [] } };
