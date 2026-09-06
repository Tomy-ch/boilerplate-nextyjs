import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import Link from "next/link";
import { userEvent, within } from "storybook/test";

import { Button } from "@/components/design-system/action/button/button";
import { AdminShell } from "@/components/shell/admin-shell/admin-shell";
import type { AdminShellNavGroup } from "@/components/shell/admin-shell/admin-shell.definition";
import { ContentContainer } from "@/components/shell/content-container/content-container";
import {
  PageHeader,
  PageHeaderDescription,
  PageHeaderTitle,
} from "@/components/shell/page-header/page-header";
import { ErrorKind } from "@/errors/error-kind";
import { failedActionState, idleActionState, succeededActionState } from "@/model/action-state";

import { ADMIN_DASHBOARD_PATH, ADMIN_PRODUCT_LIST_PATH, ADMIN_USER_LIST_PATH } from "../paths";
import { WITHDRAW_CONFLICT_MESSAGE } from "./form-state";
import { USER_SCOPE } from "./query";
import type { AdminUserRow } from "./row";
import { AdminUserPagination } from "./ui/pagination/pagination";
import { WithdrawableUserList } from "./ui/withdrawable-list/withdrawable-list";
import { ADMIN_USER_ROWS, LONG_NAME_USER_ROW, WITHDRAWN_USER_ROWS } from "./users.fixture";
import { AdminUserListView } from "./view";

const NAV_GROUPS: readonly AdminShellNavGroup[] = [
  { label: "集計", items: [{ href: ADMIN_DASHBOARD_PATH, label: "ダッシュボード" }] },
  { label: "商品", items: [{ href: ADMIN_PRODUCT_LIST_PATH, label: "商品一覧管理" }] },
  { label: "利用者", items: [{ href: ADMIN_USER_LIST_PATH, label: "利用者一覧" }] },
];

/** canvas では送らない。押した先で何も起きないことを、待ち続けない形で示す。 */
const idle = () => Promise.resolve(idleActionState<{ readonly name: string }>());

/** 退会が成立した状態を作る。 */
const succeeding = (name: string) => () =>
  Promise.resolve(succeededActionState<{ readonly name: string }>({ name }));

/** 退会が拒まれた状態を作る。 */
const rejecting = (formError: string, kind?: ErrorKind) => () =>
  Promise.resolve(
    failedActionState<{ readonly name: string }>({
      formError,
      ...(kind === undefined ? {} : { kind }),
    }),
  );

/** route と同じ器で包む。`admin/layout.tsx` の shell と `page.tsx` の見出しを再現する。 */
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
            <PageHeaderTitle>利用者一覧</PageHeaderTitle>
            <PageHeaderDescription>
              登録されている利用者を確認し、退会させます。
            </PageHeaderDescription>
          </div>
        </PageHeader>
        <Story />
      </ContentContainer>
    </AdminShell>
  );
}

/** 一覧本体を組み立てる。story ごとに差し替えるのは行・ページ位置・送信先の 3 つだけ。 */
function list({
  items = ADMIN_USER_ROWS,
  page = 1,
  pageCount = 4,
  withdrawAction = idle,
}: {
  items?: readonly AdminUserRow[];
  page?: number;
  pageCount?: number;
  withdrawAction?: () => Promise<ReturnType<typeof idleActionState<{ readonly name: string }>>>;
} = {}) {
  return (
    <WithdrawableUserList
      items={items}
      pagination={
        <AdminUserPagination location={{ scope: USER_SCOPE.ALL, page }} pageCount={pageCount} />
      }
      withdrawAction={withdrawAction}
    />
  );
}

/**
 * 行の操作 menu を開いてから「退会させる」を選ぶ。
 *
 * menu も dialog も portal で `body` の側へ出るため、canvas の内側からは辿れない。
 */
async function openWithdrawDialog(canvasElement: HTMLElement, name: string) {
  const body = within(document.body);

  await userEvent.click(within(canvasElement).getByRole("button", { name: `${name} の操作` }));
  await userEvent.click(await body.findByRole("menuitem", { name: "退会させる" }));
  await body.findByRole("alertdialog");
}

/** 確認の中の送信を押す。同じ呼び名の menu 項目と取り違えないよう dialog の内側へ絞る。 */
async function submitWithdraw() {
  const dialog = await within(document.body).findByRole("alertdialog");

  await userEvent.click(within(dialog).getByRole("button", { name: "退会させる" }));
}

