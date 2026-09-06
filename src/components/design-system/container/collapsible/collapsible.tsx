import type { ComponentProps } from "react";

import { cn } from "@/components/cn";
import { ChevronDownIcon } from "@/components/icon";

/**
 * 単一の補助領域を開閉する SSR first の collapsible。
 *
 * @remarks
 * native の `details` を使うため hydration を必要としない。外部 state との同期や開閉 animation が
 * 必要な場合は、利用画面に最小の client island を置く。
 *
 * @see Storybook `Container/Collapsible`
 */
export function Collapsible({ className, ...props }: ComponentProps<"details">) {
  return (
    <details
      className={cn("group/collapsible rounded-md border border-border", className)}
      data-slot="collapsible"
      {...props}
    />
  );
}

/**
 * {@link Collapsible} を開閉する native の `summary`。
 *
 * @see Storybook `Container/Collapsible`
 */
export function CollapsibleTrigger({ className, children, ...props }: ComponentProps<"summary">) {
  return (
    <summary
      className={cn(
        "flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 text-left text-sm font-emphasis transition-colors hover:bg-foreground hover:text-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active focus-visible:shadow-glow-primary [&::-webkit-details-marker]:hidden",
        className,
      )}
      data-slot="collapsible-trigger"
      {...props}
    >
      {children}
      <ChevronDownIcon
        aria-hidden="true"
        className="size-4 shrink-0 text-muted-foreground transition-transform group-open/collapsible:rotate-180"
      />
    </summary>
  );
}

/**
 * {@link Collapsible} が開いたときだけ表示される補助内容。
 *
 * @see Storybook `Container/Collapsible`
 */
export function CollapsibleContent({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("border-t border-border px-4 py-3 text-sm text-muted-foreground", className)}
      data-slot="collapsible-content"
      {...props}
    />
  );
}
