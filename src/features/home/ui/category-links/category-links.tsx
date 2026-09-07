import Link from "next/link";

import { Badge } from "@/components/design-system/display/badge/badge";
import { BADGE_VARIANT } from "@/components/design-system/display/badge/badge.definition";
import { FILTER_KEY, toProductListHref } from "@/features/products/facade/list-url/list-url";
import type { ProductCategory } from "@/model/product/product";
import { withPartSpan } from "@/observability/render-span";

/** `CategoryLinks` の props。 */
export type CategoryLinksProps = {
  /** 並べる分類。空なら節ごと描かない。 */
  categories: readonly ProductCategory[];
};

/**
 * 分類から一覧へ入る導線。
 *
 * @remarks
 * 遷移先の URL は一覧の面が組みます。キーの綴りを写して持つと、一覧が契約に合わせてキーを
 * 変えたときにこちら側だけが古いままになり、絞り込まれない一覧へ飛びます。
 *
 * 数が読めないので折り返します。分類はバックエンドが持つ運用の値で、いくつまでという上限を
 * 表示側が置けません。
 *
 * 空のときは何も描きません。「分類がありません」は利用者が取れる行動を持たない告知で、
 * トップに残しても場所を取るだけです。
 */
export const CategoryLinks = withPartSpan(
  "features/home/ui/category-links/category-links",
  ({ categories }: CategoryLinksProps) => {
    if (categories.length === 0) {
      return null;
    }

    return (
      <section>
        <h2 className="text-lg font-emphasis">カテゴリから探す</h2>
        <ul className="mt-4 flex flex-wrap gap-2">
          {categories.map((category) => (
            <li key={category.id}>
              <Badge asChild variant={BADGE_VARIANT.OUTLINE}>
                <Link href={toProductListHref({ [FILTER_KEY.CATEGORY]: String(category.code) })}>
                  {category.name}
                </Link>
              </Badge>
            </li>
          ))}
        </ul>
      </section>
    );
  },
);
