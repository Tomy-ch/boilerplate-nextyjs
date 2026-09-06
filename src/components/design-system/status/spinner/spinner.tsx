import type { ComponentProps } from "react";

import { cn } from "@/components/cn";
import { LoaderIcon } from "@/components/icon";

/** {@link Spinner} の props。 */
export type SpinnerProps = Omit<ComponentProps<"svg">, "aria-hidden" | "aria-label" | "role"> & {
  /** 読み上げる処理中の文言。省略すると装飾として扱う。 */
  label?: string;
};

/**
 * 終わりの見えない短い処理中を示す、SSR first の装飾 primitive。
 *
 * @remarks
 * 既定では装飾として扱い、支援技術へ何も伝えない。button の中や loading message の隣に置く
 * 場合、状態を伝えるのは周囲の文言であり、spinner が重ねて読み上げると同じ情報が二重に
 * 伝わるためである。
 *
 * spinner 単体で状態を伝える必要がある場合だけ `label` を指定する。指定すると `role="status"`
 * として、その文言を読み上げ対象にする。
 *
 * 最終コンテンツの形状を示せる待機には `Skeleton` を使う。進捗が取得できる場合は割合を示せる
 * UI を選ぶ。spinner は進捗も残り時間も表現しない。
 *
 * `prefers-reduced-motion` 時は回転を停止する。停止しても位置と大きさは変わらないため表示は
 * 崩れない。
 *
 * @example
 * ```tsx
 * <Button disabled>
 *   <Spinner />
 *   送信中
 * </Button>
 *
 * <Spinner className="size-8" label="読み込んでいます" />
 * ```
 *
 * @param props - native `svg` 属性。`className` で大きさと色を調整できる。色を指定しなければ
 *   `currentColor` を継承する。
 *
 * @see Storybook `Status/Spinner`
 */
export function Spinner({ className, label, ...props }: SpinnerProps) {
  return (
    <LoaderIcon
      aria-hidden={label === undefined ? "true" : undefined}
      aria-label={label}
      className={cn("size-4 animate-spin motion-reduce:animate-none", className)}
      data-slot="spinner"
      role={label === undefined ? undefined : "status"}
      {...props}
    />
  );
}
