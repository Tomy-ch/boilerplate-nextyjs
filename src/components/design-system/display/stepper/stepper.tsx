import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/components/cn";
import { List, ListItem, ListItemMedia } from "@/components/design-system/display/list/list";
import { CheckIcon } from "@/components/icon";
import {
  STEPPER_ORIENTATION,
  STEPPER_PASSED_CURRENT_LABEL,
  STEPPER_STATE,
  STEPPER_STATE_LABEL,
  type StepperOrientation,
  type StepperState,
} from "./stepper.definition";

/**
 * 既知で有限の段階を定義順に並べ、現在位置と未到達を示す SSR first の表示 component。
 *
 * @remarks
 * 対象は**段階**であって履歴ではない。件数は固定で、定義順に並び、増減しない。増え続ける
 * 出来事を時刻順に並べるのは `ActivityTimeline` の担当であり、そちらは pagination を伴う。
 * **`次に取れる操作` と `pagination` は同居しない**ため、1 部品にまとめない。
 *
 * 表示は `List` を合成する。縦に並ぶ行・先頭の印・見出しと説明は `List` が既に持つため、
 * 新しい共通 primitive を作らない。内容は `ListItemContent` / `ListItemTitle` /
 * `ListItemDescription` で組み立てる。
 *
 * 段階の定義・遷移可否・次に取れる操作は持たない。どこまで進んだかを決めるのは呼び出し元で、
 * この component は渡された `state` を描くだけである。
 *
 * `ol` として並び順に意味があることを伝える。**進捗を表す名前を必ず与える**。同じ画面に
 * 複数の進捗があるとき、名前が無いとどちらの進捗か判らない。
 *
 * @example
 * ```tsx
 * <Stepper label="申請の進捗">
 *   <StepperItem marker={1} state={STEPPER_STATE.COMPLETE}>
 *     <ListItemContent>
 *       <ListItemTitle>申請</ListItemTitle>
 *     </ListItemContent>
 *   </StepperItem>
 * </Stepper>
 * ```
 *
 * @param props.label - この進捗のアクセシブルな名前。
 *
 * @see Storybook `Display/Stepper`
 */
export function Stepper({
  label,
  orientation = STEPPER_ORIENTATION.VERTICAL,
  className,
  ...props
}: Omit<ComponentProps<"ol">, "aria-label"> & {
  label: string;
  orientation?: StepperOrientation;
}) {
  return (
    <List asChild>
      <ol
        aria-label={label}
        className={cn(
          orientation === STEPPER_ORIENTATION.HORIZONTAL
            ? "flex-row flex-wrap items-center gap-x-5 gap-y-2"
            : "gap-0",
          className,
        )}
        data-orientation={orientation}
        data-slot="stepper"
        {...props}
      />
    </List>
  );
}

/**
 * 段階 1 つ。
 *
 * @remarks
 * `state` が `current` の項目へ `aria-current="step"` を与える。**1 つの `Stepper` の中で
 * `current` は 1 つだけにする。** 複数あると現在地が定まらない。
 *
 * 印は装飾で、`complete` では check、それ以外では `marker` に渡した番号を出す。色と印だけでは
 * 区別できないため、状態を表す語（完了 / 現在の段階 / 未着手）を読み上げ専用のテキストとして
 * 添える。
 *
 * @param props.state - 今どの位置にあるか。値の一覧は {@link STEPPER_STATE}。
 * @param props.passed - 現在地であっても、既に済ませた段階か。印だけを `complete` と同じにし、
 *   状態そのものは `current` のまま残す（現在地は 1 つに定まっている必要がある）。
 * @param props.marker - 印に出す番号。省略すると `complete` 以外の印は空になる。
 * @param props.stateLabel - 状態を読み上げへ伝える語。省略すると {@link STEPPER_STATE_LABEL}
 *   の既定を使う。「承認済み」「差し戻し」のように段階の呼び名が決まっている場合へ寄せられる。
 *   空文字にすると状態が伝わらなくなるため、置き換えるなら別の語を与える。
 *
 * @see Storybook `Display/Stepper`
 */
export function StepperItem({
  state = STEPPER_STATE.UPCOMING,
  marker,
  stateLabel,
  passed = false,
  children,
  className,
  ...props
}: Omit<ComponentProps<"li">, "size"> & {
  state?: StepperState;
  marker?: ReactNode;
  stateLabel?: string;
  passed?: boolean;
}) {
  const complete = state === STEPPER_STATE.COMPLETE;
  // 済ませたことと今どこに居るかは別の事実。現在地へ戻ったときに印が消えると、済ませた入力まで
  // 無かったことになったように見える。
  const showsCheck = complete || passed;
  const defaultStateLabel =
    passed && state === STEPPER_STATE.CURRENT
      ? STEPPER_PASSED_CURRENT_LABEL
      : STEPPER_STATE_LABEL[state];

  return (
    <ListItem
      aria-current={state === STEPPER_STATE.CURRENT ? "step" : undefined}
      className={cn("items-start", className)}
      data-slot="stepper-item"
      data-state={state}
      {...props}
    >
      <ListItemMedia
        className={cn(
          "size-6 shrink-0 rounded-full border border-border text-xs font-emphasis",
          showsCheck ? "bg-foreground text-background" : "bg-background text-muted-foreground",
          state === STEPPER_STATE.CURRENT ? "border-foreground text-foreground" : "",
        )}
        data-slot="stepper-item-marker"
      >
        {showsCheck ? <CheckIcon aria-hidden="true" className="size-3.5" /> : (marker ?? null)}
        <span className="sr-only">{stateLabel ?? defaultStateLabel}</span>
      </ListItemMedia>
      {children}
    </ListItem>
  );
}
