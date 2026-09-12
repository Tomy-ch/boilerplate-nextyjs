import { Skeleton } from "@/components/design-system/status/skeleton/skeleton";
import { APP_SHELL_HEADER_HEIGHT } from "@/components/shell/app-shell/app-shell.definition";
import { withPartSpan } from "@/observability/render-span";

/**
 * 待機中に並べる吹き出しの数。
 *
 * @remarks
 * 何通あるかは取得しないと分かりません。枠の高さは器が決めているため、ここが決めるのは
 * 「枠の中にいくつ置くか」だけで、実際の通数と違っても外枠は動きません。
 */
export const PLACEHOLDER_MESSAGES = 4;

const MESSAGES = Array.from({ length: PLACEHOLDER_MESSAGES }, (_, index) => index);

/** 送信欄の高さ。出来上がりの `rows={3}` と同じ見え方にする。 */
const COMPOSER_HEIGHT = "h-24";

/**
 * 問い合わせの待機表示。
 *
 * @remarks
 * 出来上がりと同じ高さの器を先に置きます。枠の高さが後から決まる形にすると、やり取りが届いた
 * 瞬間に送信欄の位置が動きます。
 */
export const InquiryThreadSkeleton = withPartSpan(
  "features/inquiry/thread/ui/skeleton/skeleton",
  () => {
    return (
      <div
        className="flex min-h-0 flex-col gap-4"
        style={{ height: `calc(100dvh - ${APP_SHELL_HEADER_HEIGHT}px - 2rem)` }}
      >
        <div className="flex flex-1 flex-col justify-end gap-4">
          {MESSAGES.map((index) => (
            <Skeleton
              className={index % 2 === 0 ? "h-12 w-3/5" : "h-12 w-3/5 self-end"}
              key={index}
            />
          ))}
        </div>
        <Skeleton className={`w-full ${COMPOSER_HEIGHT}`} />
      </div>
    );
  },
);
