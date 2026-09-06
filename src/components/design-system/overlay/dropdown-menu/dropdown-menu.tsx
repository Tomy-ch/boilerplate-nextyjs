"use client";

import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui";
import type { ComponentProps } from "react";

import { cn } from "@/components/cn";
import { CheckIcon, ChevronRightIcon, CircleIcon } from "@/components/icon";
import { KbdGroup } from "../../display/kbd/kbd";
import {
  DROPDOWN_MENU_ITEM_VARIANT,
  type DropdownMenuItemVariant,
} from "./dropdown-menu.definition";

/**
 * trigger から操作の一覧を開く、client island の menu root。
 *
 * @remarks
 * 開閉・roving focus・型入力による項目移動・Escape・外側クリックを browser 側で行うため
 * hydration が必要で、Server Component からは直接 render できない。
 *
 * 中身は「操作」に限る。読み物や form を入れたい場合は `Popover`、画面を覆う編集は `Dialog`
 * を使う。menu は touch device と screen reader で到達コストが高いので、主導線の操作を
 * menu の中だけに置かない。
 *
 * @param props - Radix `DropdownMenu.Root` の props。`open` / `defaultOpen` / `onOpenChange`
 *   で開閉を制御でき、省略時は trigger の操作だけで開閉する。
 *
 * @see Storybook `Overlay/DropdownMenu`
 */
function DropdownMenu({ ...props }: ComponentProps<typeof DropdownMenuPrimitive.Root>) {
  return <DropdownMenuPrimitive.Root data-slot="dropdown-menu" {...props} />;
}

/**
 * menu を document body 側へ描画する Portal。
 *
 * @remarks
 * `DropdownMenuContent` が内部で使うため、通常は直接指定しない。描画先の container を
 * 差し替える場合だけ使う。
 *
 * @param props - Radix `DropdownMenu.Portal` の props。
 *
 * @see Storybook `Overlay/DropdownMenu`
 */
function DropdownMenuPortal({ ...props }: ComponentProps<typeof DropdownMenuPrimitive.Portal>) {
  return <DropdownMenuPrimitive.Portal data-slot="dropdown-menu-portal" {...props} />;
}

/**
 * menu を開く trigger。
 *
 * @remarks
 * 既定では `button` を render する。`Button` を trigger にする場合は `asChild` を指定して
 * 単一の子要素へ合成する。開閉状態は `aria-expanded` として自動的に反映される。
 *
 * icon だけの trigger にする場合は、`sr-only` のテキストなどでアクセシブルな名前を必ず与える。
 * 一覧の行ごとに menu を置くときは、どの行に対する操作かが名前から分かるようにする。
 *
 * @param props - Radix `DropdownMenu.Trigger` の props。
 *
 * @see Storybook `Overlay/DropdownMenu`
 */
function DropdownMenuTrigger({ ...props }: ComponentProps<typeof DropdownMenuPrimitive.Trigger>) {
  return <DropdownMenuPrimitive.Trigger data-slot="dropdown-menu-trigger" {...props} />;
}

/**
 * Portal へ表示する menu 本体。
 *
 * @remarks
 * `role="menu"` を持ち、子の項目が `menuitem` として扱われる。表示位置は `side` / `align` /
 * `sideOffset` で調整する。viewport に収まらない場合は Radix が自動で反転・調整するため、
 * feature 側で座標を計算しない。
 *
 * @param props - Radix `DropdownMenu.Content` の props。`className` は既定の見た目へ追加・
 *   上書きできる。
 *
 * @see Storybook `Overlay/DropdownMenu`
 */
