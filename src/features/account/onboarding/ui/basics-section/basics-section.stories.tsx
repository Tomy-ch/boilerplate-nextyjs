import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { userEvent, within } from "storybook/test";

import { idleActionState } from "@/model/action-state";
import type { UserProfile } from "@/model/user/user";
import { PROFILE } from "../../../account.fixture";
import type { ProfileFormState } from "../../../form-state";
import { useProfileFields } from "../../../use-profile-fields";
import type { RegistrationBasicsSectionProps } from "./basics-section";
import { RegistrationBasicsSection } from "./basics-section";

/**
 * 入力欄の配線を実物のまま渡す。差し替えると label と control の対応まで偽物になり、
 * カタログで確かめられるものが無くなる。
 */
function LiveBasicsSection({
  profile,
  state,
}: {
  profile: UserProfile | null;
  state: ProfileFormState;
}) {
  const fields = useProfileFields(profile, state);

  return <RegistrationBasicsSection fields={fields} />;
}

const meta = {
  title: "Features/Account/RegistrationBasicsSection",
  component: RegistrationBasicsSection,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component: [
          "登録の、名前と連絡先の段です。**自分が段であることを知りません** —— 表示・非表示と focus の",
          "移動は、これを並べる器が持ちます。**連絡先のメールには補足を添えます** —— 認証を済ませた直後に",
          "この欄へ辿り着くため、ここで入れた宛先でログインできると読めてしまうからです。名字と名前だけを",
          "横に並べるのは、どちらも短く、続けて 1 つの氏名として読むためです。",
        ].join(""),
      },
    },
  },
  render: () => <LiveBasicsSection profile={null} state={idleActionState()} />,
  decorators: [(Story) => <div className="max-w-2xl">{Story()}</div>],
} satisfies Meta<typeof RegistrationBasicsSection>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 登録が無いので、この段のどの項目も空で開く。 */
export const Empty: Story = {};

/** 認証の側から届いた値が入っている状態。 */
export const Prefilled: Story = {
  render: () => <LiveBasicsSection profile={PROFILE} state={idleActionState()} />,
};

/** 必須の欄に触れて空のまま離れた状態。検証は focus が外れた時点で走る。 */
export const Invalid: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByLabelText("名字"));
    await userEvent.tab();
    await userEvent.click(canvas.getByLabelText("メールアドレス"));
    await userEvent.tab();
    await canvas.findAllByRole("alert");
  },
};
