import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import Link from "next/link";
import { userEvent, within } from "storybook/test";
import { CursorPagination } from "@/components/app-starter/cursor-pagination/cursor-pagination";
import { Button } from "@/components/design-system/action/button/button";
import { AdminShell } from "@/components/shell/admin-shell/admin-shell";
import type { AdminShellNavGroup } from "@/components/shell/admin-shell/admin-shell.definition";
import { ContentContainer } from "@/components/shell/content-container/content-container";
import {
  PageHeader,
  PageHeaderDescription,
  PageHeaderTitle,
} from "@/components/shell/page-header/page-header";
import { ADMIN_ANALYTICS_PATH, ADMIN_DASHBOARD_PATH, ADMIN_PRODUCT_LIST_PATH } from "../../paths";
import {
  CATEGORY_OPTIONS,
  LONG_NAME_PRODUCT_ROW,
  NO_CONDITIONS,
  PRODUCT_ROWS,
  STATUS_OPTIONS,
} from "./list.fixture";
import { AdminProductTable } from "./ui/table/table";
import { AdminProductListView } from "./view";

const NAV_GROUPS: readonly AdminShellNavGroup[] = [
  {
    label: "集計",
    items: [
      { href: ADMIN_DASHBOARD_PATH, label: "ダッシュボード" },
      { href: ADMIN_ANALYTICS_PATH, label: "期間別の集計" },
    ],
  },
  { label: "商品", items: [{ href: ADMIN_PRODUCT_LIST_PATH, label: "商品一覧管理" }] },
];

/**
 * route と同じ器で包む。`admin/layout.tsx` が置く shell と `page.tsx` が置く見出しを story 側で
 * 再現し、画面がどう収まるかを取得なしで確かめられるようにする。
 */
function withPageFrame(Story: () => React.ReactElement) {
  return (
    <AdminShell
      consoleName="管理"
      headerActions={
        <Button asChild size="sm" variant="outline">
          <Link href="/products">ユーザー画面へ</Link>
        </Button>
      }
      homeHref={ADMIN_DASHBOARD_PATH}
      navGroups={NAV_GROUPS}
      siteHref="/"
      siteName="nextjs-boilerplate"
    >
      <ContentContainer className="py-8">
        <PageHeader>
          <div>
            <PageHeaderTitle>商品一覧管理</PageHeaderTitle>
            <PageHeaderDescription>
              未公開を含むすべての商品を確認し、作成・編集・在庫の補充へ進みます。
            </PageHeaderDescription>
          </div>
        </PageHeader>
        <Story />
      </ContentContainer>
    </AdminShell>
  );
}

const meta = {
  title: "Page/Admin/Products/List",
  component: AdminProductListView,
  parameters: {
    docs: {
      story: { inline: false, iframeHeight: 760 },
      description: {
        component: [
          "管理側の商品一覧です。**canvas では遷移も取得も起きません** —— 検索・絞り込み・ページ送りを",
          "操作しても表が変わらないのはそのためで、実際は操作した時点でその URL の一覧へ移ります。",
          "行を押すと編集へ、在庫の数を押すと補充へ進みます。状態の色は 4 つの区分で、",
          "マスタに無い状態は縁だけの姿へ倒れます。",
        ].join(""),
      },
    },
    layout: "fullscreen",
    nextjs: { navigation: { pathname: ADMIN_PRODUCT_LIST_PATH } },
  },
  decorators: [withPageFrame],
  args: {
    conditions: NO_CONDITIONS,
    categoryOptions: CATEGORY_OPTIONS,
    statusOptions: STATUS_OPTIONS,
    children: (
      <AdminProductTable
        items={PRODUCT_ROWS}
        pagination={<CursorPagination aria-label="商品一覧のページ送り" nextHref="?after=next" />}
      />
    ),
  },
} satisfies Meta<typeof AdminProductListView>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 先頭ページ。戻る先が無いので「前へ」は押せない。状態の色は 4 つの区分と未知の状態を並べてある。 */
export const Default: Story = {
  globals: { viewport: { value: "desktop", isRotated: false } },
};

/** タブレット。脇の一覧はまだ常設され、表は横幅に合わせて詰まる。 */
export const DefaultTablet: Story = {
  globals: { viewport: { value: "tablet", isRotated: false } },
};

