import Link from "next/link";

import { Badge } from "@/components/design-system/display/badge/badge";
import { ChevronRightIcon } from "@/components/icon";
import { formatDateTime } from "@/model/datetime";
import { formatMoney } from "@/model/money";
import type { PurchaseHistoryEntry } from "@/model/purchase/purchase";
import { withPartSpan } from "@/observability/render-span";
import { toStatusEmphasis } from "../../../facade/status-emphasis/status-emphasis";

/** `PurchaseRow` の props。 */
export type PurchaseRowProps = {
  /** 並べる購入 1 件。 */
  purchase: PurchaseHistoryEntry;
  /** 詳細の行き先。 */
  href: string;
};

/**
 * 購入履歴の 1 行。
 *
 * @remarks
 * 行そのものを行き先にします。日付や金額だけをリンクにすると、狙う的が文字の幅まで縮み、指で
 * 押す場面で外しやすくなります（[0100](../../../../../../docs/adr/0100-accessibility-target.md)）。
 *
 * 注文日時を先頭に置きます。利用者が自分の購入を見分ける手がかりは、まず「いつ買ったか」で、
 * 購入コードは控えと突き合わせるときにしか使いません。
 *
 * 状況・金額・行き先の目印は 1 つの塊にして右へ寄せます。ばらばらに折り返すと、行によって
 * 目印だけが次の行へ落ち、同じ形の行が違う高さで並びます。
 *
 * 状況の色は届いたか止まったかで変えます。何十件も並ぶ一覧では、1 行ずつ文字を読まずに
 * 目的の購入を絞り込めることのほうが効きます。色の割り当ては `status-emphasis.ts` が持ちます。
 *
 * 購入コードは折り返さずに詰めます。契約が返すのは UUID で、折り返すと 1 行の高さが 2 倍になり、
 * 一覧を読み進める密度が落ちます。全文は詳細の控えにあります。
 */
export const PurchaseRow = withPartSpan(
  "features/purchases/history/ui/purchase-row/purchase-row",
  ({ purchase, href }: PurchaseRowProps) => {
    return (
      <li>
        <Link
          className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-4 transition-colors hover:bg-accent focus-visible:bg-accent"
          href={href}
        >
          <div className="flex min-w-0 flex-1 basis-48 flex-col gap-1">
            <span className="font-emphasis">{formatDateTime(purchase.orderedAt)}</span>
            <span className="truncate font-mono text-muted-foreground text-xs">
              {purchase.code}
            </span>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <Badge variant={toStatusEmphasis(purchase.statusCode)}>{purchase.statusName}</Badge>
            <span className="tabular-nums">{formatMoney(purchase.totalAmount)}</span>
            <ChevronRightIcon
              aria-hidden="true"
              className="size-4 shrink-0 text-muted-foreground"
            />
          </div>
        </Link>
      </li>
    );
  },
);
