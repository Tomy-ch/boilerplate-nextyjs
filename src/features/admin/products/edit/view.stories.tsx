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
import { SAMPLE_ITEM_URLS } from "~catalog/lib/sample-asset";
import { ADMIN_PRODUCT_LIST_PATH } from "../../paths";
import {
  CATEGORY_OPTIONS,
  MAX_UPLOAD_BYTES,
  SAMPLE_PRODUCT,
  STATUS_OPTIONS,
} from "../products.fixture";
import { AdminProductEditView } from "./view";

const NAV_GROUPS: readonly AdminShellNavGroup[] = [
  { label: "商品", items: [{ href: ADMIN_PRODUCT_LIST_PATH, label: "商品一覧管理" }] },
];

/** 読み込んだ時点で保存されている画像。表示 URL は route が解決したものが届く。 */
const SAVED_IMAGES = [
  {
    imagePath: "products/0195f0c2-0000-7000-8000-000000000001.png",
    url: SAMPLE_ITEM_URLS[0],
  },
] as const;

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
              <BreadcrumbPage>{SAMPLE_PRODUCT.name}</BreadcrumbPage>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>編集</BreadcrumbPage>
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
            <PageHeaderTitle>商品の編集</PageHeaderTitle>
            <PageHeaderDescription>
              観点を選んで直します。更新すると一覧へ戻ります。
            </PageHeaderDescription>
          </div>
        </PageHeader>
        <Story />
      </ContentContainer>
    </AdminShell>
  );
}

const meta = {
  title: "Page/Admin/Products/Edit",
  component: AdminProductEditView,
  parameters: {
    docs: {
      story: { inline: false, iframeHeight: 900 },
      description: {
        component: [
          "商品を編集する画面です。**canvas では送信も保存も起きません** —— 観点はどこからでも",
          "選べ、選んでいない観点も DOM に残るので入力途中の値が消えません。在庫数は扱いません",
          "（在庫は加算で動かす別の口が持ちます）。",
        ].join(""),
      },
    },
    layout: "fullscreen",
    nextjs: { navigation: { pathname: `${ADMIN_PRODUCT_LIST_PATH}/${SAMPLE_PRODUCT.id}/edit` } },
  },
  decorators: [withPageFrame],
  args: {
    product: SAMPLE_PRODUCT,
    savedImages: SAVED_IMAGES,
    categoryOptions: CATEGORY_OPTIONS,
    statusOptions: STATUS_OPTIONS,
    maxUploadBytes: MAX_UPLOAD_BYTES,
    updateAction: idle,
    uploadAction: uploaded,
  },
} satisfies Meta<typeof AdminProductEditView>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 最初の観点。読み込んだ内容が各欄に入っている。 */
export const Default: Story = {
  globals: { viewport: { value: "desktop", isRotated: false } },
};

/** タブレット。観点の並びはそのまま、入力欄が読み幅で頭打ちになる。 */
export const DefaultTablet: Story = {
  globals: { viewport: { value: "tablet", isRotated: false } },
};

/** スマホ。観点の並びは横スクロールへ、脇の一覧は overlay へ畳まれる。 */
export const DefaultMobile: Story = {
  globals: { viewport: { value: "mobile2", isRotated: false } },
};

/**
 * 送信が弾かれた状態。誤りのある観点へ自動で移る。
 *
 * 観点を切り替える器は進む前に止める仕組みを持たないため、移らないと「画面のどこも赤くないのに
 * 送信だけ通らない」状態になる。
 */
export const Rejected: Story = {
  args: {
    updateAction: rejecting({ statusId: ["状態を選んでください。"] }),
  },
  globals: { viewport: { value: "desktop", isRotated: false } },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "更新する" }));
  },
};

/** 版が食い違って拒まれた状態。読み込み直す導線を添える。 */
export const Conflicted: Story = {
  args: {
    updateAction: rejecting(
      {},
      "この商品は別の人が更新しました。読み込み直して、最新の内容に対して編集し直してください。",
    ),
  },
  globals: { viewport: { value: "desktop", isRotated: false } },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "更新する" }));
  },
};

/** 説明が空の商品。編集面は空のまま開き、保存済みの内容が無いことが判る。 */
export const WithoutDescription: Story = {
  args: { product: { ...SAMPLE_PRODUCT, description: null, publishedAt: null }, savedImages: [] },
  globals: { viewport: { value: "desktop", isRotated: false } },
};
