import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";

import type { FieldRegistration } from "../../use-profile-fields";
import { TextField } from "./text-field";

/** `useProfileFields` が組む配線の最小形。カタログでは受け取るだけで何も起こさない。 */
const REGISTRATION: FieldRegistration = {
  name: "lastName",
  onBlur: fn(async () => {}),
  onChange: fn(async () => {}),
  onFocus: fn(),
  ref: fn(),
};

const meta = {
  title: "Features/Account/TextField",
  component: TextField,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component: [
          "登録情報の 1 行入力です。`useProfileFields` が組んだ props を、そのまま `FormField` と",
          "`Input` へ配るだけの薄い項目です —— 検証も配線もここは持ちません。必須の印・補足・誤りの",
          "文言の置き場は `FormField` が決めます。",
        ].join(""),
      },
    },
  },
  args: {
    controlId: "profile-lastName",
    label: "名字",
    message: undefined,
    registration: REGISTRATION,
    required: true,
  },
  decorators: [(Story) => <div className="max-w-md">{Story()}</div>],
} satisfies Meta<typeof TextField>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 必須の項目。 */
export const Default: Story = {};

/** 任意の項目。空欄のままでよいことを印が示す。 */
export const Optional: Story = {
  args: { controlId: "profile-building", label: "建物名・部屋番号", required: false },
};

/** 補足のある項目。誤りとは別に常時出す。 */
export const WithDescription: Story = {
  args: {
    controlId: "profile-phone",
    label: "電話番号",
    description: "ハイフン無しで入力します。",
    inputMode: "tel",
  },
};

/** 検証に落ちた状態。文言は欄の下に付き、入力欄そのものにも印が付く。 */
export const Invalid: Story = {
  args: { message: "名字を入力してください。" },
};
