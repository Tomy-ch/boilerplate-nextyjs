import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import Link from "next/link";
import { userEvent, within } from "storybook/test";

import { Button } from "@/components/design-system/action/button/button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/design-system/navigation/breadcrumb/breadcrumb";
import { AdminShell } from "@/components/shell/admin-shell/admin-shell";
import type { AdminShellNavGroup } from "@/components/shell/admin-shell/admin-shell.definition";
import { ContentContainer } from "@/components/shell/content-container/content-container";
import {
  PageHeader,
  PageHeaderDescription,
  PageHeaderTitle,
} from "@/components/shell/page-header/page-header";
import { failedActionState, idleActionState } from "@/model/action-state";

import { ADMIN_PRODUCT_LIST_PATH } from "../../paths";
import { CATEGORY_OPTIONS, MAX_UPLOAD_BYTES, STATUS_OPTIONS } from "../products.fixture";
import { AdminProductCreateView } from "./view";

const NAV_GROUPS: readonly AdminShellNavGroup[] = [
  { label: "商品", items: [{ href: ADMIN_PRODUCT_LIST_PATH, label: "商品一覧管理" }] },
];

/** canvas では送らない。押した先で何も起きないことを、待ち続けない形で示す。 */
const idle = () => Promise.resolve(idleActionState<void>());

/** 送信が弾かれた状態を作る。 */
const rejecting =
  (
    fieldErrors: Record<string, readonly string[]>,
    formError: string | null = "入力内容を確認してください。",
  ) =>
  () =>
    Promise.resolve(failedActionState<void>({ fieldErrors, formError }));

/** 画像は送らずに終わったことにする。canvas で外へ出さないため。 */
const uploaded = () =>
  Promise.resolve(failedActionState<string>({ formError: "canvas では画像を保存しません。" }));

/** route と同じ器で包む。`admin/layout.tsx` の shell と `page.tsx` の見出し・階層を再現する。 */
function withPageFrame(Story: () => React.ReactElement) {
  return (
    <AdminShell
      breadcrumb={
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href={ADMIN_PRODUCT_LIST_PATH}>商品一覧管理</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>新規作成</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      }
      consoleName="管理"
      headerActions={
        <Button asChild size="sm" variant="outline">
          <Link href="/products">ユーザー画面へ</Link>
        </Button>
      }
      homeHref={ADMIN_PRODUCT_LIST_PATH}
      navGroups={NAV_GROUPS}
      siteHref="/"
      siteName="nextjs-boilerplate"
    >
      <ContentContainer className="py-8">
        <PageHeader>
          <div>
            <PageHeaderTitle>商品の新規作成</PageHeaderTitle>
            <PageHeaderDescription>
              基本情報から公開までを順に入力します。登録すると一覧へ戻ります。
            </PageHeaderDescription>
          </div>
        </PageHeader>
        <Story />
      </ContentContainer>
    </AdminShell>
  );
}

const meta = {
  title: "Page/Admin/Products/Create",
  component: AdminProductCreateView,
  parameters: {
    docs: {
      story: { inline: false, iframeHeight: 900 },
      description: {
        component: [
          "商品を作る画面です。**canvas では送信も保存も起きません** —— 段は行き来でき、",
          "隠れている段も DOM に残るので、最後の 1 回で全段ぶんがまとまって送られます。",
          "画像は選んだ時点で送る作りで、送り終わるまで登録を押せません。",
          "最後の確認の段は入力欄を持たず、form そのものから読んだ値を出します。",
        ].join(""),
      },
    },
    layout: "fullscreen",
    nextjs: { navigation: { pathname: `${ADMIN_PRODUCT_LIST_PATH}/new` } },
  },
  decorators: [withPageFrame],
  args: {
    categoryOptions: CATEGORY_OPTIONS,
    statusOptions: STATUS_OPTIONS,
    maxUploadBytes: MAX_UPLOAD_BYTES,
    createAction: idle,
    uploadAction: uploaded,
  },
} satisfies Meta<typeof AdminProductCreateView>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 最初の段。進捗は 5 段のうち 1 段目を指し、戻る操作は押せない。 */
export const Default: Story = {
  globals: { viewport: { value: "desktop", isRotated: false } },
};

/** タブレット。脇の一覧は常設のまま、入力欄は読み幅で頭打ちになる。 */
export const DefaultTablet: Story = {
  globals: { viewport: { value: "tablet", isRotated: false } },
};

/** スマホ。脇の一覧は overlay へ畳まれ、段の行き来だけが残る。 */
export const DefaultMobile: Story = {
  globals: { viewport: { value: "mobile2", isRotated: false } },
};

/** 確認の段。入力欄を持たず、送る内容だけを読ませる。空欄は「—」で示す。 */
export const Confirm: Story = {
  globals: { viewport: { value: "desktop", isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // 必須が埋まるまで次へ進めないので、埋めてから進む。
    await userEvent.type(canvas.getByLabelText("商品名"), "ワイヤレスイヤホン Pro");
    await userEvent.type(canvas.getByLabelText("価格"), "24.99");
    await userEvent.type(canvas.getByLabelText("在庫数"), "25");
    await userEvent.selectOptions(canvas.getByLabelText("分類"), "電子機器");
    await userEvent.click(canvas.getByRole("button", { name: "次へ" }));
    await userEvent.click(canvas.getByRole("button", { name: "次へ" }));
    await userEvent.click(canvas.getByRole("button", { name: "次へ" }));
    await userEvent.selectOptions(canvas.getByLabelText("状態"), "在庫あり");
    await userEvent.click(canvas.getByRole("button", { name: "確認" }));
  },
};

/**
 * 送信が弾かれた状態。要約が全体像と導線を、欄のそばの文言がその場での指摘を担う。
 *
 * 形の上での誤りは段を進む前に止まるため、ここへ至るのは**受け取る側でしか判らない誤り**の
 * ときだけになる。
 */
export const Rejected: Story = {
  args: {
    createAction: rejecting({ price: ["この価格では登録できません。"] }),
  },
  globals: { viewport: { value: "desktop", isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.type(canvas.getByLabelText("商品名"), "ワイヤレスイヤホン Pro");
    await userEvent.type(canvas.getByLabelText("価格"), "24.99");
    await userEvent.type(canvas.getByLabelText("在庫数"), "25");
    await userEvent.selectOptions(canvas.getByLabelText("分類"), "電子機器");
    await userEvent.click(canvas.getByRole("button", { name: "次へ" }));
    await userEvent.click(canvas.getByRole("button", { name: "次へ" }));
    await userEvent.click(canvas.getByRole("button", { name: "次へ" }));
    await userEvent.selectOptions(canvas.getByLabelText("状態"), "在庫あり");
    await userEvent.click(canvas.getByRole("button", { name: "確認" }));
    await userEvent.click(canvas.getByRole("button", { name: "登録する" }));
  },
};
