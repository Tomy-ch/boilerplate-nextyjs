"use client";

import { OTPInput, OTPInputContext } from "input-otp";
import { type ComponentProps, createContext, useContext } from "react";

import { cn } from "@/components/cn";
import { MinusIcon } from "@/components/icon";
import { SEGMENTED_INPUT_MASK_CHAR } from "./segmented-input.definition";

const SegmentedInputMaskContext = createContext<{ mask: boolean; maskChar: string }>({
  mask: false,
  maskChar: SEGMENTED_INPUT_MASK_CHAR,
});

function displayCharOf(char: string | null | undefined, isMasked: boolean, maskChar: string) {
  if (char === null || char === undefined) {
    return null;
  }

  return isMasked ? maskChar : char;
}

/** {@link SegmentedInput} の props。 */
export type SegmentedInputProps = ComponentProps<typeof OTPInput> & {
  /** 桁を囲む外枠へ追加する class 名。`className` は実体の `input` に届く。 */
  containerClassName?: string;
  /** 入力した文字を伏せるか。 */
  mask?: boolean;
  /** 伏せるときに代わりに描く文字。 */
  maskChar?: string;
};

/** {@link SegmentedInputSlot} の props。 */
export type SegmentedInputSlotProps = ComponentProps<"div"> & {
  /** 何桁目を表すか。`0` から数える。 */
  index: number;
  /** この桁だけ伏せるかを上書きする。省略すると {@link SegmentedInput} の指定に従う。 */
  mask?: boolean;
};

/**
 * 桁ごとに区切った、長さの決まったコードを受け取る入力。
 *
 * @remarks
 * 実体は 1 本の `input` で、桁の見た目は {@link SegmentedInputSlot} が描く。桁間の focus 移動・
 * 貼り付け・削除の巻き戻しを引き受けるため hydration が必要な client island であり、Server
 * Component からは直接 render できない。
 *
 * `maxLength` で桁数を決める。子には {@link SegmentedInputGroup} と {@link SegmentedInputSlot} を、
 * 桁数と同じ数だけ並べる。数が食い違うと、入力できるのに描かれない桁が生まれる。
 *
 * **用途はこの component が決めない。** 確認コード、暗証番号、二要素認証、招待コード、ライセンス
 * キーなど、長さが決まっていて桁の区切りに意味がある入力すべてに使う。用途ごとの差は次の四つで
 * 与える。互いに独立した軸なので、まとめた「用途」の値は持たない。
 *
 * - `pattern` — 受け付ける文字種。`SEGMENTED_INPUT_PATTERN` の値を渡す
 * - `autoComplete` — 補完の手掛かり。SMS やメールで配信されるコードのときだけ `one-time-code` に
 *   する。配信されないコードへ当てると、関係のない SMS のコードを勧められる
 * - `inputMode` — 呼び出す keyboard
 * - `mask` — 入力した文字を伏せるか
 *
 * **アクセシブルな名前は必ず与える。** 実体は 1 本の `input` で、桁の枠は名前を持たない。`Field` の
 * `FieldLabel` を `htmlFor` で結ぶか、`aria-label` を渡す。
 *
 * **`mask` は見た目だけを伏せる。** 実体は `text` の `input` のままなので、支援技術は値をそのまま
 * 読み上げ、password manager も文字列として扱う。肩越しに覗かれることは防げるが、秘密を扱う入力
 * そのものとしては扱わない。
 *
 * 値の検証・送信・再送は持たない。`value` と `onChange` で呼び出し元が扱う。
 *
 * 桁区切りの表示が要らない場合はこれを使わない。`Input` に `inputMode` と適切な `autoComplete` を
 * 与えれば足り、client runtime も要らない。
 *
 * @example
 * ```tsx
 * <SegmentedInput
 *   autoComplete="one-time-code"
 *   inputMode="numeric"
 *   maxLength={6}
 *   name="code"
 *   pattern={SEGMENTED_INPUT_PATTERN.DIGITS}
 * >
 *   <SegmentedInputGroup>
 *     <SegmentedInputSlot index={0} />
 *     <SegmentedInputSlot index={1} />
 *     <SegmentedInputSlot index={2} />
 *   </SegmentedInputGroup>
 *   <SegmentedInputSeparator />
 *   <SegmentedInputGroup>
 *     <SegmentedInputSlot index={3} />
 *     <SegmentedInputSlot index={4} />
 *     <SegmentedInputSlot index={5} />
 *   </SegmentedInputGroup>
 * </SegmentedInput>
 * ```
 *
 * @param props - 実体の `input` へ渡る属性と `containerClassName` / `mask` / `maskChar`。
 *   `maxLength` は必須。
 * @see Storybook `Form/SegmentedInput`
 */
