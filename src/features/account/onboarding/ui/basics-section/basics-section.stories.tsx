import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { userEvent, within } from "storybook/test";

import { idleActionState } from "@/model/action-state";
import type { UserProfile } from "@/model/user/user";
import { PROFILE } from "../../../account.fixture";
import type { ProfileFormState } from "../../../form-state";
import { useProfileFields } from "../../../use-profile-fields";
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
          "登録の、名前と連絡先の段です。名字と名前だけが横に並び、連絡先は 1 列に落ちます。**メールには「認証に使う ID ではない」断りが付きます。",
          "** 検証は focus が外れた時点で走るので、誤りは触れた項目にだけ出ます。",
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
