import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/components/cn";

const alertVariants = cva(
  "relative grid w-full grid-cols-[0_1fr] items-start gap-y-0.5 rounded-lg border px-4 py-3 text-sm has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] has-[>svg]:gap-x-3 [&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current",
  {
    variants: {
      variant: {
        default: "bg-card backdrop-blur-panel text-card-foreground",
        warning:
          "border-warning/40 bg-warning/10 text-foreground *:data-[slot=alert-title]:text-warning *:data-[slot=alert-description]:text-muted-foreground [&>svg]:text-warning",
        destructive:
          "border-destructive/40 bg-destructive/10 text-foreground *:data-[slot=alert-title]:text-destructive *:data-[slot=alert-description]:text-muted-foreground [&>svg]:text-destructive",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

/**
 * 文脈内の注意・失敗などを `role="alert"` で伝える Server Component。
 *
 * @remarks
 * 表示専用であり、状態判定・再試行・dismiss・取得処理は持たない。通知が即時に必要な状態だけを
 * 呼び出し側で Alert として構成し、操作の成否をすべて一律に alert として通知しない。
 *
 * `role="alert"` を持つため、描画された時点で支援技術が内容を読み上げる。**最初から画面にある
 * 内容には使わない。** 常設の補足は `Marker`、mutation の結果は `FormFeedback` を使う。
 *
 * 先頭に icon を置く場合は、`Alert` の直下の子として渡すと見出しと本文の左へ配置される。
 *
 * @example
 * ```tsx
 * <Alert variant="warning">
 *   <AlertTitle>保存されていない変更があります</AlertTitle>
 *   <AlertDescription>数量を減らすか、入荷通知を受け取ってください。</AlertDescription>
 * </Alert>
 * ```
 *
 * @param props - native `div` 属性と `variant`。
 * @param props.variant - 伝える深刻度。`default` は補足、`warning` は続行できる注意、
 *   `destructive` は失敗や不可逆な結果を表す。
 * @see Storybook `Status/Alert`
 */
function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  );
}

/**
 * 何が起きたかを一行で伝える見出し。
 *
 * @remarks
 * 1 行に収まらない分は省略される。詳細は `AlertDescription` へ書く。見た目のみを持つ `div`
 * であり、文書構造上の見出しにはならない。
 *
 * @see Storybook `Status/Alert`
 */
function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn("col-start-2 line-clamp-1 min-h-4 font-emphasis tracking-tight", className)}
      {...props}
    />
  );
}

/**
 * 詳細と、利用者が次に取る行動を示す領域。
 *
 * @remarks
 * 行数の制限を持たないため、`AlertTitle` に収まらない説明はここへ書く。原因の技術的な内訳では
 * なく、**利用者が次に何をすればよいか**を書く。
 *
 * @see Storybook `Status/Alert`
 */
function AlertDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        "col-start-2 grid justify-items-start gap-1 text-sm text-muted-foreground [&_p]:leading-relaxed",
        className,
      )}
      {...props}
    />
  );
}

export { Alert, AlertDescription, AlertTitle };
