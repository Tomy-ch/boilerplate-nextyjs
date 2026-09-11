import { Skeleton } from "@/components/design-system/status/skeleton/skeleton";
import { withPartSpan } from "@/observability/render-span";
import { BASICS_FIELDS, STEP_IDS } from "../../steps";

/**
 * 最初の段階だけを象る、登録の待機表示。
 *
 * @remarks
 * 段階に分けた入力は一度に 1 つしか現れないので、全項目ぶんの枠を置くと待機のほうが長くなります。
 */
export const OnboardingSkeleton = withPartSpan(
  "features/account/onboarding/ui/skeleton/skeleton",
  () => {
    return (
      <div aria-hidden="true" className="flex max-w-2xl flex-col gap-6">
        <div className="flex gap-4">
          {STEP_IDS.map((step) => (
            <Skeleton className="h-6 flex-1" key={step} />
          ))}
        </div>
        {BASICS_FIELDS.map((field) => (
          <div className="flex flex-col gap-2" key={field}>
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
        <div className="flex justify-end gap-2">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-24" />
        </div>
      </div>
    );
  },
);
