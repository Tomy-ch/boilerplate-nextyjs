import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/design-system/display/table/table";
import type { PurchaseStatusCount } from "@/model/dashboard/dashboard";
import { withPartSpan } from "@/observability/render-span";
import { formatCount } from "../../count";
import { StatusBars } from "../status-bars/status-bars";

/** `StatusBreakdown` の props。 */
export type StatusBreakdownProps = {
  /** 契約が返した順序のままのステータス別件数。 */
  counts: readonly PurchaseStatusCount[];
};

const TITLE = "ステータス別の件数";

/**
 * 期間内に注文された購入を、ステータスごとに見せる。
 *
 * @remarks
 * **横棒と表を併置します。** 棒は大小を一目で掴むためのもので、数そのものは表が持ちます。
 * 棒だけにすると、形と色でしか読めない情報になります
 * （`components/design-system/display/chart/README.md`）。
 *
 * **合計を出しません。** ここに並ぶ件数はキャンセルを含み、数値カードの「売上の件数」は
 * キャンセルを除きます。足し合わせた数はどちらの母集団にも属さない第三の数になるため、
 * 画面が作れる数を置かない側に倒しています
 * （[0070](../../../../../docs/adr/0070-backend-role-separation.md)）。
 *
 * **並べ替えません。** 契約はステータスマスタの表示順で返します。件数の多い順へ組み替えると、
 * 期間を切り替えるたびに行の位置が動き、同じステータスを追えなくなります。
 *
 * **棒も表もサーバで描き切ります。** 棒は渡された件数を並べるだけで操作を受けないため、
 * client 島にする理由がありません（[0040](../../../../../docs/adr/0040-routing-rendering-strategy.md)）。
 *
 * @see Storybook `Features/Admin/StatusBreakdown`
 */
export const StatusBreakdown = withPartSpan(
  "features/admin/ui/status-breakdown/status-breakdown",
  ({ counts }: StatusBreakdownProps) => {
    return (
      <section>
        <h2 className="text-lg font-emphasis">{TITLE}</h2>
        {counts.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            この期間に注文された購入はありません。
          </p>
        ) : (
          <div className="mt-4 grid gap-6 lg:grid-cols-2 lg:items-start">
            <StatusBars counts={counts} />
            <Table label={TITLE}>
              <TableHeader>
                <TableRow>
                  <TableHead>ステータス</TableHead>
                  <TableHead className="text-right">件数</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {counts.map((entry) => (
                  <TableRow key={entry.statusId}>
                    <TableCell>{entry.statusName}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCount(entry.count)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    );
  },
);
