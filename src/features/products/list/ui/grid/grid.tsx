import { MEDIA_IMAGE_PRIORITY } from "@/components/design-system/display/media-image/media-image.definition";
import type { ProductListItem } from "@/model/product/product";
import { withPartSpan } from "@/observability/render-span";
import { ProductCard } from "../card/card";

/** `ProductGrid` の props。 */
export type ProductGridProps = {
  /** 表示する商品。空なら空状態を描く。 */
  items: readonly ProductListItem[];
};

/** 一覧の先頭何件を LCP 候補として扱うか。折り返し前に見える範囲に合わせる。 */
const LEADING_COUNT = 3;

/**
 * 商品を並べる。
 *
 * @remarks
 * 取得も読み進めも持ちません。渡されたものを並べるだけにしてあるのは、同じ並びを検索結果・
 * カテゴリ別・ランキングのいずれからも使うためです。
 *
 * 段の数は器の幅で決めます。脇に絞り込みが常設される幅では本文の取り分がその分狭くなるため、
 * viewport で決めると同じ viewport でも詰まって見える帯ができます（`docs/rules.md`「レイアウトと帯」の
 * 「部品の中身は帯で分岐させずコンテナクエリで書く」）。
 *
 * 空の場合に「0 件」とだけ出さないのは、利用者が次に何をすればよいか分からないためです。
 *
 * 並び自体に名前を与えます。1 つの画面には絞り込みの選択肢や global nav といった別の一覧も
 * 並ぶため、名前が無いと支援技術からはどれが結果の一覧かを言い分けられません。
 */
export const ProductGrid = withPartSpan(
  "features/products/list/ui/grid/grid",
  ({ items }: ProductGridProps) => {
    if (items.length === 0) {
      return (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="font-emphasis">条件に合う商品がありません</p>
          <p className="mt-2 text-muted-foreground text-sm">
            キーワードを短くするか、絞り込みを外してください。
          </p>
        </div>
      );
    }

    return (
      <div className="@container/list">
        <ul aria-label="商品の一覧" className="grid grid-cols-1 gap-4 @4xl/list:grid-cols-2">
          {items.map((item, index) => (
            <li key={item.id}>
              <ProductCard
                imagePriority={
                  index < LEADING_COUNT ? MEDIA_IMAGE_PRIORITY.PRELOAD : MEDIA_IMAGE_PRIORITY.LAZY
                }
                item={item}
              />
            </li>
          ))}
        </ul>
      </div>
    );
  },
);
