import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useCallback, useState } from "react";

import { CalendarIcon, FileTextIcon, SettingsIcon, UserIcon } from "@/components/icon";

import { Button } from "../../action/button/button";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "./command";

const noop = () => undefined;

function CommandBody() {
  return (
    <>
      <CommandInput placeholder="操作を検索" />
      <CommandList>
        <CommandGroup heading="移動">
          <CommandItem onSelect={noop}>
            <FileTextIcon />
            一覧を開く
          </CommandItem>
          <CommandItem onSelect={noop}>
            <CalendarIcon />
            予定を開く
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="設定">
          <CommandItem onSelect={noop}>
            <UserIcon />
            プロフィール
            <CommandShortcut>⌘P</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={noop}>
            <SettingsIcon />
            表示設定
            <CommandShortcut>⌘,</CommandShortcut>
          </CommandItem>
          <CommandItem disabled onSelect={noop}>
            権限の管理
          </CommandItem>
        </CommandGroup>
      </CommandList>
      <CommandEmpty>一致する操作はありません。</CommandEmpty>
    </>
  );
}

function InlineCommand() {
  return (
    <Command className="rounded-lg border border-border" label="操作を検索">
      <CommandBody />
    </Command>
  );
}

function NoResultCommand() {
  return (
    <Command className="rounded-lg border border-border" label="操作を検索">
      <CommandInput placeholder="操作を検索" value="該当なし" />
      <CommandList>
        <CommandGroup heading="移動">
          <CommandItem onSelect={noop}>一覧を開く</CommandItem>
        </CommandGroup>
      </CommandList>
      <CommandEmpty>一致する操作はありません。</CommandEmpty>
    </Command>
  );
}

function UnfilteredCommand() {
  return (
    <Command className="rounded-lg border border-border" label="操作を検索" shouldFilter={false}>
      <CommandInput placeholder="呼び出し元が絞り込む" />
      <CommandList>
        <CommandGroup heading="取得済みの候補">
          <CommandItem onSelect={noop}>入力に関係なく常に表示される候補</CommandItem>
          <CommandItem onSelect={noop}>並び順も呼び出し元が決める候補</CommandItem>
        </CommandGroup>
      </CommandList>
      <CommandEmpty>一致する操作はありません。</CommandEmpty>
    </Command>
  );
}

function DialogCommand() {
  const [open, setOpen] = useState(true);
  const openDialog = useCallback(() => setOpen(true), []);

  return (
    <>
      <Button onClick={openDialog} variant="outline">
        操作を検索
      </Button>
      <CommandDialog
        description="実行する操作を検索します。"
        onOpenChange={setOpen}
        open={open}
        title="操作の検索"
      >
        <CommandBody />
      </CommandDialog>
    </>
  );
}

const meta = {
  title: "Overlay/Command",
  component: Command,
  parameters: { layout: "centered", docs: { story: { inline: false, iframeHeight: 480 } } },
  decorators: [
    (Story) => (
      <div className="w-[28rem] max-w-[calc(100vw-2rem)]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Command>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 面として画面内に直接置く構成。group・区切り・shortcut 表示を含む。 */
export const Default: Story = { render: () => <InlineCommand /> };

/** 一致する候補が無い場合。`CommandEmpty` だけが残る。 */
export const NoResult: Story = { render: () => <NoResultCommand /> };

/** `shouldFilter={false}` で絞り込みを呼び出し元が担う場合。 */
export const ExternalFiltering: Story = { render: () => <UnfilteredCommand /> };

/** modal として開く場合。title と説明は視覚的に隠れるが読み上げられる。 */
export const InDialog: Story = { render: () => <DialogCommand /> };
