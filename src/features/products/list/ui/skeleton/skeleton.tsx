import { Skeleton } from "@/components/design-system/status/skeleton/skeleton";
import { withPartSpan } from "@/observability/render-span";

/** 一覧の待機表示で並べる件数。実際の初期取得件数と揃えず、折り返し 2 段分に留める。 */
const PLACEHOLDER_COUNT = 4;

/**
 * 実際に並ぶものと同じ形・同じ段組みで枠だけを出す、商品一覧の待機表示。
 *
 * @remarks
 * スピナー 1 つで代用すると、描画された瞬間に位置が動き、読み始めた場所を見失います。
 *
 * 段の数を器の幅で決めるのも並ぶものと揃えます。viewport で決めると、脇に絞り込みが常設される
 * 幅で待機表示だけが本文からはみ出します。
 */
export const ProductListSkeleton = withPartSpan(
  "features/products/list/ui/skeleton/skeleton",
  () => {
    return (
      <div className="@container/list">
        <ul aria-hidden="true" className="grid grid-cols-1 gap-4 @4xl/list:grid-cols-2">
          {Array.from({ length: PLACEHOLDER_COUNT }, (_, index) => index).map((index) => (
            <li className="flex gap-4 rounded-lg border p-4" key={index}>
              <Skeleton className="aspect-square w-24 shrink-0" />
              <div className="flex-1 space-y-3">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </li>
          ))}
        </ul>
      </div>
    );
  },
);
