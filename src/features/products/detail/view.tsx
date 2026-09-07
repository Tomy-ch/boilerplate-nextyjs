import { PrintButton } from "@/components/design-system/action/print-button/print-button";
import { Badge } from "@/components/design-system/display/badge/badge";
import {
  KeyValueEmpty,
  KeyValueItem,
  KeyValueLabel,
  KeyValueList,
  KeyValueValue,
} from "@/components/design-system/display/key-value-list/key-value-list";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/design-system/navigation/breadcrumb/breadcrumb";
import { RichTextContent } from "@/components/design-system/rich-text/rich-text-content/rich-text-content";
import { ActionBar } from "@/components/patterns/action-bar/action-bar";
import { ACTION_BAR_POSITION } from "@/components/patterns/action-bar/action-bar.definition";
import { AddToCartButton } from "@/features/cart/facade/add-to-cart/add-to-cart-button";
import { formatDateTime } from "@/model/datetime";
import type { Product } from "@/model/product/product";
import { SanitizedRichText } from "@/model/rich-text/sanitized-rich-text";
import { withScreenSpan } from "@/observability/render-span";
import { PRODUCT_LIST_PATH } from "../facade/list-url/list-url";
import { ProductGallery } from "./ui/gallery/gallery";

const DESCRIPTION_HEADING_ID = "product-description";

type ProductDetailProps = {
  readonly product: Product;
  /** 表示順に並べた画像 URL。解決は feature 側の取得で済ませておく。 */
  readonly imageUrls: readonly string[];
};

/**
 * 商品 1 件の詳細表示。
 *
 * @remarks
 * description は生の HTML 文字列としては扱わず、`SanitizedRichText` を経由して
 * `RichTextContent` へ渡します。feature が文字列を持つと、渡す前に sanitize したかどうかが
 * 呼び出し側の規律の問題になります。
 *
 * 在庫が少ないかどうかの境界はバックエンドが `stockWarningThreshold` で供給します。ここが持つのは
 * 境界を跨いだ時に何を見せるかだけです。
 *
 * パンくずを置くのは、一覧・分類・トップのどこからでも入る画面で、global nav から 1 手で戻れない
 * 祖先を持つためです。示すのは辿った経路ではなくサイト構造上の階層です。
 *
 * 現在地の商品名は幅で詰めます。契約の上限は 255 文字で、そのまま置くと現在地だけで数行を占め、
 * 階層を一目で読み取るという役割が失われます。文字数で切らないのは、書記素の切れ目を跨いで
 * 壊す形にしないためと、同じ文字数でも和文と欧文で占める幅が違うためです。詰めても情報は
 * 落ちません。全文は真下の見出しにあり、読み上げには全文が渡ります。
 *
 * 紙に出すのは内容だけです。押せない操作（パンくず・画像の送り・一覧・カートへの追加・印刷そのもの）
 * は紙面の場所を取るだけなので落とします。
 */
export const ProductDetail = withScreenSpan(
  "features/products/detail/view",
  ({ product, imageUrls }: ProductDetailProps) => {
    const isLowStock =
      product.stockWarningThreshold !== null && product.quantity <= product.stockWarningThreshold;

    return (
      <article className="flex flex-col gap-8 pb-24 lg:pb-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Breadcrumb className="print-hidden">
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/">トップ</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink href={PRODUCT_LIST_PATH}>商品一覧</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                {/* 長さの上限をバックエンドが決める値なので、1 行に収まる前提を置けない。 */}
                <BreadcrumbPage className="max-w-40 truncate">{product.name}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <PrintButton />
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          <ProductGallery imageUrls={imageUrls} productName={product.name} />

          <div className="flex flex-col items-start gap-6">
            <div className="flex flex-wrap items-center gap-2">
              {/* 長さの上限をバックエンドが決める値なので、1 行に収まる前提を置けない。 */}
              <Badge className="whitespace-normal break-words" variant="secondary">
                {product.category.name}
              </Badge>
              <Badge className="whitespace-normal break-words" variant="outline">
                {product.status.name}
              </Badge>
            </div>

            <h1 className="text-3xl font-emphasis tracking-tight">{product.name}</h1>

            <p className="text-3xl font-emphasis">{`$${product.price}`}</p>

            <KeyValueList className="w-full">
              <KeyValueItem>
                <KeyValueLabel>在庫</KeyValueLabel>
                <KeyValueValue className="flex flex-wrap items-center gap-2">
                  {`${product.quantity} 個`}
                  {product.quantity === 0 ? <Badge variant="destructive">在庫なし</Badge> : null}
                  {product.quantity > 0 && isLowStock ? (
                    <Badge variant="outline">残りわずか</Badge>
                  ) : null}
                </KeyValueValue>
              </KeyValueItem>
              <KeyValueItem>
                <KeyValueLabel>公開日時</KeyValueLabel>
                <KeyValueValue>
                  {product.publishedAt === null ? (
                    <KeyValueEmpty>未公開</KeyValueEmpty>
                  ) : (
                    formatDateTime(product.publishedAt)
                  )}
                </KeyValueValue>
              </KeyValueItem>
            </KeyValueList>

            <ActionBar
              className="w-full print-hidden"
              position={ACTION_BAR_POSITION.FIXED_WITHOUT_ASIDE}
            >
              <AddToCartButton productId={product.id} stockQuantity={product.quantity} />
            </ActionBar>
          </div>
        </div>

        {product.description === null ? null : (
          <section aria-labelledby={DESCRIPTION_HEADING_ID} className="flex flex-col gap-3">
            <h2 className="text-lg font-emphasis" id={DESCRIPTION_HEADING_ID}>
              商品説明
            </h2>
            <RichTextContent content={SanitizedRichText.from(product.description)} />
          </section>
        )}
      </article>
    );
  },
);
