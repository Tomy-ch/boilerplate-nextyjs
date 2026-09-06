import type { ComponentProps } from "react";

import { cn } from "@/components/cn";
import { ChevronDownIcon } from "@/components/icon";

/** {@link SelectNative} の props。 */
export type SelectNativeProps = Omit<ComponentProps<"select">, "size"> & {
  /** control の高さ。 */
  size?: "sm" | "default";
};

/**
 * native `select` の操作感を保ったまま見た目を統一する、SSR first の選択部品。
 *
 * @remarks
 * 静的で少数の候補にはこちらを優先する。native control のため、初期表示に client JavaScript
 * を必要とせず、form の `name` と選択値もそのまま送信できる。検索・独自 popup など native
 * 要素で満たせない要件が確定した場合だけ、client island の選択 UI を検討する。
 *
 * @example
 * ```tsx
 * <Label htmlFor="display-mode">表示形式</Label>
 * <SelectNative defaultValue="standard" id="display-mode" name="displayMode">
 *   <SelectNativeOption value="standard">標準</SelectNativeOption>
 * </SelectNative>
 * ```
 *
 * @param props - native `select` 属性と `size`。
 * @param props.size - control の高さ。`default` は 36px、`sm` は 32px。
 * @see Storybook `Form/SelectNative`
 */
function SelectNative({ className, size = "default", ...props }: SelectNativeProps) {
  return (
    <div
      className="group/native-select relative w-fit has-[select:disabled]:opacity-50"
      data-slot="native-select-wrapper"
    >
      <select
        data-slot="native-select"
        data-size={size}
        className={cn(
          "h-9 w-full min-w-0 appearance-none rounded-md border border-input bg-transparent px-3 py-2 pr-9 text-sm shadow-xs transition-[color,box-shadow] selection:bg-primary selection:text-primary-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed data-[size=sm]:h-8 data-[size=sm]:py-1 dark:bg-input/30 dark:hover:bg-input/50",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active focus-visible:shadow-glow-primary",
          "aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
          className,
        )}
        {...props}
      />
      <ChevronDownIcon
        className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-muted-foreground opacity-50 select-none"
        aria-hidden="true"
        data-slot="native-select-icon"
      />
    </div>
  );
}

/**
 * 選べる候補の 1 件。
 *
 * @remarks
 * `value` が form の送信値になる。省略した場合は表示している文言がそのまま送られる。未選択を
 * 表す先頭の項目には `value=""` を与え、必須にする場合は `SelectNative` 側へ `required` を渡す。
 *
 * 面の色は OS が描画する popup に合わせるため、`className` で背景色を上書きしない。
 *
 * @param props - native `option` 属性。
 * @see Storybook `Form/SelectNative`
 */
function SelectNativeOption({ className, ...props }: ComponentProps<"option">) {
  return (
    <option
      data-slot="native-select-option"
      className={cn("bg-[Canvas] text-[CanvasText]", className)}
      {...props}
    />
  );
}

/**
 * 候補をひとまとまりとして束ねる区分。
 *
 * @remarks
 * 区分の名前は native の `label` 属性が伝えるため、必ず指定する。区分そのものは選べない。
 *
 * @param props - native `optgroup` 属性。
 * @see Storybook `Form/SelectNative`
 */
function SelectNativeOptGroup({ className, ...props }: ComponentProps<"optgroup">) {
  return (
    <optgroup
      data-slot="native-select-optgroup"
      className={cn("bg-[Canvas] text-[CanvasText]", className)}
      {...props}
    />
  );
}

export { SelectNative, SelectNativeOptGroup, SelectNativeOption };
