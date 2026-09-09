"use client";

import { Progress as ProgressPrimitive } from "radix-ui";
import type { ComponentProps } from "react";

import { cn } from "@/components/cn";

/** {@link ProgressClient} の props。 */
export type ProgressClientProps = Omit<
  ComponentProps<typeof ProgressPrimitive.Root>,
  "max" | "value"
> & {
  /**
   * 進捗部分へ与える class。更新間隔に合わせて transition の時間や easing を変える場合に指定する。
   * `className` は外枠にしか届かないため、進捗部分の指定はこちらで行う。
   */
  indicatorClassName?: string;
  /** 進捗の最大値。 */
  max?: number;
  /** 現在の進捗値。`0` 以上 `max` 以下で指定する。 */
  value: number;
};

/**
 * browser 側で更新される進捗度を表示する client island の progress 部品。
 *
 * @remarks
 * 進捗部分を独立した要素として描画するため、`ProgressNative` と違い browser 固有の擬似要素に
 * 依存せず見た目を揃えられる。値が変わると幅の変化が CSS transition で補間されるため、送信量の
 * 計測値のように短い間隔で更新される進捗に向く。`prefers-reduced-motion` 時は補間しない。
 *
 * hydration が必要で、Server Component からは直接 render できない。値の保持と更新は呼び出し元の
 * client island が持ち、この component は state も timer も購読も持たない。URL や Server 側で
 * 確定した進捗を表示するだけなら `ProgressNative` を使う。骨格を見せるだけでよい待機には
 * `Skeleton` を使う。
 *
 * `progressbar` role として公開され、値は `value` と `max` から百分率として読み上げられる。要素
 * 自体は名前を持たないため、`aria-label` か `aria-labelledby` でアクセシブルな名前を必ず与える。
 * 実体は `div` で labelable 要素ではないため、`ProgressNative` と違い `label` の `htmlFor` では
 * 名前が付かない。
 *
 * 完了時期が不明な進捗（indeterminate）は扱わない。待機の表現は `Skeleton` / `Shimmer` が担う
 * ため、進捗部品は値の判っている進捗だけを引き受ける。
 *
 * @see Storybook `Status/ProgressClient`
 */
export function ProgressClient({
  className,
  indicatorClassName,
  max = 100,
  value,
  ...props
}: ProgressClientProps) {
  return (
    <ProgressPrimitive.Root
      className={cn("relative h-2 w-full overflow-hidden rounded-full bg-border", className)}
      data-slot="progress"
      max={max}
      value={value}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className={cn(
          "h-full w-full flex-1 bg-foreground transition-all motion-reduce:transition-none",
          indicatorClassName,
        )}
        data-slot="progress-indicator"
        style={{ transform: `translateX(-${100 - (value / max) * 100}%)` }}
      />
    </ProgressPrimitive.Root>
  );
}
