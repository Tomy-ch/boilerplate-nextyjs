import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { idleActionState } from "@/model/action-state";
import type { UserProfile } from "@/model/user/user";
import { PROFILE } from "../../../account.fixture";
import { useProfileFields } from "../../../use-profile-fields";
import { RegistrationConfirmSection } from "./confirm-section";

/** 値は購読して読む部品なので、本物の control を通す。 */
function LiveConfirmSection({ profile }: { profile: UserProfile | null }) {
  const fields = useProfileFields(profile, idleActionState());

  return <RegistrationConfirmSection control={fields.control} />;
}

const meta = {
  title: "Features/Account/Onboarding/ConfirmSection",
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component: [
          "送る前に入力した内容を読み返す一覧です。**入力欄を持たず**、直すのは前の段へ戻って行います。",
          "空欄は「未入力」として出ます。値は購読して読むので、前の段で直した内容がそのまま映ります。",
        ].join(""),
      },
    },
  },
  render: () => <LiveConfirmSection profile={PROFILE} />,
  decorators: [(Story) => <div className="max-w-2xl">{Story()}</div>],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/** 一通り埋まっている状態。 */
export const Filled: Story = {};

/** 任意の項目が空のままの状態。空欄は「未入力」として見せる。 */
export const WithEmptyFields: Story = {
  render: () => <LiveConfirmSection profile={null} />,
};
