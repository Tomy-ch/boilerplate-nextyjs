import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { ProductContactButton } from "./contact-button";

const meta = {
  title: "Features/Products/List/ContactButton",
  component: ProductContactButton,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: [
          "在庫の無い商品について問い合わせる入口です。押すとサポートとのやり取りの画面へ移ります。",
          "どの商品を見ていたかは引き継ぎません —— 問い合わせは利用者ごとに 1 件で、商品ごとの筋を",
          "持たないためです。",
        ].join(""),
      },
    },
  },
} satisfies Meta<typeof ProductContactButton>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 押すと問い合わせの画面へ移る。 */
export const Default: Story = {};
