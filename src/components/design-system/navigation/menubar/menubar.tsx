"use client";

import { Menubar as MenubarPrimitive } from "radix-ui";
import type { ComponentProps } from "react";

import { cn } from "@/components/cn";
import { CheckIcon, ChevronRightIcon, CircleIcon } from "@/components/icon";
import { KbdGroup } from "../../display/kbd/kbd";
import { MENUBAR_ITEM_VARIANT, type MenubarItemVariant } from "./menubar.definition";

/**
 * 常に見えている横一列の menu 群をまとめる、client island の root。
 *
 * @remarks
 * デスクトップアプリの「ファイル / 編集 / 表示」に相当する、**画面全体に対する操作の
 * 上位構造**を表す。単一の trigger から操作を開くだけなら `DropdownMenu`、対象を
 * 右クリックして開くなら `ContextMenu` を使う。サイトの階層を辿る遷移は menu ではなく
 * `NavigationMenu` / `Breadcrumb` の担当で、ここに置くと役割が混ざる。
 *
 * 一つの menu を開いている間は、左右キーと hover で隣の menu へ移れる。この横断的な移動が
 * menubar の本体であり、`DropdownMenu` を横に並べても代わりにはならない。
 *
 * 開閉・roving focus・型入力による項目移動・Escape・外側クリックを browser 側で行うため
 * hydration が必要で、Server Component からは直接 render できない。項目の内容自体に
 * client runtime が要らない場合は、Server Component で組み立てた要素を `children` として渡す。
 *
 * @remarks
 * 同じ画面に menubar が複数ある場合は、`aria-label` でそれぞれを区別する。
 *
 * @example
 * ```tsx
 * <Menubar>
 *   <MenubarMenu>
 *     <MenubarTrigger>ファイル</MenubarTrigger>
 *     <MenubarContent>
 *       <MenubarItem onSelect={createDraft}>新規作成</MenubarItem>
 *     </MenubarContent>
 *   </MenubarMenu>
 * </Menubar>
 * ```
 *
 * @param props - Radix `Menubar.Root` の props。`value` / `defaultValue` / `onValueChange` で
 *   開いている menu を制御でき、`loop` で端から端への移動を繋げる。
 *
 * @see Storybook `Navigation/Menubar`
 */
function Menubar({ className, ...props }: ComponentProps<typeof MenubarPrimitive.Root>) {
  return (
    <MenubarPrimitive.Root
      className={cn(
        "flex h-9 items-center gap-1 rounded-md border bg-background p-1 shadow-xs",
        className,
      )}
      data-slot="menubar"
      {...props}
    />
  );
}

/**
 * trigger と内容の対を、menubar の中の一つの menu として束ねる境界。
 *
 * @remarks
 * `MenubarTrigger` と `MenubarContent` を子に置く。`Menubar` の直下に並べた順が、そのまま
 * 左右キーで移動する順になる。
 *
 * @param props - Radix `Menubar.Menu` の props。`value` を与えると、root 側から
 *   この menu を開いた状態として指定できる。
 *
 * @see Storybook `Navigation/Menubar`
 */
function MenubarMenu({ ...props }: ComponentProps<typeof MenubarPrimitive.Menu>) {
  return <MenubarPrimitive.Menu data-slot="menubar-menu" {...props} />;
}

/**
 * 関連する項目をひとまとまりとして扱う区切り。
 *
 * @remarks
 * 見た目の区切り線は引かない。線が必要な場合は `MenubarSeparator` を併せて置く。群に名前を
 * 与える場合は `MenubarLabel` を先頭に置く。
 *
 * @param props - Radix `Menubar.Group` の props。
 *
 * @see Storybook `Navigation/Menubar`
 */
function MenubarGroup({ ...props }: ComponentProps<typeof MenubarPrimitive.Group>) {
  return <MenubarPrimitive.Group data-slot="menubar-group" {...props} />;
}

/**
 * menu の内容を DOM の別の位置へ描画する境界。
 *
 * @remarks
 * `MenubarContent` は内部で Portal を通すため、通常は明示的に置く必要がない。描画先の
 * container を差し替える場合だけ使う。
 *
 * @param props - Radix `Menubar.Portal` の props。`container` で描画先を指定する。
 *
 * @see Storybook `Navigation/Menubar`
 */
