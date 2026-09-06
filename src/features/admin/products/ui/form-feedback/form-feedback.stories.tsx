import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import Link from "next/link";

import { Button } from "@/components/design-system/action/button/button";
import { failedActionState } from "@/model/action-state";
import { ADMIN_PRODUCT_LIST_PATH } from "../../../paths";
import type { ProductFormState } from "../../form-state";
import { ProductFormFeedback } from "./form-feedback";

const FIELD_ERRORS: ProductFormState = failedActionState({
  formError: "入力内容を確認してください。",
  fieldErrors: {
    name: ["商品名を入力してください。"],
    price: ["価格は数値で入力してください。"],
    categoryId: ["分類を選んでください。"],
  },
});

const FORM_ERROR_ONLY: ProductFormState = failedActionState({
  formError: "他の人がこの商品を更新しました。読み込み直してから、もう一度お試しください。",
});

const meta = {
  title: "Features/Admin/Products/FormFeedback",
  component: ProductFormFeedback,
  parameters: {
    layout: "padded",
    nextjs: { navigation: { pathname: ADMIN_PRODUCT_LIST_PATH } },
    docs: {
      description: {
        component: [
          "送信の結果と、項目ごとの誤りの要約です。**要約と欄ごとの文言は両方出します** —— 項目が多い",
          "フォームでは、欄のそばの文言だけでは「どこがいくつ」誤っているのかを辿れません。要約は全体像と",
          "導線を、欄の文言はその場での指摘を担います。送信そのものの失敗（通信・権限）は要約ではなく",
          "全体の文言が扱います —— 直すべきものが入力の中に無いためです。",
        ].join(""),
      },
    },
  },
  args: {
    state: FIELD_ERRORS,
    idPrefix: "create",
    title: "登録できませんでした",
    dismissed: false,
  },
  decorators: [(Story) => <div className="max-w-2xl">{Story()}</div>],
} satisfies Meta<typeof ProductFormFeedback>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 項目ごとの誤りが返っている状態。要約の各項目は入力欄への link になる。 */
export const FieldErrors: Story = {};

/** 直すべきものが入力の中に無い失敗。要約は空になり、全体の文言だけが出る。 */
export const FormError: Story = {
  args: { state: FORM_ERROR_ONLY },
};

/** 次の行動へ進む要素を添えた状態。版が食い違ったときの読み込み直しなどが入る。 */
export const WithAction: Story = {
  args: {
    state: FORM_ERROR_ONLY,
    children: (
      <Button asChild size="sm" variant="outline">
        <Link href={ADMIN_PRODUCT_LIST_PATH}>一覧へ戻る</Link>
      </Button>
    ),
  },
};
