"use client";

import { ContextMenu as ContextMenuPrimitive } from "radix-ui";
import type { ComponentProps } from "react";

import { cn } from "@/components/cn";
import { CheckIcon, ChevronRightIcon, CircleIcon } from "@/components/icon";

import { CONTEXT_MENU_ITEM_VARIANT, type ContextMenuItemVariant } from "./context-menu.definition";

/**
 * 対象を右クリック（touch では長押し、keyboard では Context Menu キー）したときに
 * 操作の一覧を開く root。
 *
 * @remarks
 * 開く手段は pointer の副ボタン・長押し・Context Menu キーだけで、画面上に trigger が
 * 現れない。そのため、この menu は**同じ操作へ到達できる可視の導線がすでにある場合の
 * 加速手段**として使う。ここでしか到達できない操作を置いてはならない。行ごとの操作なら
 * `RowActions`、trigger を伴う menu なら `DropdownMenu` が可視の導線を担う。
 *
 * @remarks
 * `ContextMenuTrigger` が覆う範囲では、browser 既定のコンテキストメニューが開かなくなる。
 * 画像の保存やリンクのコピーといった browser の機能もその範囲で使えなくなるため、
 * 覆う範囲は操作対象の要素に限る。
 *
 * 開閉と focus 管理のため hydration が必要で、Server Component からは直接 render できない。
 * 項目の内容自体に client runtime が要らない場合は、Server Component で組み立てた要素を
 * `children` として渡す。
 *
 * @example
 * ```tsx
 * <ContextMenu>
 *   <ContextMenuTrigger>{row}</ContextMenuTrigger>
 *   <ContextMenuContent>
 *     <ContextMenuItem onSelect={edit}>編集</ContextMenuItem>
 *   </ContextMenuContent>
 * </ContextMenu>
 * ```
 *
 * @param props - Radix `ContextMenu.Root` の props。`modal` を `false` にすると、開いている
 *   間も背後の内容を操作・スクロールできる。
 *
 * @see Storybook `Overlay/ContextMenu`
 */
function ContextMenu({ ...props }: ComponentProps<typeof ContextMenuPrimitive.Root>) {
  return <ContextMenuPrimitive.Root data-slot="context-menu" {...props} />;
}

/**
 * menu を開く対象の領域。
 *
 * @remarks
 * 子として渡した要素そのものが対象領域になる。行・card・画像など、操作の対象と一致する
 * 範囲だけを覆う。領域が広すぎると、無関係な場所の右クリックまで奪う。
 *
 * この領域は focus を受け取らない。keyboard から開くには、領域内の focus 可能な要素へ
 * tab で移動してから Context Menu キー（または Shift+F10）を押す。行そのものに focus 可能な
 * 要素が無い場合、keyboard からは開けないため、可視の導線が唯一の経路になる。
 *
 * @param props - Radix `ContextMenu.Trigger` の props。`disabled` を指定すると領域を無効にし、
 *   browser 既定のコンテキストメニューへ戻す。
 *
 * @see Storybook `Overlay/ContextMenu`
 */
function ContextMenuTrigger({ ...props }: ComponentProps<typeof ContextMenuPrimitive.Trigger>) {
  return <ContextMenuPrimitive.Trigger data-slot="context-menu-trigger" {...props} />;
}

/**
 * 関連する項目をひとまとまりとして扱う区切り。
 *
 * @remarks
 * 見た目の区切り線は引かない。線が必要な場合は `ContextMenuSeparator` を併せて置く。
 * 群に名前を与える場合は `ContextMenuLabel` を先頭に置く。
 *
 * @param props - Radix `ContextMenu.Group` の props。
 *
 * @see Storybook `Overlay/ContextMenu`
 */
function ContextMenuGroup({ ...props }: ComponentProps<typeof ContextMenuPrimitive.Group>) {
  return <ContextMenuPrimitive.Group data-slot="context-menu-group" {...props} />;
}

