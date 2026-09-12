import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import Link from "next/link";

import { FormFeedback } from "./form-feedback";

const meta = {
  title: "Feedback/FormFeedback",
  component: FormFeedback,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: [
          "Server Action や native form の**送信が終わったあと**の結果を、要約と次の行動として",
          "form の近くに置きます。`variant` が結果の種類を表し、文言と面の色は必ず対応させます。",
          "成功を `destructive` で出すような組み合わせは、色だけを見ている利用者に誤りを伝えます。",
          "結果の判定はこの component が持たず、呼び出し元が決めて渡します。",
          "一時的な通知で足りる場合は `Toaster`、入力欄ごとの誤りは `FieldError`、",
          "form 全体の検証エラーの一覧は `FormValidationSummary` を使います。",
        ].join(""),
      },
    },
  },
} satisfies Meta<typeof FormFeedback>;
export default meta;
type Story = StoryObj<typeof meta>;

/** 既定。成功した結果を伝える。 */
export const Default: Story = {
  args: { title: "保存しました", description: "変更は次の読み込みから反映されます。" },
};

/** 一部だけ通った場合。失敗ではないが、そのままにはできない状態を示す。 */
export const Warning: Story = {
  args: {
    title: "一部だけ保存しました",
    description: "反映できなかった項目は元の値のままです。",
    variant: "warning",
  },
};

/** 失敗した場合。 */
export const Destructive: Story = {
  args: {
    title: "保存できませんでした",
    description: "入力内容を確認して、もう一度送信してください。",
    variant: "destructive",
  },
};

/**
 * リクエスト ID を添える場合。利用者が対処できない失敗で、支援を求める先へ渡す値になる。
 */
export const WithRequestId: Story = {
  args: {
    title: "保存できませんでした",
    description: "時間をおいて再試行してください。",
    requestId: "req_20260803_001",
    variant: "destructive",
  },
};

/** 次の行動へ進む導線を添える場合。要素は children として呼び出し元が渡す。 */
export const WithAction: Story = {
  args: {
    children: <Link href="/">入力内容を確認する</Link>,
    title: "保存できませんでした",
    description: "未入力の項目があります。",
    variant: "destructive",
  },
};
