import type { PurchaseDispatchGroup, PurchaseHistoryEntry } from "@/model/purchase/purchase";
import { PURCHASE_STATUS } from "@/model/purchase/purchase-status";

/** 同じ宛先へ 3 件たまっている便。まとめて発送する値打ちがある形。 */
const MULTI_PURCHASE_GROUP: PurchaseDispatchGroup = {
  userId: "0195f0c2-0000-7000-9000-0000000000a1",
  purchases: [
    {
      code: "0195f0c2-0000-7000-9000-000000000001",
      totalAmount: 21_287,
      orderedAt: new Date("2026-08-15T10:30:00+09:00"),
    },
    {
      code: "0195f0c2-0000-7000-9000-000000000002",
      totalAmount: 4_398,
      orderedAt: new Date("2026-08-16T21:05:00+09:00"),
    },
    {
      code: "0195f0c2-0000-7000-9000-000000000003",
      totalAmount: 1_234_567_890,
      orderedAt: new Date("2026-08-17T09:12:00+09:00"),
    },
  ],
};

/** 1 件しかない便。契約は 1 件だけの購入者も 1 つの組として返す。 */
const SINGLE_PURCHASE_GROUP: PurchaseDispatchGroup = {
  userId: "0195f0c2-0000-7000-9000-0000000000a2",
  purchases: [
    {
      code: "0195f0c2-0000-7000-9000-000000000004",
      totalAmount: 990,
      orderedAt: new Date("2026-08-18T18:44:00+09:00"),
    },
  ],
};

export { MULTI_PURCHASE_GROUP, SINGLE_PURCHASE_GROUP };

/** 発送を待っている便の並び。組同士は最も古い購入の順。 */
export const DISPATCH_GROUPS: readonly PurchaseDispatchGroup[] = [
  MULTI_PURCHASE_GROUP,
  SINGLE_PURCHASE_GROUP,
];

/** 配達の確認を待っている注文。発送済みだけが並ぶ。 */
export const SHIPPED_PURCHASES = [
  {
    code: "0195f0c2-0000-7000-9000-000000000011",
    totalAmount: 8_580,
    statusCode: PURCHASE_STATUS.SHIPPED,
    statusName: "発送済み",
    orderedAt: new Date("2026-08-10T11:20:00+09:00"),
  },
  {
    code: "0195f0c2-0000-7000-9000-000000000012",
    totalAmount: 132_000,
    statusCode: PURCHASE_STATUS.SHIPPED,
    statusName: "発送済み",
    orderedAt: new Date("2026-08-12T15:48:00+09:00"),
  },
] satisfies readonly [PurchaseHistoryEntry, ...PurchaseHistoryEntry[]];