function MenubarPortal({ ...props }: ComponentProps<typeof MenubarPrimitive.Portal>) {
  return <MenubarPrimitive.Portal data-slot="menubar-portal" {...props} />;
}

/**
 * 単一選択の項目群をまとめる境界。
 *
 * @remarks
 * `MenubarRadioItem` を子に置き、`value` と `onValueChange` で選択値を扱う。選択は即座に
 * 反映されるため、確定操作を挟みたい場合は menu ではなく form を使う。
 *
 * @param props - Radix `Menubar.RadioGroup` の props。
 *
 * @see Storybook `Navigation/Menubar`
 */
function MenubarRadioGroup({ ...props }: ComponentProps<typeof MenubarPrimitive.RadioGroup>) {
  return <MenubarPrimitive.RadioGroup data-slot="menubar-radio-group" {...props} />;
}

/**
 * menu を開く、常に見えている trigger。
 *
 * @remarks
 * `menuitem` として扱われ、`aria-haspopup` と `aria-expanded` で menu の存在と開閉を伝える。
 * 文言は「ファイル」「表示」のように操作の分類を表す名詞にし、開く動作そのものは説明しない。
 *
 * 別の menu が開いている間は、hover するだけでこの menu へ切り替わる。単独で操作を実行する
 * button として使ってはならない。
 *
 * @param props - Radix `Menubar.Trigger` の props。`disabled` でこの menu だけを無効にできる。
 *
 * @see Storybook `Navigation/Menubar`
 */
function MenubarTrigger({ className, ...props }: ComponentProps<typeof MenubarPrimitive.Trigger>) {
  return (
    <MenubarPrimitive.Trigger
      className={cn(
        "flex items-center rounded-sm px-2 py-1 text-sm font-emphasis outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground",
        className,
      )}
      data-slot="menubar-trigger"
      {...props}
    />
  );
}

/**
 * 開いた menu の内容。
 *
 * @remarks
 * `role="menu"` を持ち、子の項目が `menuitem` として扱われる。Portal を通して body 直下へ
 * 描画し、対応する `MenubarTrigger` の直下へ開く。開いている間は上下キーで項目を移動でき、
 * 左右キーで隣の menu へ移り、Escape で閉じて trigger へ focus が戻る。
 *
 * 面はページ内容の上へ重なるため不透明である必要がある。
 *
 * @param props - Radix `Menubar.Content` の props。既定では trigger の左端へ寄せて開く。
 *   `align` / `alignOffset` / `sideOffset` で位置を調整する。
 *
 * @see Storybook `Navigation/Menubar`
 */
function MenubarContent({
  className,
  align = "start",
  alignOffset = -4,
  sideOffset = 8,
  ...props
}: ComponentProps<typeof MenubarPrimitive.Content>) {
  return (
    <MenubarPortal>
      <MenubarPrimitive.Content
        align={align}
        alignOffset={alignOffset}
        className={cn(
          "z-50 min-w-[12rem] origin-(--radix-menubar-content-transform-origin) overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
          className,
        )}
        data-slot="menubar-content"
        sideOffset={sideOffset}
        {...props}
      />
    </MenubarPortal>
  );
}

/**
 * 選ぶと操作を実行する menu 項目。
 *
 * @remarks
 * `onSelect` で操作を受け取る。選択すると menu は閉じる。閉じたくない場合は `onSelect` で
 * 既定動作を止める。
 *
 * `variant` に {@link MENUBAR_ITEM_VARIANT} の `destructive` を指定すると、取り消せない操作で
 * あることを配色で示す。確認が必要な操作は、選択後に `AlertDialog` を開いて確定させる。
 *
 * `inset` は、同じ menu 内に checkbox / radio 項目があるときに左端の余白を揃えるための表示
 * 指定であり、意味論は変えない。
 *
 * @param props - Radix `Menubar.Item` の props と、以下の表示用 props。
 * @param props.variant - 取り消せない操作を区別する見た目。
 * @param props.inset - 左端の余白を indicator 付き項目に揃えるか。
 *
 * @see Storybook `Navigation/Menubar`
 */
