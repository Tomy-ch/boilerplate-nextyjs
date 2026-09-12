import { Skeleton } from "@/components/design-system/status/skeleton/skeleton";
import { withPartSpan } from "@/observability/render-span";

/**
 * 待機表示が並べる行数。
 *
 * @remarks
 * 何件あるかは取得しないと分かりません。契約が返す 1 ページの既定件数ではなく、画面に無理なく
 * 収まる数を置いてあります。
 */
export const PLACEHOLDER_ROWS = 8;

const ROWS = Array.from({ length: PLACEHOLDER_ROWS }, (_, index) => index);

/** 問い合わせ一覧の待機表示。 */
export const AdminInquiryListSkeleton = withPartSpan(
  "features/admin/inquiries/list/ui/skeleton/skeleton",
  () => {
    return (
      <div className="space-y-2">
        {ROWS.map((index) => (
          <Skeleton className="h-12 w-full" key={index} />
        ))}
      </div>
    );
  },
);
