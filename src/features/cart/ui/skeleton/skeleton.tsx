import { Skeleton } from "@/components/design-system/status/skeleton/skeleton";
import { withPartSpan } from "@/observability/render-span";

/** 枠だけで見せる明細の数。1 画面に収まる範囲に留め、実際より入っているように見せない。 */
const PLACEHOLDER_ROWS = 3;

const ROWS = Array.from({ length: PLACEHOLDER_ROWS }, (_, index) => index);

/**
 * 実物と同じ段組みで枠を出す、カートの待機表示。
 *
 * @remarks
 * 明細と、脇に貼り付く集計の 2 段を、帯ごとの並び方まで揃えます。縦 1 列で待つと、届いた瞬間に
 * 段組みが立ち上がって明細の位置が動きます
 * （`docs/rules.md`「状態表示と待機」の「loading は形状が近い skeleton を優先する」と
 * 「UI 部品と操作」の「状態で出入りする表示で操作の位置を動かさない」）。
 *
 * **高さは 1 画面ぶん確保します。** 枠だけの明細は実物より短く、その差ぶん footer が画面の中から
 * 下へ押し出されて layout shift になります。footer を最初から画面の外に置いておけば、中身が
 * 届いて伸びても動いたことにはなりません。
 */
export const CartSkeleton = withPartSpan("features/cart/ui/skeleton/skeleton", () => {
  return (
    <div
      aria-hidden="true"
      className="flex min-h-svh flex-col gap-8 pb-24 lg:flex-row lg:items-start lg:pb-0"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <ul className="divide-y border-y">
          {ROWS.map((row) => (
            <li className="flex items-center gap-4 py-4" key={row}>
              <Skeleton className="size-16 shrink-0" />
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-4 w-24" />
              </div>
              <Skeleton className="h-9 w-24" />
              <Skeleton className="h-5 w-16" />
            </li>
          ))}
        </ul>
        <div className="flex justify-end">
          <Skeleton className="h-9 w-32" />
        </div>
      </div>
      <div className="hidden w-full rounded-lg border p-4 lg:block lg:w-80">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="mt-4 h-8 w-32" />
        <Skeleton className="mt-6 h-11 w-full" />
      </div>
    </div>
  );
});
