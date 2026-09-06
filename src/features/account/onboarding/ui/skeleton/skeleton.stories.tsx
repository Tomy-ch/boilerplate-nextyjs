import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { OnboardingSkeleton } from "./skeleton";

const meta = {
  title: "Features/Account/OnboardingSkeleton",
  component: OnboardingSkeleton,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component: [
          "登録の待機表示です。**最初の段階だけを象ります** —— 段階に分けた入力は一度に 1 つしか現れないためです。",
          "`Suspense` の fallback なので、取得後の画面を撮る E2E には現れません。",
        ].join(""),
      },
    },
  },
} satisfies Meta<typeof OnboardingSkeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 待機の枠。 */
export const Default: Story = {
  globals: { viewport: { value: "desktop", isRotated: false } },
};

/** 狭い段。 */
export const Mobile: Story = {
  globals: { viewport: { value: "mobile2", isRotated: false } },
};
