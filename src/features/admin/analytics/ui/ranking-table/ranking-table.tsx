import Link from "next/link";

import {
  StaticDataTable,
  type StaticDataTableColumn,
} from "@/components/patterns/table/static-data/static-data";
import { withPartSpan } from "@/observability/render-span";
import { formatCount } from "../../../count";
import { productDetailPath } from "../../../paths";
import type { AdminRankingRow } from "../../ranking-rows";

/** `RankingTable` の props。 */
export type RankingTableProps = {
  /** 順位の昇順で並んだ商品。 */
  rows: readonly AdminRankingRow[];
};

const TITLE = "売れ筋の商品";

const FOCUS_RING =
  "rounded-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground";

/**
 * 狭い段で伏せる列に付ける class。
 *
 * @remarks
 * 何を残すかは `docs/spec/route/admin/analytics/page.screen.md`「幅で変わるもの」。伏せる列を
 * 増やすと、横送りしないと販売数にも届かなくなります。
 */
const WIDE_ONLY = "hidden md:table-cell";

const COLUMNS: readonly StaticDataTableColumn<AdminRankingRow>[] = [
  {
    id: "rank",
    header: "順位",
    align: "end",
    headerClassName: "w-14",
    cell: (row) => <span className="tabular-nums">{row.rank}</span>,
  },
  {
    id: "name",
    header: "商品名",
    cell: (row) => (
      <Link className={`${FOCUS_RING} font-emphasis`} href={productDetailPath(row.id)}>
        {row.name}
      </Link>
    ),
  },
  {
    id: "sold",
    header: "販売数",
    align: "end",
    headerClassName: "w-24",
    cell: (row) => <span className="tabular-nums">{formatCount(row.soldQuantity)}</span>,
  },
  {
    id: "price",
    header: "価格",
    align: "end",
    headerClassName: `${WIDE_ONLY} w-24`,
    cellClassName: WIDE_ONLY,
    // 契約が decimal 文字列で返す値をそのまま出す。数値へ直すと、丸めの規則を画面が持つ。
    cell: (row) => <span className="tabular-nums">{`$${row.price}`}</span>,
  },
];

function rowKey(row: AdminRankingRow): string {
  return row.id;
}

/**
 * 売れ筋の商品を順位の順に並べる。
 *
 * @remarks
 * **上の集計とは期間が別です**（`docs/spec/route/admin/analytics/page.function.md`
 * 「売れ筋の期間が対応しない」）。見出しに期間を書いているのはその断りです。
 *
 * **商品名から商品の面へ出られます。** 売れているものを見つけたときに次へ知りたいのは、その
 * 商品が何かです。行き先が利用者向けの面なのは、管理側が 1 件を眺める面をまだ持たないためで、
 * 決めているのは `../../../paths.ts` です。
 *
 * **行全体を押せる形にしていません。** 商品名だけが遷移先で、順位・販売数・価格は遷移先の説明
 * ではありません。一覧（`../../products/ui/table/`）が行いっぱいの導線を持つのは、そこが操作を
 * 目的にした画面だからです。ここは読む画面なので、押せる範囲を名前に留めます。
 *
 * @see Storybook `Features/Admin/Analytics/RankingTable`
 */
export const RankingTable = withPartSpan(
  "features/admin/analytics/ui/ranking-table/ranking-table",
  ({ rows }: RankingTableProps) => {
    return (
      <section>
        <h2 className="text-lg font-emphasis">{`${TITLE}（直近 30 日）`}</h2>
        <div className="mt-4">
          <StaticDataTable
            columns={COLUMNS}
            emptyMessage="直近 30 日に売れた商品はありません。"
            getRowKey={rowKey}
            label={TITLE}
            rows={rows}
          />
        </div>
      </section>
    );
  },
);
