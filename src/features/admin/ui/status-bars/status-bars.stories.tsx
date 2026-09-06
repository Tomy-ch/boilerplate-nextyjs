import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import type { PurchaseStatusCount } from "@/model/dashboard/dashboard";
import { StatusBars } from "./status-bars";

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
  title: "Features/Admin/StatusBars",
  component: StatusBars,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component: [
          "ステータス別の件数を横棒で見せる補助です。**これだけでは読めません** —— 数そのものは",
          "隣に置く表が持ちます（`Features/Admin/StatusBreakdown`）。作図の一式は持ち込まず、",
          "要素と CSS だけで描くので、tooltip も凡例もありません。目盛りは 1・2・5 とその 10 倍に",
          "丸めるので、目盛りの数字から帯の長さを暗算で読めます。",
        ].join(""),
      },
    },
  },
  args: { counts: STATUS_COUNTS },
} satisfies Meta<typeof StatusBars>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 8 つのステータスが揃った日。行の高さは本数で決まる。 */
export const Default: Story = {};

/** ステータスが 1 つだけの日。帯の太さに上限があるので、1 本が枠を埋めない。 */
export const SingleStatus: Story = {
  args: { counts: [STATUS_COUNTS[0]] },
};

/** 件数が伸びた日。目盛りは切りのよい幅へ丸め、右端は軸の内側へ寄せて枠から出さない。 */
export const LargeCounts: Story = {
  args: {
    counts: [
      count("未処理", 4_820),
      count("受付中", 1_240),
      count("処理中", 12_004),
      count("完了", 9_610),
    ],
  },
};

/** 名前が長いステータス。行の名前は列の幅で末尾を落とし、帯の始点を動かさない。 */
export const LongStatusName: Story = {
  args: {
    counts: [
      count("支払い確認待ち（コンビニ・銀行振込）", 12),
      count("完了", 30),
      count("キャンセル", 3),
    ],
  },
};

/** 突出した 1 本がある日。短い帯も 0 からの長さで比べられる。 */
export const Skewed: Story = {
  args: {
    counts: [count("未処理", 240), count("受付中", 3), count("完了", 1), count("キャンセル", 1)],
  },
};