export function SegmentedInput({
  className,
  containerClassName,
  mask = false,
  maskChar = SEGMENTED_INPUT_MASK_CHAR,
  ...props
}: SegmentedInputProps) {
  return (
    <SegmentedInputMaskContext.Provider value={{ mask, maskChar }}>
      <OTPInput
        className={cn("disabled:cursor-not-allowed", className)}
        containerClassName={cn(
          "flex items-center gap-2 has-disabled:opacity-50",
          containerClassName,
        )}
        data-slot="segmented-input"
        {...props}
      />
    </SegmentedInputMaskContext.Provider>
  );
}

/**
 * 隣り合う桁をひとまとまりに見せる区画。
 *
 * @remarks
 * 桁の枠は隣と接して描かれ、区画の両端だけが丸くなる。`3` 桁ずつなど、読み上げやすい単位で
 * {@link SegmentedInputSlot} を包む。
 *
 * @param props - native `div` 属性。
 * @see Storybook `Form/SegmentedInput`
 */
export function SegmentedInputGroup({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("flex items-center", className)}
      data-slot="segmented-input-group"
      {...props}
    />
  );
}

/**
 * 一桁ぶんの枠。
 *
 * @remarks
 * `index` の桁の文字と、その桁が入力位置かどうかを {@link SegmentedInput} から受け取って描く。枠
 * 自体は入力を受けず、focus も持たない。実体の `input` は一つだけで、桁は見た目である。
 *
 * 伏せるかどうかは {@link SegmentedInput} の指定に従う。桁ごとに変える場合だけ `mask` を渡す。
 *
 * {@link SegmentedInput} の外に置いた場合は何も映さない空の枠になる。
 *
 * @param props - native `div` 属性と `index` / `mask`。
 * @see Storybook `Form/SegmentedInput`
 */
export function SegmentedInputSlot({ className, index, mask, ...props }: SegmentedInputSlotProps) {
  const segmentContext = useContext(OTPInputContext);
  const { mask: groupMask, maskChar } = useContext(SegmentedInputMaskContext);
  const { char, hasFakeCaret, isActive } = segmentContext?.slots?.[index] ?? {};
  const isMasked = mask ?? groupMask;
  const shownChar = displayCharOf(char, isMasked, maskChar);

  return (
    <div
      className={cn(
        "relative flex h-9 w-9 items-center justify-center border-input border-y border-r text-sm shadow-xs transition-all first:rounded-l-md first:border-l last:rounded-r-md aria-invalid:border-destructive data-[active=true]:z-10 data-[active=true]:border-foreground data-[active=true]:outline-2 data-[active=true]:outline-active data-[active=true]:outline-offset-2 data-[active=true]:aria-invalid:border-destructive data-[active=true]:aria-invalid:outline-destructive dark:bg-input/30",
        className,
      )}
      data-active={isActive}
      data-masked={isMasked ? "true" : undefined}
      data-slot="segmented-input-slot"
      {...props}
    >
      {shownChar}
      {hasFakeCaret === true ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-4 w-px animate-caret-blink bg-foreground duration-1000" />
        </div>
      ) : null}
    </div>
  );
}

/**
 * 区画と区画の間に置く区切り。
 *
 * @remarks
 * 桁のまとまりを目で分けるための装飾で、入力には関与しない。**支援技術からは隠す。** 入力の値は
 * 実体の `input` が伝えるため、この記号に意味は無い。`separator` role は focus と値を持つ widget を
 * 表すので当てない。
 *
 * @param props - native `div` 属性。
 * @see Storybook `Form/SegmentedInput`
 */
export function SegmentedInputSeparator(props: ComponentProps<"div">) {
  return (
    <div aria-hidden="true" data-slot="segmented-input-separator" {...props}>
      <MinusIcon />
    </div>
  );
}
