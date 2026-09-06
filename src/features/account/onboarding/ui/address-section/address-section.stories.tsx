import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { userEvent, within } from "storybook/test";

import { idleActionState } from "@/model/action-state";
import type { UserProfile } from "@/model/user/user";
import { PREFECTURES, PROFILE } from "../../../account.fixture";
import { useProfileFields } from "../../../use-profile-fields";
import { RegistrationAddressSection } from "./address-section";

/** 入力欄の配線と補完を実物のまま通す。差し替えると、確かめたい補完そのものが動かない。 */
function LiveAddressSection({ profile }: { profile: UserProfile | null }) {
  const fields = useProfileFields(profile, idleActionState());

  return <RegistrationAddressSection fields={fields} prefectures={PREFECTURES} />;
}

const meta = {
  title: "Features/Account/Onboarding/AddressSection",
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component: [
          "登録の、届け先の段です。**郵便番号から住所を補完できます** —— 起きたことは入力欄の上の読み上げ領域に出ます。",
          "カタログで引けるのは `150-0001`（町域が割れる）と `220-0012`（町域まで定まる）で、それ以外は該当なしになります。",
        ].join(""),
      },
    },
  },
  render: () => <LiveAddressSection profile={null} />,
  decorators: [(Story) => <div className="max-w-2xl">{Story()}</div>],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/** 登録が無いので、この段のどの項目も空で開く。 */
export const Empty: Story = {};

/** 認証の側から届いた住所が入っている状態。 */
export const Prefilled: Story = {
  render: () => <LiveAddressSection profile={PROFILE} />,
};

/** 郵便番号から補完した状態。起きたことは読み上げ領域の文言が伝える。 */
export const Completed: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.type(canvas.getByLabelText("郵便番号"), "220-0012");
    await userEvent.click(canvas.getByRole("button", { name: "住所を検索" }));
    await canvas.findByText(/補完しました|見つかりませんでした/);
  },
};

/** 該当が無かった状態。手入力へ促す文言が読み上げ領域に出る。 */
export const NotFound: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.type(canvas.getByLabelText("郵便番号"), "999-9999");
    await userEvent.click(canvas.getByRole("button", { name: "住所を検索" }));
    await canvas.findByText(/補完しました|見つかりませんでした/);
  },
};
