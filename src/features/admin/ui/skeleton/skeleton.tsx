import { Skeleton } from "@/components/design-system/status/skeleton/skeleton";
import { withPartSpan } from "@/observability/render-span";

/** 数値カードの枚数。`summary-cards.ts` が返す並びと揃える。 */
const CARD_COUNT = 4;

/**
 * カードの枠と、その下に続く帯の高さを出す、集計の待機表示。
 *
 * @remarks
 * スピナー 1 つで代用すると、描画された瞬間に高さが変わり、下に置いたものの位置が動きます。
 */
export const AdminSummarySkeleton = withPartSpan("features/admin/ui/skeleton/skeleton", () => {
  return (
    <div aria-hidden="true" className="space-y-8">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {Array.from({ length: CARD_COUNT }, (_, index) => index).map((index) => (
          <Skeleton className="h-28 w-full" key={index} />
        ))}
      </div>
      <div className="space-y-4">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-56 w-full" />
      </div>
    </div>
  );
});
