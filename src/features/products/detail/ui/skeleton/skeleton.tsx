import { Skeleton } from "@/components/design-system/status/skeleton/skeleton";
import { withPartSpan } from "@/observability/render-span";

/**
 * 商品詳細の待機表示。
 *
 * @remarks
 * 実物と同じ 2 段組みの枠を出します。1 本のスピナーで代用すると、届いた瞬間に段組みが立ち上がって
 * 読み始めた位置が動きます（`docs/rules.md`「状態表示と待機」の「loading は形状が近い skeleton を
 * 優先する」）。
 */
export const ProductDetailSkeleton = withPartSpan(
  "features/products/detail/ui/skeleton/skeleton",
  () => {
    return (
      <div aria-hidden="true" className="flex flex-col gap-8 pb-24 lg:pb-0">
        <Skeleton className="h-5 w-48" />
        <div className="grid gap-8 lg:grid-cols-2">
          <Skeleton className="aspect-square w-full" />
          <div className="flex flex-col items-start gap-6">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-9 w-3/4" />
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-11 w-40" />
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      </div>
    );
  },
);
