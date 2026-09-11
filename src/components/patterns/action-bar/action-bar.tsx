import type { ComponentProps } from "react";

import { cn } from "@/components/cn";

import {
  ACTION_BAR_POSITION,
  ACTION_BAR_POSITION_CLASS,
  type ActionBarPosition,
} from "./action-bar.definition";

/** `ActionBar` の props。 */
export type ActionBarProps = Omit<ComponentProps<"div">, "children"> & {
  /** 操作を出す位置。既定は本文の流れの中。 */
  position?: ActionBarPosition;
  /** 並べる操作。 */
  children: ComponentProps<"div">["children"];
};

/**
 * 位置と重なり順だけを持ち、中身が何であるかを知らない操作の器。
 *
 * @remarks
 * 下端に固定する見た目は
 * [`action-bar.definition.ts`](action-bar.definition.ts) が単独で宣言しており、呼び出し側が
 * class を組み立て直す必要はありません。同じ見た目を各画面で綴ると、重なり順や safe area の
 * 余白がそのつど抜けます。
 *
 * @param props.position - 操作を出す位置。
 * @param props.children - 並べる操作。
 *
 * @see Storybook `Container/ActionBar`
 */
export function ActionBar({
  className,
  position = ACTION_BAR_POSITION.INLINE,
  children,
  ...props
}: ActionBarProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3",
        ACTION_BAR_POSITION_CLASS[position],
        className,
      )}
      data-position={position}
      data-slot="action-bar"
      {...props}
    >
      {children}
    </div>
  );
}
