"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { Dialog as SheetPrimitive } from "radix-ui";
import type { ComponentProps } from "react";

import { cn } from "@/components/cn";
import { XIcon } from "@/components/icon";

import { useOverlayHistory } from "../use-overlay-history";

import { SHEET_SIDE, type SheetSide } from "./sheet.definition";

const sheetContentVariants = cva(
  "fixed z-50 flex flex-col gap-4 bg-background shadow-lg transition ease-in-out data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=open]:animate-in data-[state=open]:duration-500",
  {
    variants: {
      side: {
        [SHEET_SIDE.RIGHT]:
          "inset-y-0 right-0 h-full w-3/4 border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-sm",
        [SHEET_SIDE.LEFT]:
          "inset-y-0 left-0 h-full w-3/4 border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-sm",
        [SHEET_SIDE.TOP]:
          "inset-x-0 top-0 h-auto border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
        [SHEET_SIDE.BOTTOM]:
          "inset-x-0 bottom-0 h-auto border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
      },
    },
    defaultVariants: {
      side: SHEET_SIDE.RIGHT,
    },
  },
);

/**
 * 画面端から現れる modal パネルとして、補助的な navigation や絞り込み面を開く client island root。
 *
 * @remarks
 * 開閉状態・focus trap・Escape・背面の inert 化を browser 側で行うため hydration が必要で、
 * Server Component からは直接 render できない。内容自体に client runtime が要らない場合は、
 * Server Component で組み立てた要素を `children` として渡す。
 *
 * 画面中央へ内容を集めて注視させる場合は `Dialog`、取り消せない操作の確認には専用の意味論
 * (`role="alertdialog"`) を持つ `AlertDialog` を使う。
 *
 * @param props - Radix `Dialog.Root` の props。`open` / `defaultOpen` / `onOpenChange` で開閉を
 *   制御でき、省略時は trigger と close の操作だけで開閉する。
 *
 * @see Storybook `Overlay/Sheet`
 */
function Sheet({
  open,
  defaultOpen,
  onOpenChange,
  ...props
}: ComponentProps<typeof SheetPrimitive.Root>) {
  const history = useOverlayHistory({ defaultOpen, onOpenChange, open });

  return (
    <SheetPrimitive.Root
      data-slot="sheet"
      onOpenChange={history.setOpen}
      open={history.open}
      {...props}
    />
  );
}

/**
 * Sheet を開く trigger。
 *
 * @remarks
 * 既定では `button` を render する。`Button` や link を trigger にする場合は `asChild` を指定して
 * 単一の子要素へ合成する。
 *
 * @param props - Radix `Dialog.Trigger` の props。
 *
 * @see Storybook `Overlay/Sheet`
 */
function SheetTrigger({ ...props }: ComponentProps<typeof SheetPrimitive.Trigger>) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

/**
 * sheet を閉じる操作。
 *
 * @remarks
 * footer の「キャンセル」や、内容側に置く任意の閉じる操作へ使う。`Button` を使う場合は `asChild`
 * で合成する。右上の閉じる操作は `SheetContent` が既定で描画する。
 *
 * @param props - Radix `Dialog.Close` の props。
 *
 * @see Storybook `Overlay/Sheet`
 */
function SheetClose({ ...props }: ComponentProps<typeof SheetPrimitive.Close>) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />;
}

/**
 * sheet を document body 側へ描画する Portal。
 *
 * @remarks
 * `SheetContent` が内部で使うため、通常は直接指定しない。描画先の container を差し替える場合だけ
 * 使う。
 *
 * @param props - Radix `Dialog.Portal` の props。
 *
 * @see Storybook `Overlay/Sheet`
 */
function SheetPortal({ ...props }: ComponentProps<typeof SheetPrimitive.Portal>) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />;
}

/**
 * sheet の背面を覆う overlay。
 *
 * @remarks
 * `SheetContent` が内部で描画するため、通常は直接指定しない。
 *
 * @param props - Radix `Dialog.Overlay` の props。
 *
 * @see Storybook `Overlay/Sheet`
 */
function SheetOverlay({ className, ...props }: ComponentProps<typeof SheetPrimitive.Overlay>) {
  return (
    <SheetPrimitive.Overlay
      className={cn(
        "fixed inset-0 z-50 bg-black/50 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0",
        className,
      )}
      data-slot="sheet-overlay"
      {...props}
    />
  );
}

