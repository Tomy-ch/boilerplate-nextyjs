import { Skeleton } from "@/components/design-system/status/skeleton/skeleton";
import { withPartSpan } from "@/observability/render-span";

/** 新着の待機表示で並べる件数。折り返し 1 段分に留める。 */
const TEASER_COUNT = 4;

/** ランキングの待機表示で並べる行数。実際に載せる件数と揃える。 */
const RANKING_ROW_COUNT = 5;

/**
 * 節ごとに違う形で枠を出す、トップの待機表示。
 *
 * @remarks
 * どちらも同じ枠にすると、出てきた瞬間に高さが変わってページ全体が跳ねます。
 *
 * 見出しの文字は枠にしません。取得を待たずに確定している文言で、枠に置き換えると出てくる
 * ときに 2 度読ませることになります。
 *
 * 分類の帯を持ちません。待機の対象ではないためです
 * （[categories-content.tsx](../../categories-content.tsx)）。
 */
export const HomeSkeleton = withPartSpan("features/home/ui/skeleton/skeleton", () => {
  return (
    <div aria-hidden="true" className="space-y-10">
      <section>
        <h2 className="text-lg font-emphasis">新着商品</h2>
        <div className="@container/new-arrivals mt-4">
          <ul className="grid grid-cols-2 gap-4 @2xl/new-arrivals:grid-cols-4">
            {Array.from({ length: TEASER_COUNT }, (_, index) => index).map((index) => (
              <li className="overflow-hidden rounded-xl border" key={index}>
                <Skeleton className="aspect-square w-full rounded-none" />
                <div className="space-y-2 p-3">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/3" />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>
      <section>
        <h2 className="text-lg font-emphasis">売れ筋ランキング</h2>
        <ul className="mt-4 space-y-1">
          {Array.from({ length: RANKING_ROW_COUNT }, (_, index) => index).map((index) => (
            <li className="flex items-center gap-4 py-3" key={index}>
              <Skeleton className="size-6 shrink-0" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-12 shrink-0" />
              <Skeleton className="h-4 w-20 shrink-0" />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
});
