import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type { ComponentProps } from "react";

import { cn } from "@/components/cn";
import { Spinner } from "@/components/design-system/status/spinner/spinner";
import {
  BUTTON_SIZE,
  BUTTON_VARIANT,
  type ButtonSize,
  type ButtonVariant,
} from "./button.definition";

/**
 * ボタンの見た目を `variant` と `size` から組み立てる class 名生成器。
 *
 * @remarks
 * {@link Button} を render できない場所で、ボタンと同じ見た目だけを借りるために公開している。
 * 通常は {@link Button} を使い、リンクをボタンの見た目にする場合も `asChild` を使う。
 *
 * @example
 * ```tsx
 * <a className={buttonVariants({ variant: BUTTON_VARIANT.OUTLINE })} href="/help">ヘルプ</a>
 * ```
 *
 * @see Storybook `Action/Button`
 */
export const buttonVariants = cva(
  "inline-flex cursor-pointer items-center justify-center gap-2 rounded-md font-emphasis tracking-wide transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active focus-visible:shadow-glow-primary disabled:pointer-events-none disabled:cursor-default disabled:opacity-50",
  {
    variants: {
      variant: {
        // 主行動だけは休止時から光らせる。画面の中で「いま生きている操作」は 1 つなので、
        // 常時の装飾ではなく状態の表示にあたる。
        [BUTTON_VARIANT.DEFAULT]:
          "bg-primary text-primary-foreground shadow-glow-primary hover:bg-primary/85 active:bg-primary/70",
        [BUTTON_VARIANT.OUTLINE]:
          "border border-border bg-background text-foreground hover:bg-foreground hover:text-background active:bg-foreground/80",
        [BUTTON_VARIANT.GHOST]:
          "bg-transparent text-foreground hover:bg-foreground hover:text-background active:bg-foreground/80",
        // hover と active の差を他の variant（`/85` と `/70`）より大きく取る。暗い配色の上では
        // 不透明度をわずかに下げても背景との差が出ず、押せることが hover で判らない。
        //
        // 自分の色で、hover / focus-visible にだけ光らせる（`src/components/README.md`「発光」）
        [BUTTON_VARIANT.DESTRUCTIVE]:
          "bg-destructive text-destructive-foreground hover:bg-destructive/75 hover:shadow-glow-destructive focus-visible:shadow-glow-destructive active:bg-destructive/60",
      },
      size: {
        [BUTTON_SIZE.DEFAULT]: "h-10 px-4 py-2",
        [BUTTON_SIZE.SMALL]: "h-8 px-3 text-sm",
        [BUTTON_SIZE.LARGE]: "h-11 px-6",
      },
    },
    defaultVariants: {
      variant: BUTTON_VARIANT.DEFAULT,
      size: BUTTON_SIZE.DEFAULT,
    },
  },
);

/**
 * {@link Button} の props。
 *
 * @remarks
 * 通常時は native の {@link HTMLButtonElement} として振る舞う。フォーム内で送信しない
 * 操作には、意図しない submit を避けるため `type="button"` を明示する。
 *
 * `asChild` を指定したときは、単一の React 要素を子に渡す。子要素へ class 名・
 * event handler・アクセシビリティ属性を合成するため、文字列、複数要素、Fragment は渡せない。
 * リンクをボタンと同じ見た目にする用途には `asChild` と単一の link 要素を組み合わせる。
 * アプリ内の遷移には `next/link` の `Link`、外部 URL には native の `a` を使う。
 */
export type ButtonProps = ComponentProps<"button"> &
  Omit<VariantProps<typeof buttonVariants>, "size" | "variant"> & {
    /**
     * 操作の優先度を表す見た目。
     *
     * - `default`: 画面の主要操作
     * - `outline`: 主要操作に並ぶ副次操作
     * - `ghost`: 表示の主張を抑える補助操作
     * - `destructive`: 取り消せない結果を伴う操作
     */
    variant?: ButtonVariant;
    /**
     * ボタンの大きさ。
     *
     * - `sm`: 表や密度の高い領域
     * - `default`: 通常の画面操作
     * - `lg`: 単独で目立たせる主要操作
     */
    size?: ButtonSize;
    /**
     * 送信などの処理を待っているか。
     *
     * @remarks
     * **文言はそのままの場所に残し、その上へ回転する印を重ねます。**文言を「送信しています…」の
     * ように差し替えると幅が動き、脇に貼り付いた要素や下端に固定した帯では周りの位置まで動きます。
     * 印を文言の隣へ足す形でも同じだけ幅が伸びます。重ねれば、待っているあいだも器の大きさが
     * 変わりません。
     *
     * 待っているあいだは押せなくします。もう一度押せると、受け付けられたのかどうかが利用者から
     * 判りません。
     *
     * 文言は視覚から外れると、その文言から組み立てていた名前も消えます。待っていることは
     * `pendingLabel` が操作自身の名前として伝えます。
     *
     * `asChild` とは併せられません。合成先の要素の中身をこの component が組み替えられないためです。
     */
    pending?: boolean;
    /**
     * 待っているあいだのアクセシブルな名前。
     *
     * @remarks
     * 省略すると、待っているあいだ操作が名前を持ちません。`pending` を使うなら併せて渡します。
     */
    pendingLabel?: string;
    /** 子要素へボタンの見た目と props を合成するか。 */
    asChild?: boolean;
  };

/**
 * 一貫した操作状態と focus-visible 表現を提供する基礎ボタン。
 *
 * @remarks
 * `variant` は操作の優先度を表す。既定の `default` は主要操作、`outline` は副次操作、
 * `ghost` は周囲の情報量を増やさない補助操作、`destructive` は取り消せない結果を伴う操作に
 * 使う。画面固有の配色を直接指定せず、variant の追加または design token の見直しで扱う。
 *
 * disabled 状態は native `disabled` 属性で指定する。`asChild` でリンクを使う場合、
 * HTML の link には `disabled` が存在しないため、遷移禁止の状態を表す別の UI を選ぶ。
 *
 * @example
 * ```tsx
 * import Link from "next/link";
 *
 * <Button type="submit">保存する</Button>
 *
 * <Button asChild variant={BUTTON_VARIANT.OUTLINE}>
 *   <Link href="/settings">設定へ進む</Link>
 * </Button>
 * ```
 *
 * @param props - native `button` 属性と、以下の表示用 props。
 * @param props.variant - 操作の優先度に対応する見た目。
 * @param props.size - 操作を置く領域に対応する大きさ。
 * @param props.asChild - 子要素へボタンの見た目と props を合成するか。
 * @see Storybook `Action/Button`
 */
export function Button({
  className,
  variant,
  size,
  asChild = false,
  pending = false,
  pendingLabel,
  children,
  disabled,
  ...props
}: ButtonProps) {
  const Component = asChild ? Slot.Root : "button";

  if (asChild || !pending) {
    return (
      <Component
        className={cn(buttonVariants({ variant, size, className }))}
        disabled={disabled}
        {...props}
      >
        {children}
      </Component>
    );
  }

  return (
    <Component
      // 文言が見えないあいだの名前。
      aria-label={pendingLabel}
      aria-busy={true}
      className={cn(buttonVariants({ variant, size, className }), "relative")}
      disabled={true}
      {...props}
    >
      {/* 文言は場所を取ったまま見えなくする。取り除くと幅が縮む。 */}
      <span className="invisible inline-flex items-center gap-2">{children}</span>
      <span className="absolute inset-0 inline-flex items-center justify-center">
        <Spinner />
      </span>
    </Component>
  );
}