/** {@link SheetContent} の props。 */
type SheetContentProps = ComponentProps<typeof SheetPrimitive.Content> &
  Omit<VariantProps<typeof sheetContentVariants>, "side"> & {
    /**
     * sheet が現れ、固定される画面の端。
     *
     * - `right` / `left`: 画面の高さいっぱいの縦長パネル。navigation や絞り込みに使う
     * - `top` / `bottom`: 画面の幅いっぱいの横長パネル。内容の高さに合わせて伸縮する
     */
    side?: SheetSide;
    /**
     * 右上の閉じる操作を描画するか。
     *
     * `false` にする場合は、内容側に `SheetClose` の閉じる手段を必ず用意する。
     */
    showCloseButton?: boolean;
  };

/**
 * overlay・Portal を伴って、画面端に固定された sheet 本体を描画する。
 *
 * @remarks
 * modal のため、開いている間は背面が操作不能になる。内容は縦方向の flex で並び、`SheetFooter` の
 * `mt-auto` によって余白があるときは下端へ寄る。内容が長い場合のスクロールは、呼び出し元が
 * `className` で overflow を指定して扱う。
 *
 * アクセシブルな名前として `SheetTitle` を必ず子に置く。説明が要る場合は `SheetDescription` を
 * 添え、不要な場合は `aria-describedby={undefined}` を明示する。どちらも無いと Radix が警告する。
 *
 * @param props - Radix `Dialog.Content` の props に `side` と `showCloseButton` を加えたもの。
 *
 * @see Storybook `Overlay/Sheet`
 */
function SheetContent({
  className,
  children,
  side = SHEET_SIDE.RIGHT,
  showCloseButton = true,
  ...props
}: SheetContentProps) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content
        className={cn(sheetContentVariants({ side }), className)}
        data-slot="sheet-content"
        {...props}
      >
        {children}
        {showCloseButton ? (
          <SheetPrimitive.Close
            className="absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active focus-visible:shadow-glow-primary disabled:pointer-events-none data-[state=open]:bg-accent"
            data-slot="sheet-close"
          >
            <XIcon className="size-4" />
            <span className="sr-only">閉じる</span>
          </SheetPrimitive.Close>
        ) : null}
      </SheetPrimitive.Content>
    </SheetPortal>
  );
}

/**
 * title と説明をまとめる領域。
 *
 * @param props - native `div` 属性。
 *
 * @see Storybook `Overlay/Sheet`
 */
function SheetHeader({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("flex flex-col gap-1.5 p-4", className)}
      data-slot="sheet-header"
      {...props}
    />
  );
}

/**
 * 操作を並べる footer 領域。
 *
 * @remarks
 * 配置だけを担い、操作そのものは持たない。閉じる操作は `SheetClose` を `Button` へ合成して
 * 呼び出し元が置く。`mt-auto` により、内容が短いときは sheet の下端へ寄る。
 *
 * @param props - native `div` 属性。
 *
 * @see Storybook `Overlay/Sheet`
 */
function SheetFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("mt-auto flex flex-col gap-2 p-4", className)}
      data-slot="sheet-footer"
      {...props}
    />
  );
}

/**
 * sheet のアクセシブルな名前を提供する title。
 *
 * @remarks
 * Radix が `aria-labelledby` を自動で結び付けるため、`id` を手で振る必要はない。既定では `h2` を
 * render する。見出しの階層を合わせる必要がある場合は `asChild` で別の heading 要素へ合成する。
 *
 * @param props - Radix `Dialog.Title` の props。
 *
 * @see Storybook `Overlay/Sheet`
 */
function SheetTitle({ className, ...props }: ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      className={cn("font-emphasis text-foreground", className)}
      data-slot="sheet-title"
      {...props}
    />
  );
}

/**
 * sheet の目的や内容を説明する本文。
 *
 * @remarks
 * Radix が `aria-describedby` を自動で結び付ける。
 *
 * @param props - Radix `Dialog.Description` の props。
 *
 * @see Storybook `Overlay/Sheet`
 */
function SheetDescription({
  className,
  ...props
}: ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      className={cn("text-sm text-muted-foreground", className)}
      data-slot="sheet-description"
      {...props}
    />
  );
}

export type { SheetContentProps };
export {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetOverlay,
  SheetPortal,
  SheetTitle,
  SheetTrigger,
};
