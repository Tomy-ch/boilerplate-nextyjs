import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
} from "@/components/design-system/display/card/card";
import {
  KeyValueItem,
  KeyValueLabel,
  KeyValueList,
  KeyValueValue,
} from "@/components/design-system/display/key-value-list/key-value-list";
import { Skeleton } from "@/components/design-system/status/skeleton/skeleton";
import { withPartSpan } from "@/observability/render-span";

/** 届け先に並べる項目数。[`../shipping-card/`](../shipping-card/shipping-card.tsx) と同じ。 */
const PLACEHOLDER_FIELDS = 4;

/** 枠だけで見せる明細の行数。多すぎると、実際より入っているように見える。 */
const PLACEHOLDER_ROWS = 3;

const FIELDS = Array.from({ length: PLACEHOLDER_FIELDS }, (_, index) => index);

const ROWS = Array.from({ length: PLACEHOLDER_ROWS }, (_, index) => index);

/**
 * 出来上がりと同じ器（`Card` / `KeyValueList`）で組む、購入確認の待機表示。
 *
 * @remarks
 * 高さを数値で予約しません
 * （`docs/rules.md`「UI 部品と操作」の「高さを数値で予約して揃えない」）。
 *
 * 集計は広い画面にしか出しません。狭い画面では固定の操作帯が持つため、器の側と同じく
 * `lg` から出し、下端の余白（`pb-40`）も同じだけ空けます。
 */
export const CheckoutConfirmSkeleton = withPartSpan(
  "features/checkout/confirm/ui/skeleton/skeleton",
  () => {
    return (
      <div
        aria-hidden="true"
        className="flex flex-col gap-8 pb-40 lg:flex-row lg:items-start lg:pb-0"
      >
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
              <CardAction>
                <Skeleton className="h-8 w-24" />
              </CardAction>
            </CardHeader>
            <CardContent>
              <KeyValueList>
                {FIELDS.map((field) => (
                  <KeyValueItem key={field}>
                    <KeyValueLabel>
                      <Skeleton className="h-4 w-20" />
                    </KeyValueLabel>
                    <KeyValueValue>
                      <Skeleton className="h-4 w-full" />
                    </KeyValueValue>
                  </KeyValueItem>
                ))}
              </KeyValueList>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-40" />
              <CardAction>
                <Skeleton className="h-8 w-32" />
              </CardAction>
            </CardHeader>
            <CardContent className="flex flex-col">
              <ul className="divide-y">
                {ROWS.map((row) => (
                  <li className="flex flex-wrap items-start gap-x-4 gap-y-1 py-4" key={row}>
                    <div className="flex min-w-0 flex-1 basis-40 flex-col gap-1">
                      <Skeleton className="h-5 w-48" />
                      <Skeleton className="h-5 w-24" />
                    </div>
                    <Skeleton className="h-5 w-12" />
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        <div className="hidden w-full flex-col gap-4 rounded-lg border p-4 lg:flex lg:w-80">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    );
  },
);
