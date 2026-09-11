import { Skeleton } from "@/components/design-system/status/skeleton/skeleton";
import { withPartSpan } from "@/observability/render-span";

/** 待機表示で並べる入力欄の数。最初の段が持つ欄数と揃えず、フォームの形が伝わる高さに留める。 */
const PLACEHOLDER_FIELDS = 4;

/**
 * 進捗・入力欄の並び・段を行き来する操作を、実際と同じ高さで出す待機表示。
 *
 * @remarks
 * 編集の待機表示を流用すると、先頭に出る枠が観点の切り替えの形になり、段階に分けて進む画面だと
 * 伝わりません。
 */
export const AdminProductCreateSkeleton = withPartSpan(
  "features/admin/products/new/ui/skeleton/skeleton",
  () => {
    return (
      <div aria-hidden="true" className="grid gap-8">
        <Skeleton className="h-8 w-full" />
        <div className="grid gap-6">
          {Array.from({ length: PLACEHOLDER_FIELDS }, (_, index) => index).map((index) => (
            <Skeleton className="h-20 w-full" key={index} />
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-24" />
        </div>
      </div>
    );
  },
);
