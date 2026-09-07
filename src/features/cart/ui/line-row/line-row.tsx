import Link from "next/link";

import { cn } from "@/components/cn";
import { MediaImage } from "@/components/design-system/display/media-image/media-image";
import { MEDIA_IMAGE_ASPECT_RATIO } from "@/components/design-system/display/media-image/media-image.definition";
import type { CartLine } from "@/model/cart/cart";
import { hasBlockingIssue } from "@/model/cart/issue-notice";
import { NO_IMAGE_URL } from "@/model/media";
import { withPartSpan } from "@/observability/render-span";
import { CartLineIssues } from "../../facade/line-issues/line-issues";
import { CartMatchStockButton } from "../match-stock-button/match-stock-button";
import { CartQuantityStepper } from "../quantity-stepper/quantity-stepper";
import { CartRemoveButton } from "../remove-button/remove-button";

/** `CartLineRow` の props。 */
export type CartLineRowProps = {
  /** 表示する明細。 */
  line: CartLine;
};

/** 商品を引けなかった明細に出す名前。 */
const UNKNOWN_NAME = "取得できない商品";

/** 事情の立った明細に添える、この画面での帰結。 */
const SUBTOTAL_NOTE = "小計には含めていません。";

/**
 * カートの明細 1 行。
 *
 * @remarks
 * 脇の領域と全画面の両方が使います。幅の違いは折り返しで吸収し、器ごとに別の行を持ちません。
 * 狭い器では操作が名前の下へ回り、広い器では同じ行に並びます。サムネイルも器の幅で縮めます
 * （`docs/rules.md`「レイアウトと帯」の「部品の中身は帯で分岐させずコンテナクエリで書く」）。
 *
 * **商品状態は出しません。** 契約が返す明細に無く、出すには明細の数だけ商品を引くことになります。
 *
 * **サムネイルは装飾として出します。** 代替テキストを空にし、詳細への導線も持たせません。名前は
 * 隣の文字が持っており、画像にも持たせると読み上げで同じ名前が二度続き、同じ行き先の導線が 1 行に
 * 2 つ並びます。
 *
 * 金額は単価だけを出します。行ごとの小計を出すには単価と数量を掛ける必要があり、それは金額の
 * 計算をフロントに戻すことになります。合算した値はカートの小計としてバックエンドが返します。
 *
 * 買えない明細は弱めて見せます。**取り除く操作は弱めません** — 買えない明細に対して利用者が取れる
 * 行動がそれだからです。
 *
 * **在庫が足りない明細には、その数へ合わせる操作が生えます。** 事情として今買える数が届いている
 * 以上、利用者に数え直させる理由がありません。在庫が 1 つも無い明細には出しません（合わせる先が
 * ありません）。
 */
export const CartLineRow = withPartSpan(
  "features/cart/ui/line-row/line-row",
  ({ line }: CartLineRowProps) => {
    const blocked = hasBlockingIssue(line);
    const label = line.name ?? UNKNOWN_NAME;

    return (
      <li className="@container/line flex flex-wrap items-start gap-x-4 gap-y-2 py-4">
        <MediaImage
          alt=""
          aspectRatio={MEDIA_IMAGE_ASPECT_RATIO.SQUARE}
          className={cn("w-12 shrink-0 rounded-md @sm/line:w-16", blocked && "opacity-60")}
          fallbackSrc={NO_IMAGE_URL}
          sizes="4rem"
          src={line.imageUrl}
        />
        <div className="flex min-w-0 flex-1 basis-40 flex-col gap-1">
          {line.name === null ? (
            <p className="font-emphasis text-muted-foreground text-sm">{UNKNOWN_NAME}</p>
          ) : (
            <Link
              className={cn(
                "line-clamp-2 font-emphasis text-sm hover:underline",
                blocked && "text-muted-foreground",
              )}
              href={`/products/${line.productId}`}
            >
              {line.name}
            </Link>
          )}
          {line.unitPrice === null ? null : (
            <p className={cn("text-sm", blocked ? "text-muted-foreground" : undefined)}>
              {`$${line.unitPrice} / 個`}
            </p>
          )}
          <CartLineIssues
            availableQuantity={line.availableQuantity}
            issues={line.issues}
            note={SUBTOTAL_NOTE}
          />
          {line.availableQuantity === null || line.availableQuantity <= 0 ? null : (
            <CartMatchStockButton
              availableQuantity={line.availableQuantity}
              label={label}
              productId={line.productId}
            />
          )}
        </div>
        <div className="flex items-start gap-1">
          <CartQuantityStepper
            label={label}
            max={line.availableQuantity ?? undefined}
            productId={line.productId}
            quantity={line.quantity}
          />
          <CartRemoveButton label={label} productId={line.productId} quantity={line.quantity} />
        </div>
      </li>
    );
  },
);
