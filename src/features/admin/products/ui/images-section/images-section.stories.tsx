import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";

import { ATTACHMENT_STATE } from "@/components/app-starter/attachment/attachment.definition";
import type { UploadPreviewItem } from "@/components/app-starter/upload-preview/upload-preview.definition";
import { SAMPLE_ITEM_URLS } from "~catalog/lib/sample-asset";
import { MAX_UPLOAD_BYTES } from "../../products.fixture";
import type { ProductImages } from "../../use-product-images";
import { ProductImagesSection } from "./images-section";

/**
 * 選択中の画像の器。**送信経路は持ちません** —— カタログで確かめたいのは、送り終わった枚・送って
 * いる枚・送れなかった枚が並んだときの見え方なので、その並びを直に置く。
 */
function images(
  items: readonly UploadPreviewItem[],
  imagePaths: readonly string[] = [],
): ProductImages {
  return {
    items,
    imagePaths,
    uploading: items.some((item) => item.state === ATTACHMENT_STATE.UPLOADING),
    failed: items.some((item) => item.state === ATTACHMENT_STATE.ERROR),
    dirty: items.length > 0,
    add: () => undefined,
    remove: () => undefined,
    retry: () => undefined,
    moveUp: () => undefined,
    moveDown: () => undefined,
  };
}

const DONE_ITEM: UploadPreviewItem = {
  id: "image-1",
  name: "earphone-front.png",
  description: "1.2 MB",
  state: ATTACHMENT_STATE.DONE,
  preview: SAMPLE_ITEM_URLS[0],
};

const SECOND_ITEM: UploadPreviewItem = {
  id: "image-2",
  name: "earphone-case.png",
  description: "0.9 MB",
  state: ATTACHMENT_STATE.DONE,
  preview: SAMPLE_ITEM_URLS[1],
};

const meta = {
  title: "Features/Admin/Products/ImagesSection",
  component: ProductImagesSection,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component: [
          "商品の画像の段です。**選んだ時点で送り**、商品そのものの送信に載るのは送り終わったオブジェクトキーだけです。",
          "並び順がそのまま表示順になります。送っている枚・送れなかった枚は一覧の側に出て、受け口は渡し終えたら空へ戻ります。",
        ].join(""),
      },
    },
  },
  args: {
    idPrefix: "create",
    images: images([]),
    maxUploadBytes: MAX_UPLOAD_BYTES,
    onReject: fn(),
  },
  decorators: [(Story) => <div className="max-w-2xl">{Story()}</div>],
} satisfies Meta<typeof ProductImagesSection>;

export default meta;
type Story = StoryObj<typeof meta>;

/** まだ 1 枚も選んでいない状態。画像が無くても登録できることを説明が言う。 */
export const Empty: Story = {};

/** 送り終わった状態。並び順がそのまま表示順で、入れ替えと取り消しがそれぞれの枚に付く。 */
export const Uploaded: Story = {
  args: {
    images: images(
      [DONE_ITEM, SECOND_ITEM],
      ["products/earphone-front.png", "products/earphone-case.png"],
    ),
  },
};

/** 送っている最中。送り終わるまで商品そのものの登録は押せない。 */
export const Uploading: Story = {
  args: {
    images: images([
      DONE_ITEM,
      { ...SECOND_ITEM, state: ATTACHMENT_STATE.UPLOADING, description: "送信中…" },
    ]),
  },
};

/** 送れなかった枚がある状態。その枚だけをやり直せる。 */
export const Failed: Story = {
  args: {
    images: images([
      DONE_ITEM,
      { ...SECOND_ITEM, state: ATTACHMENT_STATE.ERROR, description: "送れませんでした" },
    ]),
  },
};

/** 受け付けられないファイルを選んだ状態。文言は呼び出し元が組み立てて渡す。 */
export const Rejected: Story = {
  args: {
    rejection: "earphone.heic は受け付けられません。PNG / JPEG / WebP を 4.0 MB まで選べます。",
  },
};
