"use client";

import type { ComponentProps } from "react";
import { Drawer as DrawerPrimitive } from "vaul";

import { cn } from "@/components/cn";

import { useOverlayHistory } from "../use-overlay-history";

/**
 * 画面端から引き出し、drag でも閉じられる modal panel の root。
 *
 * @remarks
 * drag の追従と慣性、閉じる判定を browser 側で行うため hydration が必要で、Server Component からは
 * 直接 render できない。内容自体に client runtime が要らない場合は、Server Component で組み立てた
 * 要素を `children` として渡す。
 *
 * `Sheet` との使い分けは操作方法で決める。drag で閉じる、掴んで動かす、といった touch 前提の操作が
 * 要る場合にこの component を選ぶ。pointer と keyboard だけで完結し、固定された面を出せば足りる
 * 場合は `Sheet` を使う。どちらも modal であり、focus trap と Escape は同じように働く。
 *
 * `dismissible` を `false` にすると、drag・overlay・Escape に加えて `DrawerClose` でも閉じなくなる。
 * 内部で開閉を持つ経路がすべて塞がるため、この指定をする場合は `open` / `onOpenChange` で
 * 呼び出し元が開閉を制御し、閉じる条件を自分で決める。
 *
 * @param props - vaul `Drawer.Root` の props。`direction` で引き出す方向、`open` / `onOpenChange`
 *   で開閉を制御できる。
 *
 * @see Storybook `Overlay/Drawer`
 */
function Drawer({
  open,
  defaultOpen,
  onOpenChange,
  ...props
}: ComponentProps<typeof DrawerPrimitive.Root>) {
  const history = useOverlayHistory({ defaultOpen, onOpenChange, open });

  return (
    <DrawerPrimitive.Root
      data-slot="drawer"
      onOpenChange={history.setOpen}
      open={history.open}
      {...props}
    />
  );
}

/**
 * Drawer を開く trigger。
 *
 * @remarks
 * 既定では `button` を render する。`Button` や link を trigger にする場合は `asChild` を指定して
 * 単一の子要素へ合成する。
 *
 * @param props - vaul `Drawer.Trigger` の props。
 *
 * @see Storybook `Overlay/Drawer`
 */
function DrawerTrigger({ ...props }: ComponentProps<typeof DrawerPrimitive.Trigger>) {
  return <DrawerPrimitive.Trigger data-slot="drawer-trigger" {...props} />;
}

/**
 * drawer を document body 側へ描画する Portal。
 *
 * @remarks
 * `DrawerContent` が内部で使うため、通常は直接指定しない。
 *
 * @param props - vaul `Drawer.Portal` の props。
 *
 * @see Storybook `Overlay/Drawer`
 */
function DrawerPortal({ ...props }: ComponentProps<typeof DrawerPrimitive.Portal>) {
  return <DrawerPrimitive.Portal data-slot="drawer-portal" {...props} />;
}

/**
 * drawer を閉じる操作。
 *
 * @remarks
 * footer の「キャンセル」や「閉じる」など、内容側に置く閉じる操作へ使う。`Button` を使う場合は
 * `asChild` で合成する。drag と overlay の操作でも閉じるため必須ではない。
 *
 * `Drawer` に `dismissible={false}` を指定した場合、この操作でも閉じない（{@link Drawer} の
 * `dismissible` を参照）。
 *
 * @param props - vaul `Drawer.Close` の props。
 *
 * @see Storybook `Overlay/Drawer`
 */
function DrawerClose({ ...props }: ComponentProps<typeof DrawerPrimitive.Close>) {
  return <DrawerPrimitive.Close data-slot="drawer-close" {...props} />;
}

/**
 * drawer の背面を覆う overlay。
 *
 * @remarks
 * `DrawerContent` が内部で描画するため、通常は直接指定しない。
 *
 * @param props - vaul `Drawer.Overlay` の props。
 *
 * @see Storybook `Overlay/Drawer`
 */
function DrawerOverlay({ className, ...props }: ComponentProps<typeof DrawerPrimitive.Overlay>) {
  return (
    <DrawerPrimitive.Overlay
      className={cn(
        "fixed inset-0 z-50 bg-black/50 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0",
        className,
      )}
      data-slot="drawer-overlay"
      {...props}
    />
  );
}

/**
 * overlay・Portal とともに drawer 本体を描画する。
 *
 * @remarks
 * modal のため、開いている間は背面が操作不能になる。配置と角丸は `Drawer` の `direction` に応じて
 * 切り替わり、`bottom` のときだけ上端に drag を促す掴み手が現れる。掴み手は装飾であり、支援技術
 * からは隠れる。
 *
 * アクセシブルな名前として `DrawerTitle` を必ず子に置く。説明が要る場合は `DrawerDescription` を
 * 添え、不要な場合は `aria-describedby={undefined}` を明示する。どちらも無いと警告が出る。
 *
 * 内容が高さを超える場合のスクロールは持たない。必要な場合は呼び出し元が `className` で overflow を
 * 指定する。drag と内容のスクロールは競合しうるため、スクロールする領域を作るときは実機で操作を
 * 確認する。
 *
 * @param props - vaul `Drawer.Content` の props。
 *
 * @see Storybook `Overlay/Drawer`
 */