/**
 * menu の内容を DOM の別の位置へ描画する境界。
 *
 * @remarks
 * `ContextMenuContent` は内部で Portal を通すため、通常は明示的に置く必要がない。描画先の
 * container を差し替える場合だけ使う。
 *
 * @param props - Radix `ContextMenu.Portal` の props。`container` で描画先を指定する。
 *
 * @see Storybook `Overlay/ContextMenu`
 */
function ContextMenuPortal({ ...props }: ComponentProps<typeof ContextMenuPrimitive.Portal>) {
  return <ContextMenuPrimitive.Portal data-slot="context-menu-portal" {...props} />;
}

/**
 * 入れ子の menu を構成する root。
 *
 * @remarks
 * `ContextMenuSubTrigger` と `ContextMenuSubContent` を子に置く。階層を深くするほど pointer の
 * 移動が難しくなるため、入れ子は一段に留め、それ以上の分岐が必要なら別の画面か `Dialog` を使う。
 *
 * @param props - Radix `ContextMenu.Sub` の props。
 *
 * @see Storybook `Overlay/ContextMenu`
 */
function ContextMenuSub({ ...props }: ComponentProps<typeof ContextMenuPrimitive.Sub>) {
  return <ContextMenuPrimitive.Sub data-slot="context-menu-sub" {...props} />;
}

/**
 * 単一選択の項目群をまとめる境界。
 *
 * @remarks
 * `ContextMenuRadioItem` を子に置き、`value` と `onValueChange` で選択値を扱う。選択は即座に
 * 反映されるため、確定操作を挟みたい場合は menu ではなく form を使う。
 *
 * @param props - Radix `ContextMenu.RadioGroup` の props。
 *
 * @see Storybook `Overlay/ContextMenu`
 */
function ContextMenuRadioGroup({
  ...props
}: ComponentProps<typeof ContextMenuPrimitive.RadioGroup>) {
  return <ContextMenuPrimitive.RadioGroup data-slot="context-menu-radio-group" {...props} />;
}

/**
 * 入れ子の menu を開く項目。
 *
 * @remarks
 * 右端に開く向きを示す装飾のアイコンを伴う。項目自体は操作を実行せず、`ContextMenuSubContent`
 * を開くだけである。
 *
 * `inset` は、同じ menu 内に checkbox / radio 項目があるときに左端の余白を揃えるための表示
 * 指定であり、意味論は変えない。
 *
 * @param props - Radix `ContextMenu.SubTrigger` の props と、以下の表示用 props。
 * @param props.inset - 左端の余白を indicator 付き項目に揃えるか。
 *
 * @see Storybook `Overlay/ContextMenu`
 */
function ContextMenuSubTrigger({
  className,
  inset,
  children,
  ...props
}: ComponentProps<typeof ContextMenuPrimitive.SubTrigger> & {
  inset?: boolean;
}) {
  return (
    <ContextMenuPrimitive.SubTrigger
      className={cn(
        "flex cursor-default items-center rounded-sm px-2 py-1.5 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-[inset]:pl-8 data-[state=open]:bg-accent data-[state=open]:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground",
        className,
      )}
      data-inset={inset}
      data-slot="context-menu-sub-trigger"
      {...props}
    >
      {children}
      <ChevronRightIcon aria-hidden="true" className="ml-auto" />
    </ContextMenuPrimitive.SubTrigger>
  );
}

/**
 * 入れ子の menu の内容。
 *
 * @remarks
 * `ContextMenuSubTrigger` の隣へ開き、収まらない場合は自動で向きを変える。面はページ内容の上へ
 * 重なるため不透明である必要がある。
 *
 * @param props - Radix `ContextMenu.SubContent` の props。
 *
 * @see Storybook `Overlay/ContextMenu`
 */
