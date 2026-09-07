import Link from "next/link";
import type { ReactNode } from "react";

import { Badge } from "@/components/design-system/display/badge/badge";
import { rowActionsColumn } from "@/components/patterns/table/row-actions/row-actions";
import { ROW_ACTION_KIND } from "@/components/patterns/table/row-actions/row-actions.definition";
import {
  StaticDataTable,
  type StaticDataTableColumn,
} from "@/components/patterns/table/static-data/static-data";
import { withPartSpan } from "@/observability/render-span";
import { adminProductEditPath, adminProductStockPath } from "../../../../paths";
import type { AdminProductRow } from "../../row";

/** `AdminProductTable` の props。 */
export type AdminProductTableProps = {
  /** 並べる商品。 */
  items: readonly AdminProductRow[];
  /** 一覧の上に置く操作。 */
  toolbar?: ReactNode;
  /** 一覧の下に置くページ送り。 */
  pagination?: ReactNode;
};

const FOCUS_RING =
  "rounded-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground";

/**
 * 狭い段で伏せる列に付ける class。
 *
 * @remarks
 * 分類と状態は行を見比べるときの手がかりで、1 件を特定するのには要りません。狭い段で残すのは
 * **どれか（商品名）・いくらか（価格）・いくつか（在庫）・何ができるか（操作）**の 4 つで、
 * それ以外を残すと横送りしないと在庫にも操作にも届かなくなります。
 */
const WIDE_ONLY = "hidden md:table-cell";

/**
 * 列幅は `col` ではなく cell に持たせる。
 *
 * @remarks
 * `colgroup` の並びは**描かれた列**と位置で対応します。狭い段で伏せた列の cell は描かれないため、
 * `col` に幅を持たせると伏せた分だけ後ろの列と幅がずれます。
 */
const COLUMNS: readonly StaticDataTableColumn<AdminProductRow>[] = [
  {
    id: "name",
    header: "商品名",
    cell: (item) => (
      <Link
        className={`${FOCUS_RING} font-emphasis after:absolute after:inset-0`}
        href={adminProductEditPath(item.id)}
      >
        {item.name}
      </Link>
    ),
  },
  {
    id: "category",
    header: "分類",
    headerClassName: `${WIDE_ONLY} w-40`,
    cellClassName: WIDE_ONLY,
    cell: (item) => item.categoryName,
  },
  {
    id: "price",
    header: "価格",
    align: "end",
    headerClassName: "w-24",
    // 契約が decimal 文字列で返す値をそのまま出す。数値へ直すと、丸めの規則を画面が持つ。
    cell: (item) => `$${item.price}`,
  },
  {
    id: "quantity",
    header: "在庫",
    align: "end",
    headerClassName: "w-20",
    cellClassName: "relative",
    cell: (item) => (
      <Link
        className={`${FOCUS_RING} block underline-offset-4 hover:underline`}
        href={adminProductStockPath(item.id)}
      >
        {item.quantity}
      </Link>
    ),
  },
  {
    id: "status",
    header: "状態",
    headerClassName: `${WIDE_ONLY} w-28`,
    cellClassName: WIDE_ONLY,
    cell: (item) => <Badge variant={item.statusTone}>{item.statusName}</Badge>,
  },
  {
    ...rowActionsColumn<AdminProductRow>({
      triggerLabel: (item) => `${item.name} の操作`,
      actions: (item) => [
        {
          id: "edit",
          kind: ROW_ACTION_KIND.LINK,
          label: "編集する",
          href: adminProductEditPath(item.id),
        },
        {
          id: "stock",
          kind: ROW_ACTION_KIND.LINK,
          label: "在庫を補充する",
          href: adminProductStockPath(item.id),
        },
      ],
    }),
    width: undefined,
    headerClassName: "w-12",
    cellClassName: "relative",
  },
];

function rowKey(item: AdminProductRow): string {
  return item.id;
}

/**
 * 管理側の商品一覧。
 *
 * @remarks
 * 取得もページ送りの組み立ても持ちません。並べる商品と、上下へ置くものを受け取るだけです。
 *
 * **利用者側の一覧と同じ商品を、違う形で出します。** 買う側は 1 件ずつ眺めて選ぶのでカードで、
 * 管理側は同じ属性を件どうしで見比べるので表です。同じ部品を共有すると、どちらかの都合が
 * もう一方へ漏れます。
 *
 * **行全体が編集への導線ですが、link で包んではいません。** `tr` を link で包むことはできず、
 * 包めたとしても在庫と行操作が link の内側に入り、操作の中に操作が居る形になります。代わりに
 * 商品名の link を疑似要素で行いっぱいに広げ、支援技術には商品名だけが遷移先として見えるように
 * しています。
 *
 * **在庫の数は補充への導線です。** link を行の重なりの上へ出すため、その cell だけ位置指定の
 * 基準を持たせます。DOM の順序が後ろにある位置指定要素が上に描かれるため、段階値を持ち出さずに
 * 押せる状態を作れます（`rules.md`「レイアウトと帯」の「z-index は Tailwind の段階値だけを使う」）。
 * 行操作の menu も同じ理由で上へ出します。
 *
 * 狭い段の列の取捨は {@link WIDE_ONLY} が持ちます。
 *
 * **状態の色は行が持ち込みます。** どの状態がどの区分かはこの feature の意味づけで、表は渡された
 * 見た目をそのまま出すだけです（`../../status-tone.ts`）。色は状態名に重ねているだけで、色だけで
 * 区別させません（[0100](../../../../../../../docs/adr/0100-accessibility-target.md)）。
 *
 * **行を押す・在庫を押すのどちらも、明示的に選ぶ道を menu が残します**（理由は `docs/spec/route/admin/products/page.function.md`
 * 「行から進める先」）。
 *
 * @see Storybook `Features/Admin/Products/List/Table`
 */
export const AdminProductTable = withPartSpan(
  "features/admin/products/list/ui/table/table",
  ({ items, toolbar, pagination }: AdminProductTableProps) => {
    return (
      <StaticDataTable
        columns={COLUMNS}
        emptyMessage="条件に一致する商品はありません。"
        getRowKey={rowKey}
        label="商品の一覧"
        pagination={pagination}
        rowClassName="relative cursor-pointer"
        rows={items}
        toolbar={toolbar}
      />
    );
  },
);