function DropdownMenuContent({
  className,
  sideOffset = 4,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        className={cn(
          "z-50 max-h-(--radix-dropdown-menu-content-available-height) min-w-[8rem] origin-(--radix-dropdown-menu-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
          className,
        )}
        data-slot="dropdown-menu-content"
        sideOffset={sideOffset}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
}

/**
 * 関連する項目をまとめる group。
 *
 * @remarks
 * `DropdownMenuLabel` と組み合わせて、group に見出しを与える。区切り線だけが必要な場合は
 * `DropdownMenuSeparator` を使う。
 *
 * @param props - Radix `DropdownMenu.Group` の props。
 *
 * @see Storybook `Overlay/DropdownMenu`
 */
function DropdownMenuGroup({ ...props }: ComponentProps<typeof DropdownMenuPrimitive.Group>) {
  return <DropdownMenuPrimitive.Group data-slot="dropdown-menu-group" {...props} />;
}

/**
 * 選択すると menu を閉じて操作を実行する項目。
 *
 * @remarks
 * `variant` に {@link DROPDOWN_MENU_ITEM_VARIANT} の `destructive` を指定すると、取り消せない
 * 操作であることを色で示す。色だけが手がかりにならないよう、文言でも操作内容が分かるようにし、
 * 実行前の確認が要る場合は選択後に `AlertDialog` を開く。
 *
 * `inset` は、同じ menu 内に checkbox / radio 項目があるときに左端の余白を揃えるための表示
 * 指定であり、意味論は変えない。
 *
 * @param props - Radix `DropdownMenu.Item` の props。`disabled` で操作不能にできる。
 * @param props.inset - 左端の余白を indicator 付き項目に揃えるか。
 * @param props.variant - 項目の見た目。
 *
 * @see Storybook `Overlay/DropdownMenu`
 */
function DropdownMenuItem({
  className,
  inset,
  variant = DROPDOWN_MENU_ITEM_VARIANT.DEFAULT,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.Item> & {
  inset?: boolean;
  variant?: DropdownMenuItemVariant;
}) {
  return (
    <DropdownMenuPrimitive.Item
      className={cn(
        "relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[inset]:pl-8 data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 data-[variant=destructive]:focus:text-destructive dark:data-[variant=destructive]:focus:bg-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground data-[variant=destructive]:*:[svg]:text-destructive!",
        className,
      )}
      data-inset={inset}
      data-slot="dropdown-menu-item"
      data-variant={variant}
      {...props}
    />
  );
}

/**
 * 選択状態を切り替える checkbox 項目。
 *
 * @remarks
 * `role="menuitemcheckbox"` として選択状態が読み上げられる。左端の check は表示用であり、
 * 状態は `checked` / `onCheckedChange` で扱う。
 *
 * 既定では選択のたびに menu が閉じる。続けて複数を切り替えたい場合は `onSelect` で
 * `event.preventDefault()` を呼ぶと開いたままになり、枠外の操作や Escape で閉じる。
 * どちらが適切かは用途で変わるため、この component 側では既定を変えない。
 *
 * @param props - Radix `DropdownMenu.CheckboxItem` の props。
 *
 * @see Storybook `Overlay/DropdownMenu`
 */
function DropdownMenuCheckboxItem({
  className,
  children,
  checked,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.CheckboxItem>) {
  return (
    <DropdownMenuPrimitive.CheckboxItem
      checked={checked}
      className={cn(
        "relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      data-slot="dropdown-menu-checkbox-item"
      {...props}
    >
      <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <CheckIcon className="size-4" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.CheckboxItem>
  );
}

/**
 * 単一選択の radio 項目をまとめる group。
 *
 * @remarks
 * `value` / `onValueChange` で選択値を扱う。並び順や表示期間のように、択一の設定へ使う。
 *
 * @param props - Radix `DropdownMenu.RadioGroup` の props。
 *
 * @see Storybook `Overlay/DropdownMenu`
 */
function DropdownMenuRadioGroup({
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.RadioGroup>) {
  return <DropdownMenuPrimitive.RadioGroup data-slot="dropdown-menu-radio-group" {...props} />;
}

/**
 * group 内で択一に選択される radio 項目。
 *
 * @remarks
 * `role="menuitemradio"` として選択状態が読み上げられる。`DropdownMenuRadioGroup` の子に置く。
 * `DropdownMenuCheckboxItem` と同じく、既定では選択のたびに menu が閉じる。
 *
 * @param props - Radix `DropdownMenu.RadioItem` の props。
 *
 * @see Storybook `Overlay/DropdownMenu`
 */
function DropdownMenuRadioItem({
  className,
  children,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.RadioItem>) {
  return (
    <DropdownMenuPrimitive.RadioItem
      className={cn(
        "relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      data-slot="dropdown-menu-radio-item"
      {...props}
    >
      <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <CircleIcon className="size-2 fill-current" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.RadioItem>
  );
}

/**
 * group の見出し。
 *
 * @remarks
 * 選択できない表示専用の要素で、`menuitem` としては扱われない。
 *
 * @param props - Radix `DropdownMenu.Label` の props。
 * @param props.inset - 左端の余白を indicator 付き項目に揃えるか。
 *
 * @see Storybook `Overlay/DropdownMenu`
 */
function DropdownMenuLabel({
  className,
  inset,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.Label> & {
  inset?: boolean;
}) {
  return (
    <DropdownMenuPrimitive.Label
      className={cn("px-2 py-1.5 text-sm font-emphasis data-[inset]:pl-8", className)}
      data-inset={inset}
      data-slot="dropdown-menu-label"
      {...props}
    />
  );
}

/**
 * 項目群を視覚的・意味論的に区切る separator。
 *
 * @param props - Radix `DropdownMenu.Separator` の props。
 *
 * @see Storybook `Overlay/DropdownMenu`
 */
function DropdownMenuSeparator({
  className,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
  return (
    <DropdownMenuPrimitive.Separator
      className={cn("-mx-1 my-1 h-px bg-border", className)}
      data-slot="dropdown-menu-separator"
      {...props}
    />
  );
}

/**
 * 項目の右端へ添えるキーボード操作の表示。
 *
 * @remarks
 * 右端への配置だけを担い、キーの意味論は `KbdGroup` が持つ。個々のキーは `Kbd` を子として
 * 並べる。単一のキーや短い文字列をそのまま子にしてもよい。
 *
 * 表示だけを担い、shortcut を登録しない。実際のキー操作は呼び出し元が用意する。対応する操作が
 * キーボードから実行できない場合はここに表示しない。
 *
 * @example
 * ```tsx
 * <DropdownMenuShortcut>
 *   <Kbd>⇧</Kbd>
 *   <Kbd>P</Kbd>
 * </DropdownMenuShortcut>
 * ```
 *
 * @param props - native `kbd` 属性。
 *
 * @see Storybook `Overlay/DropdownMenu`
 */
function DropdownMenuShortcut({ className, ...props }: ComponentProps<"kbd">) {
  return (
    <KbdGroup
      className={cn("ml-auto text-xs tracking-widest text-muted-foreground", className)}
      data-slot="dropdown-menu-shortcut"
      {...props}
    />
  );
}

/**
 * 入れ子の menu をまとめる root。
 *
 * @remarks
 * 階層は浅く保つ。深い入れ子は touch device と keyboard で到達しづらくなるため、`Dialog` や
 * 専用画面への遷移を先に検討する。
 *
 * @param props - Radix `DropdownMenu.Sub` の props。
 *
 * @see Storybook `Overlay/DropdownMenu`
 */
function DropdownMenuSub({ ...props }: ComponentProps<typeof DropdownMenuPrimitive.Sub>) {
  return <DropdownMenuPrimitive.Sub data-slot="dropdown-menu-sub" {...props} />;
}

/**
 * 入れ子の menu を開く項目。
 *
 * @remarks
 * 右端の矢印は装飾であり、開閉状態は `aria-expanded` として提供される。
 *
 * @param props - Radix `DropdownMenu.SubTrigger` の props。
 * @param props.inset - 左端の余白を indicator 付き項目に揃えるか。
 *
 * @see Storybook `Overlay/DropdownMenu`
 */
function DropdownMenuSubTrigger({
  className,
  inset,
  children,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.SubTrigger> & {
  inset?: boolean;
}) {
  return (
    <DropdownMenuPrimitive.SubTrigger
      className={cn(
        "flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-[inset]:pl-8 data-[state=open]:bg-accent data-[state=open]:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground",
        className,
      )}
      data-inset={inset}
      data-slot="dropdown-menu-sub-trigger"
      {...props}
    >
      {children}
      <ChevronRightIcon className="ml-auto size-4" />
    </DropdownMenuPrimitive.SubTrigger>
  );
}

/**
 * 入れ子の menu 本体。
 *
 * @param props - Radix `DropdownMenu.SubContent` の props。
 *
 * @see Storybook `Overlay/DropdownMenu`
 */
function DropdownMenuSubContent({
  className,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.SubContent>) {
  return (
    <DropdownMenuPrimitive.SubContent
      className={cn(
        "z-50 min-w-[8rem] origin-(--radix-dropdown-menu-content-transform-origin) overflow-hidden rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-lg data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
        className,
      )}
      data-slot="dropdown-menu-sub-content"
      {...props}
    />
  );
}

export {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
};