function ContextMenuSubContent({
  className,
  ...props
}: ComponentProps<typeof ContextMenuPrimitive.SubContent>) {
  return (
    <ContextMenuPrimitive.SubContent
      className={cn(
        "z-50 min-w-[8rem] origin-(--radix-context-menu-content-transform-origin) overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-lg data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
        className,
      )}
      data-slot="context-menu-sub-content"
      {...props}
    />
  );
}

/**
 * 開いた menu の内容。
 *
 * @remarks
 * `role="menu"` を持ち、子の項目が `menuitem` として扱われる。Portal を通して body 直下へ
 * 描画し、pointer の位置に開く。開いている間は上下キーで項目を移動でき、Escape で閉じて
 * 対象領域へ focus が戻る。
 *
 * 面はページ内容の上へ重なるため不透明である必要がある。項目数が画面に収まらない場合は
 * 内容側がスクロールする。
 *
 * @param props - Radix `ContextMenu.Content` の props。`onCloseAutoFocus` で閉じた後の focus を
 *   変更できる。
 *
 * @see Storybook `Overlay/ContextMenu`
 */
function ContextMenuContent({
  className,
  ...props
}: ComponentProps<typeof ContextMenuPrimitive.Content>) {
  return (
    <ContextMenuPrimitive.Portal>
      <ContextMenuPrimitive.Content
        className={cn(
          "z-50 max-h-(--radix-context-menu-content-available-height) min-w-[8rem] origin-(--radix-context-menu-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
          className,
        )}
        data-slot="context-menu-content"
        {...props}
      />
    </ContextMenuPrimitive.Portal>
  );
}

/**
 * 選ぶと操作を実行する menu 項目。
 *
 * @remarks
 * `onSelect` で操作を受け取る。選択すると menu は閉じる。閉じたくない場合は `onSelect` で
 * 既定動作を止める。
 *
 * `variant` に {@link CONTEXT_MENU_ITEM_VARIANT} の `destructive` を指定すると、取り消せない
 * 操作であることを配色で示す。確認が必要な操作は、選択後に `AlertDialog` を開いて確定させる。
 *
 * `inset` は、同じ menu 内に checkbox / radio 項目があるときに左端の余白を揃えるための表示
 * 指定であり、意味論は変えない。
 *
 * @param props - Radix `ContextMenu.Item` の props と、以下の表示用 props。
 * @param props.variant - 取り消せない操作を区別する見た目。
 * @param props.inset - 左端の余白を indicator 付き項目に揃えるか。
 *
 * @see Storybook `Overlay/ContextMenu`
 */
function ContextMenuItem({
  className,
  inset,
  variant = CONTEXT_MENU_ITEM_VARIANT.DEFAULT,
  ...props
}: ComponentProps<typeof ContextMenuPrimitive.Item> & {
  inset?: boolean;
  variant?: ContextMenuItemVariant;
}) {
  return (
    <ContextMenuPrimitive.Item
      className={cn(
        "relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[inset]:pl-8 data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 data-[variant=destructive]:focus:text-destructive dark:data-[variant=destructive]:focus:bg-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground data-[variant=destructive]:*:[svg]:text-destructive!",
        className,
      )}
      data-inset={inset}
      data-slot="context-menu-item"
      data-variant={variant}
      {...props}
    />
  );
}

/**
 * 選択状態を切り替える menu 項目。
 *
 * @remarks
 * `role="menuitemcheckbox"` として選択状態が読み上げられる。左端の check は表示用であり、
 * 状態そのものは `checked` が表す。切り替えは即座に反映されるため、確定操作を挟みたい場合は
 * menu ではなく form を使う。
 *
 * @param props - Radix `ContextMenu.CheckboxItem` の props。`checked` と `onCheckedChange` で
 *   状態を扱う。
 *
 * @see Storybook `Overlay/ContextMenu`
 */
