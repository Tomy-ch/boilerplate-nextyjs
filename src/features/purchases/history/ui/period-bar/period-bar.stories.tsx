import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { ReactElement } from "react";

import { PurchaseFilterDraftProvider } from "../../filter-draft";
import type { PeriodSelection } from "../../period";
import { PurchasePeriodBar } from "./period-bar";

/** 下書きの供給で包む。効いている期間は story ごとに差し替える。 */
function withDraft(
  Story: () => ReactElement,
  context: { parameters: { period?: PeriodSelection } },
) {
  return (
    <PurchaseFilterDraftProvider period={context.parameters.period ?? { kind: "all" }}>
      <Story />
    </PurchaseFilterDraftProvider>
  );
}

const meta = {
  title: "Features/Purchases/History/PeriodBar",
  component: PurchasePeriodBar,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component: [
          "帯の中に常設する期間の絞り込みです。一覧が隣に見えている幅で使います。",
          "**足りていない間は確定を押せなくし、何が足りないかをその場に出します。**",
        ].join(""),
      },
    },
  },
  decorators: [withDraft],
} satisfies Meta<typeof PurchasePeriodBar>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 全期間。確定は押せる（押すと全期間の一覧になる）。 */
export const AllPeriod: Story = {};

/** 暦月で絞り込んでいる状態。 */
export const Month: Story = {
  parameters: { period: { kind: "month", month: "2026-07" } },
};

/** 期間で絞り込んでいる状態。 */
export const Range: Story = {
  parameters: { period: { kind: "range", from: "2026-06-01", to: "2026-08-17" } },
};
