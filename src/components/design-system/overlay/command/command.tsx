"use client";

import { Command as CommandPrimitive } from "cmdk";
import type { ComponentProps } from "react";

import { cn } from "@/components/cn";
import { SearchIcon } from "@/components/icon";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../dialog/dialog";

/**
 * 入力した語で候補を絞り込む、検索可能な一覧の root。
 *
 * @remarks
 * 入力に応じた絞り込みと、上下キー・Enter による候補の移動と決定を browser 側で行うため
 * hydration が必要で、Server Component からは直接 render できない。候補そのものに client
 * runtime が要らない場合は、Server Component で組み立てた要素を `children` として渡す。
 *
 * 絞り込みは既定で、候補のテキストに対する**順序を保った部分列一致**で行われる。文字が連続して
 * いなくても、入力した順に現れれば一致する（「一覧を開く」は `一く` や `覧開` に一致し、`開一`
 * には一致しない）。読みは正規化しないため、かな入力は漢字の候補に一致しない。読みで引かせたい
 * 場合は `CommandItem` の `keywords` に読みを渡す。
 *
 * 候補の取得、並び順、決定時の遷移や実行は持たないため、いずれも呼び出し元が `onSelect` で扱う。
 *
 * 面を持つ枠として単体で置くこともでき、modal として開く場合は `CommandDialog` を使う。
 *
 * `label` は検索入力のアクセシブルな名前になるため**必ず指定する**。`CommandInput` へ
 * `aria-label` を渡しても名前にはならない。検索入力は常に `aria-labelledby` で内部の隠し
 * label を参照しており、その参照が `aria-label` より優先されるためである。`label` を省くと
 * 参照先が空のまま残り、名前を持たない入力になる。
 *
 * @param props - cmdk `Command` の props。`label` は検索入力のアクセシブルな名前、
 *   `value` / `onValueChange` は選択中の候補の制御、`shouldFilter` を `false` にすると
 *   絞り込みを呼び出し元が担う。
 *
 * @see Storybook `Overlay/Command`
 */
function Command({ className, ...props }: ComponentProps<typeof CommandPrimitive>) {
  return (
    <CommandPrimitive
      className={cn(
        "flex h-full w-full flex-col overflow-hidden rounded-md bg-popover text-popover-foreground",
        className,
      )}
      data-slot="command"
      {...props}
    />
  );
}

/**
 * {@link CommandDialog} の props。
 */
type CommandDialogProps = ComponentProps<typeof Dialog> & {
  /** dialog のアクセシブルな名前。視覚的には隠れる。 */
  title?: string;
  /** dialog の説明。視覚的には隠れる。 */
  description?: string;
  /** 内側の `Command` へ渡す追加の class。 */
  className?: string;
  /** 右上の閉じる操作を描画するか。 */
  showCloseButton?: boolean;
};

/**
 * 検索可能な一覧を、画面を覆う modal として開く。
 *
 * @remarks
 * `title` と `description` は視覚的に隠れるが、dialog のアクセシブルな名前と説明として必ず
 * 読み上げられる。既定の文言は汎用のため、置いた画面で何を検索できるのかが分かる文言へ
 * 呼び出し元が差し替える。
 *
 * 開閉状態は持たない。`open` / `onOpenChange` で呼び出し元が制御する。キーボード shortcut で
 * 開く導線を作る場合も、キー入力の購読は feature 側に置く。
 *
 * @param props - `Dialog` の props に、上記の表示用 props を加えたもの。
 *
 * @see Storybook `Overlay/Command`
 */
function CommandDialog({
  title = "コマンドパレット",
  description = "実行する操作を検索します。",
  children,
  className,
  showCloseButton = true,
  ...props
}: CommandDialogProps) {
  return (
    <Dialog {...props}>
      <DialogContent
        className={cn("overflow-hidden p-0", className)}
        showCloseButton={showCloseButton}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <Command
          label={title}
          className="**:data-[slot=command-input-wrapper]:h-12 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-emphasis [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]]:px-2 [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5"
        >
          {children}
        </Command>
      </DialogContent>
    </Dialog>
  );
}

/**
 * 候補を絞り込む検索入力。
 *
 * @remarks
 * `role="combobox"` を持ち、`CommandList` を `aria-controls` で参照し、選択中の候補を
 * `aria-activedescendant` で示す。関連付けは cmdk が行うため、`id` を手で振る必要はない。
 *
 * 検索アイコンは装飾であり読み上げられない。何を検索する入力なのかは `placeholder` だけに
 * 頼らず、`Command` の `label`（`CommandDialog` では `title`）で必ず伝える。この component へ
 * 直接 `aria-label` を渡してもアクセシブルな名前にはならない。
 *
 * @param props - cmdk `Command.Input` の props。
 *
 * @see Storybook `Overlay/Command`
 */