function ContextMenuCheckboxItem({
  className,
  children,
  checked,
  ...props
}: ComponentProps<typeof ContextMenuPrimitive.CheckboxItem>) {
  return (
    <ContextMenuPrimitive.CheckboxItem
      checked={checked}
      className={cn(
        "relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      data-slot="context-menu-checkbox-item"
      {...props}
    >
      <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
        <ContextMenuPrimitive.ItemIndicator>
          <CheckIcon aria-hidden="true" className="size-4" />
        </ContextMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </ContextMenuPrimitive.CheckboxItem>
  );
}

/**
 * 単一選択の menu 項目。
 *
 * @remarks
 * `role="menuitemradio"` として選択状態が読み上げられる。`ContextMenuRadioGroup` の子に置き、
 * 群の `value` と一致する項目が選択状態になる。
 *
 * @param props - Radix `ContextMenu.RadioItem` の props。`value` で項目を識別する。
 *
 * @see Storybook `Overlay/ContextMenu`
 */
function ContextMenuRadioItem({
  className,
  children,
  ...props
}: ComponentProps<typeof ContextMenuPrimitive.RadioItem>) {
  return (
    <ContextMenuPrimitive.RadioItem
      className={cn(
        "relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      data-slot="context-menu-radio-item"
      {...props}
    >
      <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
        <ContextMenuPrimitive.ItemIndicator>
          <CircleIcon aria-hidden="true" className="size-2 fill-current" />
        </ContextMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </ContextMenuPrimitive.RadioItem>
  );
}

/**
 * 項目群に名前を与える見出し。
 *
 * @remarks
 * それ自体は選択できない。操作対象が何であるかを示す場合に、menu の先頭または
 * `ContextMenuGroup` の先頭へ置く。
 *
 * `inset` は、同じ menu 内に checkbox / radio 項目があるときに左端の余白を揃えるための表示
 * 指定であり、意味論は変えない。
 *
 * @param props - Radix `ContextMenu.Label` の props と、以下の表示用 props。
 * @param props.inset - 左端の余白を indicator 付き項目に揃えるか。
 *
 * @see Storybook `Overlay/ContextMenu`
 */
function ContextMenuLabel({
  className,
  inset,
  ...props
}: ComponentProps<typeof ContextMenuPrimitive.Label> & {
  inset?: boolean;
}) {
  return (
    <ContextMenuPrimitive.Label
      className={cn(
        "px-2 py-1.5 text-sm font-emphasis text-foreground data-[inset]:pl-8",
        className,
      )}
      data-inset={inset}
      data-slot="context-menu-label"
      {...props}
    />
  );
}

/**
 * 項目群のあいだに引く区切り線。
 *
 * @remarks
 * 装飾であり、支援技術には項目として扱われない。群の意味を伝える必要がある場合は
 * `ContextMenuLabel` を使う。
 *
 * @param props - Radix `ContextMenu.Separator` の props。
 *
 * @see Storybook `Overlay/ContextMenu`
 */
function ContextMenuSeparator({
  className,
  ...props
}: ComponentProps<typeof ContextMenuPrimitive.Separator>) {
  return (
    <ContextMenuPrimitive.Separator
      className={cn("-mx-1 my-1 h-px bg-border", className)}
      data-slot="context-menu-separator"
      {...props}
    />
  );
}

/**
 * 項目の右端へ、対応するキーボード操作を表示する補助テキスト。
 *
 * @remarks
 * 表示だけを担い、キーの割り当ては行わない。実際の shortcut は呼び出し元が別途実装する。
 * 割り当てていない表記を置くと、押しても何も起きない案内になる。
 *
 * @param props - native `span` 属性。
 *
 * @see Storybook `Overlay/ContextMenu`
 */
function ContextMenuShortcut({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      className={cn("ml-auto text-xs tracking-widest text-muted-foreground", className)}
      data-slot="context-menu-shortcut"
      {...props}
    />
  );
}

export {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuPortal,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
};