/** スマホ。列は商品名・価格・在庫・操作だけに絞り、絞り込みは下端の操作へ畳まれる。 */
export const DefaultMobile: Story = {
  globals: { viewport: { value: "mobile2", isRotated: false } },
};

/** スマホで絞り込みを開いた状態。表が隠れるため、確定するまで反映しない。 */
export const FilterSheetOpenMobile: Story = {
  globals: { viewport: { value: "mobile2", isRotated: false } },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: /絞り込み/ }));
  },
};

/** スマホで条件が効いている状態。入力欄は overlay の中だが、chip が何で絞られているかを示す。 */
export const FilteredMobile: Story = {
  globals: { viewport: { value: "mobile2", isRotated: false } },
  args: { conditions: { ...NO_CONDITIONS, categoryCodes: ["1"], statusCodes: ["2"] } },
};

/** 同じ種類を複数選んだ状態。chip は値ごとに出て、押すとその 1 つだけが外れる。 */
export const MultipleFiltered: Story = {
  globals: { viewport: { value: "desktop", isRotated: false } },
  args: { conditions: { ...NO_CONDITIONS, categoryCodes: ["1", "2"], statusCodes: ["2", "6"] } },
};

/** 途中のページ。前後のどちらへも進める。 */
export const MiddlePage: Story = {
  globals: { viewport: { value: "desktop", isRotated: false } },
  args: {
    children: (
      <AdminProductTable
        items={PRODUCT_ROWS}
        pagination={
          <CursorPagination
            aria-label="商品一覧のページ送り"
            nextHref="?after=next"
            previousHref={ADMIN_PRODUCT_LIST_PATH}
          />
        }
      />
    ),
  },
};

/** 末尾のページ。次が無いので「次へ」は押せない。 */
export const LastPage: Story = {
  globals: { viewport: { value: "desktop", isRotated: false } },
  args: {
    children: (
      <AdminProductTable
        items={PRODUCT_ROWS.slice(0, 2)}
        pagination={
          <CursorPagination
            aria-label="商品一覧のページ送り"
            previousHref={ADMIN_PRODUCT_LIST_PATH}
          />
        }
      />
    ),
  },
};

/** 検索語が効いている状態。入力欄に語が残り、効いていることは chip が示す。 */
export const Searched: Story = {
  globals: { viewport: { value: "desktop", isRotated: false } },
  args: {
    conditions: { ...NO_CONDITIONS, keyword: "イヤホン" },
    children: (
      <AdminProductTable
        items={[PRODUCT_ROWS[0]]}
        pagination={<CursorPagination aria-label="商品一覧のページ送り" />}
      />
    ),
  },
};

/** 分類と状態で絞り込んだ状態。chip が 2 つ並び、すべてを外す操作が右端に出る。 */
export const FilteredByMaster: Story = {
  globals: { viewport: { value: "desktop", isRotated: false } },
  args: {
    conditions: { ...NO_CONDITIONS, categoryCodes: ["1"], statusCodes: ["2"] },
    children: (
      <AdminProductTable
        items={PRODUCT_ROWS.slice(0, 3)}
        pagination={<CursorPagination aria-label="商品一覧のページ送り" />}
      />
    ),
  },
};

/** 条件に合う商品が無い状態。表の形は保ったまま、無いことだけを伝える。 */
export const Empty: Story = {
  globals: { viewport: { value: "desktop", isRotated: false } },
  args: {
    conditions: { ...NO_CONDITIONS, keyword: "存在しない商品" },
    children: (
      <AdminProductTable
        items={[]}
        pagination={<CursorPagination aria-label="商品一覧のページ送り" />}
      />
    ),
  },
};

/** 契約上の最大長を持つ商品名。列幅を押し広げず、折り返して収まる。 */
export const LongName: Story = {
  globals: { viewport: { value: "desktop", isRotated: false } },
  args: {
    children: (
      <AdminProductTable
        items={[LONG_NAME_PRODUCT_ROW, ...PRODUCT_ROWS.slice(0, 2)]}
        pagination={<CursorPagination aria-label="商品一覧のページ送り" />}
      />
    ),
  },
};

/** 行ごとの操作を開いた状態。編集と在庫の補充へ進める。 */
export const RowActionsOpen: Story = {
  globals: { viewport: { value: "desktop", isRotated: false } },
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: "ワイヤレスイヤホン の操作" }),
    );
  },
};
