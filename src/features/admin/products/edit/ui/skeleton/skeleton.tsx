import { Skeleton } from "@/components/design-system/status/skeleton/skeleton";
import { withPartSpan } from "@/observability/render-span";

/** 待機表示で並べる入力欄の数。最初に開く観点の欄数と揃えず、フォームの形が伝わる高さに留める。 */
const PLACEHOLDER_FIELDS = 4;

/**
 * 観点の切り替え・入力欄の並び・送信を、実際と同じ高さで出す待機表示。
 *
 * @remarks
 * 一覧の待機表示を流用すると、表の行が並んでからフォームが現れることになり、何を待っているかが
 * 伝わりません。
 */
export const AdminProductEditSkeleton = withPartSpan(
  "features/admin/products/edit/ui/skeleton/skeleton",
  () => {
    return (
      <div aria-hidden="true" className="grid gap-8">
        <Skeleton className="h-10 w-full max-w-md" />
        <div className="grid gap-6">
          {Array.from({ length: PLACEHOLDER_FIELDS }, (_, index) => index).map((index) => (
            <Skeleton className="h-20 w-full" key={index} />
          ))}
        </div>
        <Skeleton className="h-10 w-32" />
      </div>
    );
  },
);