const meta = {
  title: "Page/Admin/Users",
  component: AdminUserListView,
  parameters: {
    docs: {
      story: { inline: false, iframeHeight: 760 },
      description: {
        component: [
          "管理側の利用者一覧です。**canvas では遷移も取得も起きません** —— 絞り込みやページ送りを",
          "操作しても表が変わらないのはそのためです。ページ送りは任意のページへ跳べる offset 方式で、",
          "退会は不可逆なので確認を挟み、結果は一覧の上に残ります。",
        ].join(""),
      },
    },
    layout: "fullscreen",
    nextjs: { navigation: { pathname: ADMIN_USER_LIST_PATH } },
  },
  decorators: [withPageFrame],
  args: { scope: USER_SCOPE.ALL, children: list() },
} satisfies Meta<typeof AdminUserListView>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 先頭ページ。戻る先が無いので「前へ」は押せない。退会済みの行は状態のバッジで判る。 */
export const Default: Story = {
  globals: { viewport: { value: "desktop", isRotated: false } },
};

/** タブレット。脇の一覧は常設のまま、電話番号の列まで収まる。 */
export const DefaultTablet: Story = {
  globals: { viewport: { value: "tablet", isRotated: false } },
};

/** スマホ。電話番号の列を伏せ、名前・メール・状態・操作だけを残す。 */
export const DefaultMobile: Story = {
  globals: { viewport: { value: "mobile2", isRotated: false } },
};

/** 有効な利用者だけに絞った状態。退会済みの行が並びから外れる。 */
export const ActiveOnly: Story = {
  args: {
    scope: USER_SCOPE.ACTIVE,
    children: list({ items: ADMIN_USER_ROWS.filter((item) => !item.withdrawn), pageCount: 3 }),
  },
  globals: { viewport: { value: "desktop", isRotated: false } },
};

/** 退会済みだけに絞った状態。操作が無いので、どの行にも操作の trigger が出ない。 */
export const WithdrawnOnly: Story = {
  args: {
    scope: USER_SCOPE.WITHDRAWN,
    children: list({ items: WITHDRAWN_USER_ROWS, pageCount: 1 }),
  },
  globals: { viewport: { value: "desktop", isRotated: false } },
};

/** 途中のページ。前後のどちらへも進め、離れた範囲は省略記号で畳まれる。 */
export const MiddlePage: Story = {
  args: { children: list({ page: 5, pageCount: 12 }) },
  globals: { viewport: { value: "desktop", isRotated: false } },
};

/** 末尾のページ。次が無いので「次へ」は押せない。 */
export const LastPage: Story = {
  args: { children: list({ items: ADMIN_USER_ROWS.slice(0, 2), page: 4, pageCount: 4 }) },
  globals: { viewport: { value: "desktop", isRotated: false } },
};

/** ページが 1 枚しかない状態。前後のどちらも押せないまま位置は保たれる。 */
export const SinglePage: Story = {
  args: { children: list({ pageCount: 1 }) },
  globals: { viewport: { value: "desktop", isRotated: false } },
};

/** 条件に合う利用者が無い状態。表の形は保ったまま、無いことだけを伝える。 */
export const Empty: Story = {
  args: { scope: USER_SCOPE.WITHDRAWN, children: list({ items: [], pageCount: 1 }) },
  globals: { viewport: { value: "desktop", isRotated: false } },
};

/** 行ごとの操作を開いた状態。有効な利用者には退会だけが並ぶ。 */
export const RowActionsOpen: Story = {
  globals: { viewport: { value: "desktop", isRotated: false } },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "山田 太郎 の操作" }));
  },
};

/** 退会の確認を開いた状態。後始末が同時には終わらないことを先に書く。 */
export const WithdrawConfirm: Story = {
  globals: { viewport: { value: "desktop", isRotated: false } },
  play: async ({ canvasElement }) => {
    await openWithdrawDialog(canvasElement, "山田 太郎");
  },
};

/** 退会が成立した状態。確認は閉じ、何が起きたかは一覧の上に残る。 */
export const Withdrawn: Story = {
  args: { children: list({ withdrawAction: succeeding("山田 太郎") }) },
  globals: { viewport: { value: "desktop", isRotated: false } },
  play: async ({ canvasElement }) => {
    await openWithdrawDialog(canvasElement, "山田 太郎");
    await submitWithdraw();
  },
};

/** 進行中の購入が残って拒まれた状態。確認は閉じ、拒まれた理由が一覧の上に残る。 */
export const WithdrawConflicted: Story = {
  args: {
    children: list({
      withdrawAction: rejecting(`山田 太郎 は${WITHDRAW_CONFLICT_MESSAGE}`, ErrorKind.CONFLICT),
    }),
  },
  globals: { viewport: { value: "desktop", isRotated: false } },
  play: async ({ canvasElement }) => {
    await openWithdrawDialog(canvasElement, "山田 太郎");
    await submitWithdraw();
  },
};

/** 契約上の最大長を持つ姓名。表は自分の領域の中で横へ伸び、画面そのものは横へあふれない。 */
export const LongName: Story = {
  args: {
    children: list({ items: [LONG_NAME_USER_ROW, ...ADMIN_USER_ROWS.slice(0, 2)] }),
  },
  globals: { viewport: { value: "desktop", isRotated: false } },
};
