import type { ComponentProps } from "react";

import { cn } from "@/components/cn";

/** {@link ProgressNative} の props。 */
export type ProgressNativeProps = Omit<ComponentProps<"progress">, "max" | "value"> & {
  /** 進捗の最大値。 */
  max?: number;
  /** 現在の進捗値。`0` 以上 `max` 以下で指定する。 */
  value: number;
};

/**
 * 長さの決まった処理の進捗度を表示する、SSR first の native progress 部品。
 *
 * @remarks
 * native `progress` 要素をそのまま使うため、初期表示に browser JavaScript を必要としない。
 * 進捗値は render のたびに props として受け取るだけで、component 自身は state も timer も
 * 持たない。値の取得・更新間隔・完了後の遷移は呼び出し元が決める。
 *
 * URL や Server 側で確定した進捗（手続きの段階表示など）に使う。browser 側の計測値を連続更新
 * する場合は `ProgressClient` を使う。完了時期が不明な待機には使わず、骨格を見せるだけでよい
 * 場合は `Skeleton` を使う。
 *
 * `progress` 要素は screen reader に `progressbar` として公開され、値は `value` と `max` から
 * 百分率として読み上げられる。要素自体は名前を持たないため、`aria-label` か、`label` 要素と
 * `id` の関連付けでアクセシブルな名前を必ず与える。
 *
 * 太さや幅は `className` で上書きする。既定は `h-2 w-full` で、track は `bg-border`、進捗部分は
 * `bg-foreground` を使う。track と進捗部分は browser ごとに別の擬似要素で描画されるため、
 * `::-webkit-progress-bar` / `::-webkit-progress-value` / `::-moz-progress-bar` の三つへ指定する。
 *
 * @see Storybook `Status/ProgressNative`
 */
export function ProgressNative({ className, max = 100, value, ...props }: ProgressNativeProps) {
  return (
    <progress
      className={cn(
        "h-2 w-full appearance-none overflow-hidden rounded-full bg-border [&::-moz-progress-bar]:rounded-full [&::-moz-progress-bar]:bg-foreground [&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-bar]:bg-border [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-foreground",
        className,
      )}
      data-slot="progress-native"
      max={max}
      value={value}
      {...props}
    />
  );
}
