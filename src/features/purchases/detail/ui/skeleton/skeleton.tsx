import { Skeleton } from "@/components/design-system/status/skeleton/skeleton";
import { withPartSpan } from "@/observability/render-span";

/** 枠だけで見せる明細の数。1 画面に収まる範囲に留め、実際より入っているように見せない。 */
const PLACEHOLDER_LINES = 3;

const LINES = Array.from({ length: PLACEHOLDER_LINES }, (_, index) => index);

/**
 * 実物と同じ段組み・同じ高さで枠を出す、購入詳細の待機表示。
 *
 * @remarks
 * 控えと集計の 2 枚、購入した商品の一覧、戻る導線まで、届いたときに位置が動く要素をすべて先に
 * 場所取りします。枠が実物より短いと、穴が埋まった瞬間に下の要素が押し下げられます（`docs/rules.md`「状態表示と待機」の
 * 「loading は形状が近い skeleton を優先する」と「UI 部品と操作」の
 * 「状態で出入りする表示で操作の位置を動かさない」）。
 */
export const PurchaseDetailSkeleton = withPartSpan(
  "features/purchases/detail/ui/skeleton/skeleton",
  () => {
    return (
      <div aria-hidden="true" className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-9 w-24" />
        </div>
        <div className="grid items-start gap-6 lg:grid-cols-2">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
        <div className="rounded-xl border p-6">
          <Skeleton className="h-6 w-48" />
          <ul className="mt-6 divide-y">
            {LINES.map((line) => (
              <li className="flex flex-wrap items-start gap-x-4 gap-y-1 py-4" key={line}>
                <div className="flex min-w-0 flex-1 basis-40 flex-col gap-1">
                  <Skeleton className="h-5 w-56" />
                  <Skeleton className="h-5 w-24" />
                </div>
                <Skeleton className="h-5 w-12" />
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-wrap gap-3">
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-9 w-36" />
        </div>
      </div>
    );
  },
);
