import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import type { PurchaseStatusCount } from "@/model/dashboard/dashboard";
import { StatusBreakdown } from "./status-breakdown";

let statusSeq = 0;

function count(statusName: string, value: number): PurchaseStatusCount {
  statusSeq += 1;

  return {
    statusId: `0195f0c2-1000-7000-8000-${String(statusSeq).padStart(12, "0")}`,
    statusName,
    count: value,
  };
}

/** 実測した契約の応答と同じ顔ぶれ。マスタの表示順で並ぶ。 */
const STATUS_COUNTS: readonly PurchaseStatusCount[] = [
  count("未処理", 7),
  count("受付中", 4),
  count("確認中", 3),
  count("処理中", 4),
  count("完了", 1),
  count("キャンセル", 1),
  count("支払い済み", 4),
  count("発送済み", 1),
];

const meta = {
  title: "Features/Admin/StatusBreakdown",
  component: StatusBreakdown,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component: [
          "期間内の購入をステータスごとに見せる節です。**棒と表を併置します** —— 棒は大小を掴むため、数そのものは表が持ちます。",
          "**合計は出しません**（ここの件数はキャンセルを含み、数値カードの「売上の件数」は含まないため）。",
          "並びは契約が返すマスタの表示順のままです。",
        ].join(""),
      },
    },
  },
  args: { counts: STATUS_COUNTS },
} satisfies Meta<typeof StatusBreakdown>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 8 つのステータスが揃った日。広い段では棒と表が横に並ぶ。 */
export const Default: Story = {
  globals: { viewport: { value: "desktop", isRotated: false } },
};

/** 狭い段。棒・表の順に縦へ積まれる。 */
export const Mobile: Story = {
  globals: { viewport: { value: "mobile2", isRotated: false } },
};

/** 注文がまだ無い日。棒も表も出さず、無いことだけを一文で伝える。 */
export const NoPurchases: Story = {
  globals: { viewport: { value: "desktop", isRotated: false } },
  args: { counts: [] },
};

/** ステータスが 1 つだけの日。表は 1 行、棒は 1 本のまま軸と余白が保たれる。 */
export const SingleStatus: Story = {
  globals: { viewport: { value: "desktop", isRotated: false } },
  args: { counts: [STATUS_COUNTS[0]] },
};
