import { Skeleton } from "@/components/design-system/status/skeleton/skeleton";
import { withPartSpan } from "@/observability/render-span";

/** 待機表示で並べる行数。実際の 1 ページ分と揃えず、表の形が伝わる高さに留める。 */
const PLACEHOLDER_ROWS = 6;

/**
 * 実際に並ぶものと同じ行の高さで枠だけを出す、利用者一覧の待機表示。
 *
 * @remarks
 * スピナー 1 つで代用すると、描画された瞬間に表の高さが変わり、下に置いたページ送りの位置が
 * 動きます。
 */
export const AdminUserListSkeleton = withPartSpan(
  "features/admin/users/ui/skeleton/skeleton",
  () => {
    return (
      <div aria-hidden="true" className="space-y-2">
        <Skeleton className="h-10 w-full" />
        {Array.from({ length: PLACEHOLDER_ROWS }, (_, index) => index).map((index) => (
          <Skeleton className="h-12 w-full" key={index} />
        ))}
      </div>
    );
  },
);
