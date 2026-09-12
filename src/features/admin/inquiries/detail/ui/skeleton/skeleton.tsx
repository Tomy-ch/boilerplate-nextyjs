import { Skeleton } from "@/components/design-system/status/skeleton/skeleton";
import { withPartSpan } from "@/observability/render-span";

/** 待機中に並べる吹き出しの数。何通あるかは取得しないと分からない。 */
export const PLACEHOLDER_MESSAGES = 4;

const MESSAGES = Array.from({ length: PLACEHOLDER_MESSAGES }, (_, index) => index);

/** 問い合わせ 1 件の待機表示。回答欄の位置が後から動かないよう、同じ高さの枠を先に置く。 */
export const AdminInquiryDetailSkeleton = withPartSpan(
  "features/admin/inquiries/detail/ui/skeleton/skeleton",
  () => {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-16 w-full" />
        <div className="flex flex-col gap-4">
          {MESSAGES.map((index) => (
            <Skeleton
              className={index % 2 === 0 ? "h-12 w-3/5" : "h-12 w-3/5 self-end"}
              key={index}
            />
          ))}
        </div>
        <Skeleton className="h-28 w-full" />
      </div>
    );
  },
);
