"use client";

import { Avatar as AvatarPrimitive } from "radix-ui";
import type { ComponentProps } from "react";

import { cn } from "@/components/cn";
import { AVATAR_SIZE, type AvatarSize } from "./avatar.definition";

/**
 * 利用者や組織を小さな円形で識別させる、client island の avatar root。
 *
 * @remarks
 * 画像の読み込み結果に応じて `AvatarImage` と `AvatarFallback` を切り替えるため hydration が
 * 必要で、Server Component からは直接 render できない。読み込み状態を切り替えない単なる画像
 * 表示には `MediaImage` を使う。
 *
 * avatar そのものは識別の補助であり、誰を指すかは隣接する氏名などの文言が伝える。avatar だけで
 * 人物を特定させる設計にしない。
 *
 * @param props - Radix `Avatar.Root` の props。
 * @param props.size - 表示サイズ。{@link AVATAR_SIZE} のいずれか。
 *
 * @see Storybook `Display/Avatar`
 */
function Avatar({
  className,
  size = AVATAR_SIZE.DEFAULT,
  ...props
}: ComponentProps<typeof AvatarPrimitive.Root> & {
  size?: AvatarSize;
}) {
  return (
    <AvatarPrimitive.Root
      className={cn(
        "group/avatar relative flex size-8 shrink-0 overflow-hidden rounded-full select-none data-[size=lg]:size-10 data-[size=sm]:size-6",
        className,
      )}
      data-size={size}
      data-slot="avatar"
      {...props}
    />
  );
}

/**
 * 読み込みに成功したときだけ表示される画像。
 *
 * @remarks
 * `alt` は呼び出し元が必ず指定する。隣に氏名を表示していて avatar が装飾に留まる場合は `alt=""`
 * とし、avatar だけが人物を示す場合は誰かが分かる文言を渡す。
 *
 * 読み込みに失敗した場合や `src` が無い場合は描画されず、`AvatarFallback` が表示される。
 *
 * @param props - Radix `Avatar.Image` の props。
 *
 * @see Storybook `Display/Avatar`
 */
function AvatarImage({ className, ...props }: ComponentProps<typeof AvatarPrimitive.Image>) {
  return (
    <AvatarPrimitive.Image
      className={cn("aspect-square size-full", className)}
      data-slot="avatar-image"
      {...props}
    />
  );
}

/**
 * 画像が表示できないときの代替表示。
 *
 * @remarks
 * 頭文字や icon を置く。`delayMs` を指定すると、その時間だけ何も描画せず、読み込みが速い場合の
 * ちらつきを避けられる。
 *
 * 画像と重複して読み上げられないよう、`AvatarImage` の `alt` と同じ情報をここへ書かない。
 *
 * @param props - Radix `Avatar.Fallback` の props。
 *
 * @see Storybook `Display/Avatar`
 */
function AvatarFallback({ className, ...props }: ComponentProps<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      className={cn(
        "flex size-full items-center justify-center rounded-full bg-muted text-sm text-muted-foreground group-data-[size=sm]/avatar:text-xs",
        className,
      )}
      data-slot="avatar-fallback"
      {...props}
    />
  );
}

/**
 * avatar の右下へ重ねる小さな標識。
 *
 * @remarks
 * 在席状態や種別など、ごく短い補助情報だけに使う。色や点だけでは意味が伝わらないため、状態を
 * 伝える必要がある場合は `sr-only` の文言を子に置くか、隣接する文言で補う。
 *
 *
 * @see Storybook `Display/Avatar`
 */
function AvatarBadge({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "absolute right-0 bottom-0 z-10 inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground ring-2 ring-background select-none",
        "group-data-[size=sm]/avatar:size-2 group-data-[size=sm]/avatar:[&>svg]:hidden",
        "group-data-[size=default]/avatar:size-2.5 group-data-[size=default]/avatar:[&>svg]:size-2",
        "group-data-[size=lg]/avatar:size-3 group-data-[size=lg]/avatar:[&>svg]:size-2",
        className,
      )}
      data-slot="avatar-badge"
      {...props}
    />
  );
}

/**
 * 複数の avatar を少し重ねて並べる領域。
 *
 * @remarks
 * 並べる人数が多い場合は、表示する数を呼び出し元が決めて `AvatarGroupCount` で残数を示す。
 * 何人ぶんを表示するかの判断はこの部品では持たない。
 *
 *
 * @see Storybook `Display/Avatar`
 */
function AvatarGroup({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "group/avatar-group flex -space-x-2 *:data-[slot=avatar]:ring-2 *:data-[slot=avatar]:ring-background",
        className,
      )}
      data-slot="avatar-group"
      {...props}
    />
  );
}

/**
 * `AvatarGroup` の末尾に置く、表示しきれない人数の表示。
 *
 * @remarks
 * 大きさは `AvatarGroup` 内の avatar の `size` に追従する。残数の計算と文言は呼び出し元が渡す。
 *
 *
 * @see Storybook `Display/Avatar`
 */
function AvatarGroupCount({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "relative flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm text-muted-foreground ring-2 ring-background group-has-data-[size=lg]/avatar-group:size-10 group-has-data-[size=sm]/avatar-group:size-6 [&>svg]:size-4 group-has-data-[size=lg]/avatar-group:[&>svg]:size-5 group-has-data-[size=sm]/avatar-group:[&>svg]:size-3",
        className,
      )}
      data-slot="avatar-group-count"
      {...props}
    />
  );
}

export { Avatar, AvatarBadge, AvatarFallback, AvatarGroup, AvatarGroupCount, AvatarImage };
