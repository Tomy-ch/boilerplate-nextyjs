import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";

import type { FieldRegistration } from "../../use-profile-fields";
import { PostalCodeField } from "./postal-code-field";

/** `useProfileFields` が組む配線の最小形。カタログでは受け取るだけで何も起こさない。 */
const REGISTRATION: FieldRegistration = {
  name: "postalCode",
  onBlur: fn(async () => {}),
  onChange: fn(async () => {}),
  onFocus: fn(),
  ref: fn(),
};

const meta = {
  title: "Features/Account/PostalCodeField",
  component: PostalCodeField,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component: [
          "郵便番号の項目です。住所を検索する操作を枠の中に持ちます。**取得中と、補完の機構が使えないと判ったときは押せません** —— 後者は該当なしとは別の状態で、",
          "手入力へ促す文言は呼び出し側の読み上げ領域が出します。",
        ].join(""),
      },
    },
  },
  args: {
    controlId: "profile-postalCode",
    message: undefined,
    onSearch: fn(),
    registration: REGISTRATION,
    required: true,
    searching: false,
    unavailable: false,
  },
  decorators: [(Story) => <div className="max-w-md">{Story()}</div>],
} satisfies Meta<typeof PostalCodeField>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 押せる状態。 */
export const Default: Story = {};

/** 取得の最中。二重に走らせないよう操作を押せなくする。 */
export const Searching: Story = {
  args: { searching: true },
};

/** 補完の機構が使えないと判った状態。該当なしとは分けて、操作そのものを閉じる。 */
export const Unavailable: Story = {
  args: { unavailable: true },
};

/** 検証に落ちた状態。 */
export const Invalid: Story = {
  args: { message: "郵便番号は 7 桁で入力してください。" },
};