function MenubarItem({
  className,
  inset,
  variant = MENUBAR_ITEM_VARIANT.DEFAULT,
  ...props
}: ComponentProps<typeof MenubarPrimitive.Item> & {
  inset?: boolean;
  variant?: MenubarItemVariant;
}) {
  return (
    <MenubarPrimitive.Item
      className={cn(
        "relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[inset]:pl-8 data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 data-[variant=destructive]:focus:text-destructive dark:data-[variant=destructive]:focus:bg-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground data-[variant=destructive]:*:[svg]:text-destructive!",
        className,
      )}
      data-inset={inset}
      data-slot="menubar-item"
      data-variant={variant}
      {...props}
    />
  );
}

/**
 * 選択状態を切り替える menu 項目。
 *
 * @remarks
 * `role="menuitemcheckbox"` として選択状態が読み上げられる。左端の check は表示用であり、状態
 * そのものは `checked` が表す。切り替えは即座に反映されるため、確定操作を挟みたい場合は menu
 * ではなく form を使う。
 *
 * @param props - Radix `Menubar.CheckboxItem` の props。`checked` と `onCheckedChange` で
 *   状態を扱う。
 *
 * @see Storybook `Navigation/Menubar`
 */
function MenubarCheckboxItem({
  className,
  children,
  checked,
  ...props
}: ComponentProps<typeof MenubarPrimitive.CheckboxItem>) {
  return (
    <MenubarPrimitive.CheckboxItem
      checked={checked}
      className={cn(
        "relative flex cursor-default items-center gap-2 rounded-xs py-1.5 pr-2 pl-8 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      data-slot="menubar-checkbox-item"
      {...props}
    >
      <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
        <MenubarPrimitive.ItemIndicator>
          <CheckIcon aria-hidden="true" className="size-4" />
        </MenubarPrimitive.ItemIndicator>
      </span>
      {children}
    </MenubarPrimitive.CheckboxItem>
  );
}

/**
 * 単一選択の menu 項目。
 *
 * @remarks
 * `role="menuitemradio"` として選択状態が読み上げられる。`MenubarRadioGroup` の子に置き、群の
 * `value` と一致する項目が選択状態になる。
 *
 * @param props - Radix `Menubar.RadioItem` の props。`value` で項目を識別する。
 *
 * @see Storybook `Navigation/Menubar`
 */
function MenubarRadioItem({
  className,
  children,
  ...props
}: ComponentProps<typeof MenubarPrimitive.RadioItem>) {
  return (
    <MenubarPrimitive.RadioItem
      className={cn(
        "relative flex cursor-default items-center gap-2 rounded-xs py-1.5 pr-2 pl-8 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      data-slot="menubar-radio-item"
      {...props}
    >
      <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
        <MenubarPrimitive.ItemIndicator>
          <CircleIcon aria-hidden="true" className="size-2 fill-current" />
        </MenubarPrimitive.ItemIndicator>
      </span>
      {children}
    </MenubarPrimitive.RadioItem>
  );
}

/**
 * 項目群に名前を与える見出し。
 *
 * @remarks
 * それ自体は選択できない。項目の並びが何の集まりかを示す場合に、menu の先頭または
 * `MenubarGroup` の先頭へ置く。
 *
 * `inset` は、同じ menu 内に checkbox / radio 項目があるときに左端の余白を揃えるための表示
 * 指定であり、意味論は変えない。
 *
 * @param props - Radix `Menubar.Label` の props と、以下の表示用 props。
 * @param props.inset - 左端の余白を indicator 付き項目に揃えるか。
 *
 * @see Storybook `Navigation/Menubar`
 */
function MenubarLabel({
  className,
  inset,
  ...props
}: ComponentProps<typeof MenubarPrimitive.Label> & {
  inset?: boolean;
}) {
  return (
    <MenubarPrimitive.Label
      className={cn("px-2 py-1.5 text-sm font-emphasis data-[inset]:pl-8", className)}
      data-inset={inset}
      data-slot="menubar-label"
      {...props}
    />
  );
}

/**
 * 項目群のあいだに引く区切り線。
 *
 * @remarks
 * 装飾であり、支援技術には項目として扱われない。群の意味を伝える必要がある場合は
 * `MenubarLabel` を使う。
 *
 * @param props - Radix `Menubar.Separator` の props。
 *
 * @see Storybook `Navigation/Menubar`
 */
function MenubarSeparator({
  className,
  ...props
}: ComponentProps<typeof MenubarPrimitive.Separator>) {
  return (
    <MenubarPrimitive.Separator
      className={cn("-mx-1 my-1 h-px bg-border", className)}
      data-slot="menubar-separator"
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
 * <MenubarShortcut>
 *   <Kbd>⌘</Kbd>
 *   <Kbd>N</Kbd>
 * </MenubarShortcut>
 * ```
 *
 * @param props - native `kbd` 属性。
 *
 * @see Storybook `Navigation/Menubar`
 */
function MenubarShortcut({ className, ...props }: ComponentProps<"kbd">) {
  return (
    <KbdGroup
      className={cn("ml-auto text-xs tracking-widest text-muted-foreground", className)}
      data-slot="menubar-shortcut"
      {...props}
    />
  );
}

/**
 * 入れ子の menu を構成する root。
 *
 * @remarks
 * `MenubarSubTrigger` と `MenubarSubContent` を子に置く。階層を深くするほど pointer の移動が
 * 難しくなるため、入れ子は一段に留め、それ以上の分岐が必要なら別の画面か `Dialog` を使う。
 *
 * @param props - Radix `Menubar.Sub` の props。
 *
 * @see Storybook `Navigation/Menubar`
 */
function MenubarSub({ ...props }: ComponentProps<typeof MenubarPrimitive.Sub>) {
  return <MenubarPrimitive.Sub data-slot="menubar-sub" {...props} />;
}

/**
 * 入れ子の menu を開く項目。
 *
 * @remarks
 * 右端に開く向きを示す装飾のアイコンを伴う。項目自体は操作を実行せず、`MenubarSubContent` を
 * 開くだけである。
 *
 * `inset` は、同じ menu 内に checkbox / radio 項目があるときに左端の余白を揃えるための表示
 * 指定であり、意味論は変えない。
 *
 * @param props - Radix `Menubar.SubTrigger` の props と、以下の表示用 props。
 * @param props.inset - 左端の余白を indicator 付き項目に揃えるか。
 *
 * @see Storybook `Navigation/Menubar`
 */
function MenubarSubTrigger({
  className,
  inset,
  children,
  ...props
}: ComponentProps<typeof MenubarPrimitive.SubTrigger> & {
  inset?: boolean;
}) {
  return (
    <MenubarPrimitive.SubTrigger
      className={cn(
        "flex cursor-default items-center rounded-sm px-2 py-1.5 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-[inset]:pl-8 data-[state=open]:bg-accent data-[state=open]:text-accent-foreground",
        className,
      )}
      data-inset={inset}
      data-slot="menubar-sub-trigger"
      {...props}
    >
      {children}
      <ChevronRightIcon aria-hidden="true" className="ml-auto h-4 w-4" />
    </MenubarPrimitive.SubTrigger>
  );
}

/**
 * 入れ子の menu の内容。
 *
 * @remarks
 * `MenubarSubTrigger` の隣へ開き、収まらない場合は自動で向きを変える。面はページ内容の上へ
 * 重なるため不透明である必要がある。
 *
 * @param props - Radix `Menubar.SubContent` の props。
 *
 * @see Storybook `Navigation/Menubar`
 */
function MenubarSubContent({
  className,
  ...props
}: ComponentProps<typeof MenubarPrimitive.SubContent>) {
  return (
    <MenubarPrimitive.SubContent
      className={cn(
        "z-50 min-w-[8rem] origin-(--radix-menubar-content-transform-origin) overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-lg data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
        className,
      )}
      data-slot="menubar-sub-content"
      {...props}
    />
  );
}

export {
  Menubar,
  MenubarCheckboxItem,
  MenubarContent,
  MenubarGroup,
  MenubarItem,
  MenubarLabel,
  MenubarMenu,
  MenubarPortal,
  MenubarRadioGroup,
  MenubarRadioItem,
  MenubarSeparator,
  MenubarShortcut,
  MenubarSub,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarTrigger,
};
