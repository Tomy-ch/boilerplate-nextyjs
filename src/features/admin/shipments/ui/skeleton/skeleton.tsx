import { Skeleton } from "@/components/design-system/status/skeleton/skeleton";
import { withPartSpan } from "@/observability/render-span";

/** 待機表示で並べる組の数。実際の件数と揃えず、便が縦に積まれる形が伝わる数に留める。 */
const PLACEHOLDER_GROUPS = 3;

/**
 * 実際に並ぶ組と同じ高さで枠だけを出す、発送待ちの待機表示。
 *
 * @remarks
 * 代用で高さが変わると読み始めた位置が動く理由は
 * [画面要件](../../../../../../docs/spec/route/admin/shipments/page.screen.md)「待機」。
 */
export const ShipmentQueueSkeleton = withPartSpan(
  "features/admin/shipments/ui/skeleton/skeleton",
  () => {
    return (
      <div aria-hidden="true" className="flex flex-col gap-4">
        {Array.from({ length: PLACEHOLDER_GROUPS }, (_, index) => index).map((index) => (
          <Skeleton className="h-48 w-full" key={index} />
        ))}
      </div>
    );
  },
);