function CommandInput({ className, ...props }: ComponentProps<typeof CommandPrimitive.Input>) {
  return (
    <div className="flex h-9 items-center gap-2 border-b px-3" data-slot="command-input-wrapper">
      <SearchIcon className="size-4 shrink-0 opacity-50" />
      <CommandPrimitive.Input
        className={cn(
          "flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-hidden placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        data-slot="command-input"
        {...props}
      />
    </div>
  );
}

/**
 * 絞り込まれた候補を並べる領域。
 *
 * @remarks
 * `role="listbox"` を持つ。高さの上限を超えるとこの領域だけがスクロールする。
 *
 * アクセシブルな名前は `label` で決まり、既定は「候補」である。cmdk の既定は英語のため、この
 * component が日本語で上書きしている。listbox の中身が候補以外の意味を持つ場合だけ `label` を
 * 変える。`aria-label` を直接渡しても cmdk が `label` から組み立て直すため効かない。
 *
 * @param props - cmdk `Command.List` の props。`label` は listbox のアクセシブルな名前。
 *
 * @see Storybook `Overlay/Command`
 */
function CommandList({
  className,
  label = "候補",
  ...props
}: ComponentProps<typeof CommandPrimitive.List>) {
  return (
    <CommandPrimitive.List
      className={cn("max-h-[300px] scroll-py-1 overflow-x-hidden overflow-y-auto", className)}
      data-slot="command-list"
      label={label}
      {...props}
    />
  );
}

/**
 * 一致する候補が無いときだけ表示される領域。
 *
 * @remarks
 * 表示の切り替えは cmdk が行うため、呼び出し元が候補数を数える必要はない。文言は
 * `children` として渡す。
 *
 * **`CommandList` の外、その兄弟として置く。** listbox が持てるのは候補だけで、候補以外の
 * 文言を中へ入れると、候補が無いあいだ listbox は「中身の役割が合わない listbox」になる。
 *
 * @param props - cmdk `Command.Empty` の props。
 *
 * @see Storybook `Overlay/Command`
 */
function CommandEmpty({ className, ...props }: ComponentProps<typeof CommandPrimitive.Empty>) {
  return (
    <CommandPrimitive.Empty
      className={cn("py-6 text-center text-sm", className)}
      data-slot="command-empty"
      {...props}
    />
  );
}

/**
 * 候補を意味のあるまとまりへ分ける group。
 *
 * @remarks
 * `heading` に見出しを渡すと、group の上に小さなラベルとして表示される。group 内の候補が
 * すべて絞り込みで消えた場合、group ごと表示されなくなる。
 *
 * @param props - cmdk `Command.Group` の props。
 *
 * @see Storybook `Overlay/Command`
 */
function CommandGroup({ className, ...props }: ComponentProps<typeof CommandPrimitive.Group>) {
  return (
    <CommandPrimitive.Group
      className={cn(
        "overflow-hidden p-1 text-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-emphasis [&_[cmdk-group-heading]]:text-muted-foreground",
        className,
      )}
      data-slot="command-group"
      {...props}
    />
  );
}

/**
 * group と group の間に引く区切り線。
 *
 * @remarks
 * 見た目だけの区切りであり、意味論は持たない。支援技術からは既定で隠す。cmdk は
 * `role="separator"` を固定で付けるが、`listbox` が子に許すのは `option` と `group` だけであり、
 * 区切りが読み上げの対象として残ると ARIA として不正な入れ子になる。group の見出しが読み上げ順
 * での区切りをすでに伝えるため、隠しても伝わる情報は減らない。
 *
 * @param props - cmdk `Command.Separator` の props。
 *
 * @see Storybook `Overlay/Command`
 */
function CommandSeparator({
  className,
  ...props
}: ComponentProps<typeof CommandPrimitive.Separator>) {
  return (
    <CommandPrimitive.Separator
      aria-hidden="true"
      className={cn("-mx-1 h-px bg-border", className)}
      data-slot="command-separator"
      {...props}
    />
  );
}

/**
 * 選択できる候補の一件。
 *
 * @remarks
 * `role="option"` を持ち、pointer と上下キーのどちらでも選択できる。決定時の処理は
 * `onSelect` で受け取る。`disabled` を指定した候補は選択対象から外れる。
 *
 * 絞り込みの対象になる文字列は、既定では候補のテキストである。表示文字列と検索したい語が
 * 異なる場合や、かな入力でも引かせたい場合は `value` と `keywords` で指定する。
 *
 * @param props - cmdk `Command.Item` の props。
 *
 * @see Storybook `Overlay/Command`
 */
function CommandItem({ className, ...props }: ComponentProps<typeof CommandPrimitive.Item>) {
  return (
    <CommandPrimitive.Item
      className={cn(
        "relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground",
        className,
      )}
      data-slot="command-item"
      {...props}
    />
  );
}

/**
 * 候補の右端へ添える、キーボード操作の補足表示。
 *
 * @remarks
 * 表示だけを担い、キー入力は購読しない。shortcut を実際に効かせる処理は feature 側に置く。
 *
 * @param props - native `span` 属性。
 *
 * @see Storybook `Overlay/Command`
 */
function CommandShortcut({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      className={cn("ml-auto text-xs tracking-widest text-muted-foreground", className)}
      data-slot="command-shortcut"
      {...props}
    />
  );
}

export type { CommandDialogProps };
export {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
};
