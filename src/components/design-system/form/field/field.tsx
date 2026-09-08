import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/components/cn";
import { Separator } from "../../display/separator/separator";
import { Label } from "../label/label";

/**
 * 関連する複数の field を一つの選択群としてまとめる `fieldset`。
 *
 * @remarks
 * 群そのものの名前は {@link FieldLegend} が与える。単一の入力項目には使わず {@link Field} を使う。
 *
 * @param props - native `fieldset` 属性。
 * @see Storybook `Form/Field`
 */
export function FieldSet({ className, ...props }: ComponentProps<"fieldset">) {
  return (
    <fieldset className={cn("flex flex-col gap-6", className)} data-slot="field-set" {...props} />
  );
}

/**
 * {@link FieldSet} が表す選択群の名称。
 *
 * @remarks
 * `fieldset` の直下に置く。支援技術は群に属する各 control の名前へこの文字列を前置して読み上げる。
 *
 * @param props - native `legend` 属性。
 * @see Storybook `Form/Field`
 */
export function FieldLegend({ className, ...props }: ComponentProps<"legend">) {
  return (
    <legend
      className={cn("mb-3 text-base font-emphasis", className)}
      data-slot="field-legend"
      {...props}
    />
  );
}

/**
 * 複数の {@link Field} を一定の間隔で縦に積む器。
 *
 * @remarks
 * 意味論を持たない `div` であり、群としての名前が要る場合は {@link FieldSet} と {@link FieldLegend} を使う。
 *
 * @param props - native `div` 属性。
 * @see Storybook `Form/Field`
 */
export function FieldGroup({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("flex w-full flex-col gap-6", className)}
      data-slot="field-group"
      {...props}
    />
  );
}

/**
 * {@link Field} の props。
 *
 * @remarks
 * 不正な入力であることは `data-invalid="true"` で伝える。この属性が付いた field は配下の文字色が
 * destructive へ切り替わる。値の検証は行わないため、判定結果は呼び出し元が渡す。
 */
export type FieldProps = ComponentProps<"div"> & {
  /**
   * label と control の並べ方。
   *
   * - `vertical`: label を control の上に置く既定の配置
   * - `horizontal`: checkbox や switch のように label を control の横へ置く配置
   */
  orientation?: "horizontal" | "vertical";
};

/**
 * 一つの入力項目を label・説明・エラーとともにまとめる外枠。
 *
 * @remarks
 * Server Component であり、値の保持・検証・エラー文言の整形は持たない。`aria-invalid` と
 * `aria-describedby` は control 側へ、`data-invalid` はこの外枠へ、いずれも呼び出し元が渡す。
 *
 * @example
 * ```tsx
 * <Field data-invalid={error !== undefined}>
 *   <FieldLabel htmlFor="email">メールアドレス</FieldLabel>
 *   <Input aria-describedby="email-error" aria-invalid={error !== undefined} id="email" name="email" />
 *   <FieldDescription>ご登録済みのアドレスを入力してください。</FieldDescription>
 *   {error === undefined ? null : <FieldError id="email-error">{error}</FieldError>}
 * </Field>
 * ```
 *
 * @param props - native `div` 属性と、以下の表示用 props。
 * @param props.orientation - label と control の並べ方。
 * @see Storybook `Form/Field`
 */
export function Field({ className, orientation = "vertical", ...props }: FieldProps) {
  return (
    <div
      className={cn(
        "group/field flex w-full gap-3 data-[invalid=true]:text-destructive",
        orientation === "horizontal" ? "items-center" : "flex-col",
        className,
      )}
      data-orientation={orientation}
      data-slot="field"
      {...props}
    />
  );
}

/**
 * control の横に置く label・説明・エラーをまとめて縦に積む領域。
 *
 * @remarks
 * `orientation="horizontal"` の {@link Field} で、control と釣り合う幅を占めて残りを埋める。
 * 縦並びの field では入れ子にする必要はない。
 *
 * @param props - native `div` 属性。
 * @see Storybook `Form/Field`
 */
export function FieldContent({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("flex flex-1 flex-col gap-1.5 leading-snug", className)}
      data-slot="field-content"
      {...props}
    />
  );
}

/**
 * 入力項目の名称を control へ関連付ける label。
 *
 * @remarks
 * 実体は {@link Label} で、`htmlFor` に control の `id` を渡して関連付ける。label で control を
 * 包む書き方も使えるが、その場合も `htmlFor` と `id` を明示する方が支援技術で確実に読まれる。
 * 見出しのような静的な文字列には、control を持たない {@link FieldTitle} を使う。
 *
 * @param props - {@link Label} の props（native `label` 属性）。
 * @see Storybook `Form/Field`
 */
export function FieldLabel({ className, ...props }: ComponentProps<typeof Label>) {
  return (
    <Label className={cn("w-fit leading-snug", className)} data-slot="field-label" {...props} />
  );
}

/**
 * control を持たない項目の見出し。
 *
 * @remarks
 * `label` 要素ではないため control とは関連付かない。入力欄の名称には {@link FieldLabel} を使う。
 * 用途は、複数の control をまとめた行の表題や、値を表示するだけの項目の名称である。
 *
 * @param props - native `div` 属性。
 * @see Storybook `Form/Field`
 */
export function FieldTitle({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("text-sm font-emphasis leading-snug", className)}
      data-slot="field-title"
      {...props}
    />
  );
}

/**
 * 入力の条件や補足を伝える説明文。
 *
 * @remarks
 * 支援技術へ届けるには `id` を与え、control 側の `aria-describedby` から参照する。参照しない場合、
 * 視覚的には見えても読み上げ時に control と結び付かない。エラー文言には {@link FieldError} を使う。
 *
 * @param props - native `p` 属性。
 * @see Storybook `Form/Field`
 */
export function FieldDescription({ className, ...props }: ComponentProps<"p">) {
  return (
    <p
      className={cn("text-sm leading-normal text-muted-foreground", className)}
      data-slot="field-description"
      {...props}
    />
  );
}

/**
 * field 群のあいだに置く区切り。
 *
 * @remarks
 * 罫線は装飾として扱われ支援技術には公開されない。`children` を渡すと罫線の中央に文字列を重ねる。
 *
 * @param props - native `div` 属性と、以下の表示用 props。
 * @param props.children - 罫線の中央へ重ねる文字列。省略すると罫線だけを引く。
 * @see Storybook `Form/Field`
 */
export function FieldSeparator({
  children,
  className,
  ...props
}: ComponentProps<"div"> & { children?: ReactNode }) {
  return (
    <div
      className={cn("relative -my-2 h-5 text-sm", className)}
      data-slot="field-separator"
      {...props}
    >
      <Separator className="absolute inset-0 top-1/2" decorative />
      {children ? (
        <span className="relative mx-auto block w-fit bg-background px-2 text-muted-foreground">
          {children}
        </span>
      ) : null}
    </div>
  );
}

/**
 * 入力が受け付けられなかった理由を伝えるエラー表示。
 *
 * @remarks
 * `role="alert"` を持つため、描画された時点で支援技術が読み上げる。常に render して文言だけを
 * 空にすると読み上げが起きないため、エラーが無いときは要素ごと render しない。
 *
 * control との結び付け方は {@link FieldDescription} と同じで、併せて `aria-invalid` を立てる。
 * 文言の整形と検証は持たないため、利用者向けの文字列を呼び出し元が渡す。
 *
 * @param props - native `div` 属性。
 * @see Storybook `Form/Field`
 */
export function FieldError({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("text-sm text-destructive", className)}
      data-slot="field-error"
      role="alert"
      {...props}
    />
  );
}
