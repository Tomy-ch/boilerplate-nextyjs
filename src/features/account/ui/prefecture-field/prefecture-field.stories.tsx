import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";

import { PREFECTURES } from "../../account.fixture";
import type { FieldRegistration } from "../../use-profile-fields";
import { PrefectureField } from "./prefecture-field";

/** `useProfileFields` が組む配線の最小形。カタログでは受け取るだけで何も起こさない。 */
const REGISTRATION: FieldRegistration = {
  name: "prefecture",
  onBlur: fn(async () => {}),
  onChange: fn(async () => {}),
  onFocus: fn(),
  ref: fn(),
};

const meta = {
  title: "Features/Account/PrefectureField",
  component: PrefectureField,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component: [
          "都道府県の項目です。**検索つきの client island を使いません** —— 契約が全 47 件を固定で返す",
          "静的な候補なので、持ち込む理由がありません。入力欄が `SelectNative` になるだけで、",
          "`TextField` と配線の規則は変わりません。",
        ].join(""),
      },
    },
  },
  args: {
    controlId: "profile-prefecture",
    message: undefined,
    prefectures: PREFECTURES,
    registration: REGISTRATION,
    required: true,
  },
  decorators: [(Story) => <div className="max-w-md">{Story()}</div>],
} satisfies Meta<typeof PrefectureField>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 候補が並んだ状態。 */
export const Default: Story = {};

/** 選ばずに送ろうとした状態。 */
export const Invalid: Story = {
  args: { message: "都道府県を選んでください。" },
};