function DrawerContent({
  className,
  children,
  ...props
}: ComponentProps<typeof DrawerPrimitive.Content>) {
  return (
    <DrawerPortal>
      <DrawerOverlay />
      <DrawerPrimitive.Content
        className={cn(
          "group/drawer-content fixed z-50 flex h-auto flex-col bg-background",
          "data-[vaul-drawer-direction=top]:inset-x-0 data-[vaul-drawer-direction=top]:top-0 data-[vaul-drawer-direction=top]:mb-24 data-[vaul-drawer-direction=top]:max-h-[80vh] data-[vaul-drawer-direction=top]:rounded-b-lg data-[vaul-drawer-direction=top]:border-b",
          "data-[vaul-drawer-direction=bottom]:inset-x-0 data-[vaul-drawer-direction=bottom]:bottom-0 data-[vaul-drawer-direction=bottom]:mt-24 data-[vaul-drawer-direction=bottom]:max-h-[80vh] data-[vaul-drawer-direction=bottom]:rounded-t-lg data-[vaul-drawer-direction=bottom]:border-t",
          "data-[vaul-drawer-direction=right]:inset-y-0 data-[vaul-drawer-direction=right]:right-0 data-[vaul-drawer-direction=right]:w-3/4 data-[vaul-drawer-direction=right]:border-l data-[vaul-drawer-direction=right]:sm:max-w-sm",
          "data-[vaul-drawer-direction=left]:inset-y-0 data-[vaul-drawer-direction=left]:left-0 data-[vaul-drawer-direction=left]:w-3/4 data-[vaul-drawer-direction=left]:border-r data-[vaul-drawer-direction=left]:sm:max-w-sm",
          className,
        )}
        data-slot="drawer-content"
        {...props}
      >
        <div
          aria-hidden="true"
          className="mx-auto mt-4 hidden h-2 w-[100px] shrink-0 rounded-full bg-muted group-data-[vaul-drawer-direction=bottom]/drawer-content:block"
          data-slot="drawer-handle"
        />
        {children}
      </DrawerPrimitive.Content>
    </DrawerPortal>
  );
}

/**
 * title と説明をまとめる領域。
 *
 * @remarks
 * `top` / `bottom` では小さい viewport で中央寄せになり、`md` 以上で左寄せへ戻る。
 *
 * @see Storybook `Overlay/Drawer`
 */
function DrawerHeader({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex flex-col gap-0.5 p-4 group-data-[vaul-drawer-direction=bottom]/drawer-content:text-center group-data-[vaul-drawer-direction=top]/drawer-content:text-center md:gap-1.5 md:text-left",
        className,
      )}
      data-slot="drawer-header"
      {...props}
    />
  );
}

/**
 * 操作を並べる footer 領域。
 *
 * @remarks
 * 配置だけを担い、操作そのものは持たない。閉じる操作は `DrawerClose` を `Button` へ合成して
 * 呼び出し元が置く。`mt-auto` により、内容が短いときは drawer の下端へ寄る。
 *
 * @see Storybook `Overlay/Drawer`
 */
function DrawerFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("mt-auto flex flex-col gap-2 p-4", className)}
      data-slot="drawer-footer"
      {...props}
    />
  );
}

/**
 * drawer のアクセシブルな名前を提供する title。
 *
 * @remarks
 * `aria-labelledby` は自動で結び付くため、`id` を手で振る必要はない。
 *
 * @param props - vaul `Drawer.Title` の props。
 *
 * @see Storybook `Overlay/Drawer`
 */
function DrawerTitle({ className, ...props }: ComponentProps<typeof DrawerPrimitive.Title>) {
  return (
    <DrawerPrimitive.Title
      className={cn("font-emphasis text-foreground", className)}
      data-slot="drawer-title"
      {...props}
    />
  );
}

/**
 * drawer の目的や内容を説明する本文。
 *
 * @remarks
 * `aria-describedby` は自動で結び付く。
 *
 * @param props - vaul `Drawer.Description` の props。
 *
 * @see Storybook `Overlay/Drawer`
 */
function DrawerDescription({
  className,
  ...props
}: ComponentProps<typeof DrawerPrimitive.Description>) {
  return (
    <DrawerPrimitive.Description
      className={cn("text-sm text-muted-foreground", className)}
      data-slot="drawer-description"
      {...props}
    />
  );
}

export {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerOverlay,
  DrawerPortal,
  DrawerTitle,
  DrawerTrigger,
};
