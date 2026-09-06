import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import Link from "next/link";
import { useId } from "react";

import { BellIcon, ShieldIcon } from "@/components/icon";

import { Button } from "../../action/button/button";
import { Input } from "../../form/input/input";
import { Label } from "../../form/label/label";
import { SwitchNative } from "../../form/switch-native/switch-native";
import {
  List,
  ListItem,
  ListItemActions,
  ListItemContent,
  ListItemDescription,
  ListItemFooter,
  ListItemHeader,
  ListItemLink,
  ListItemMedia,
  ListItemTitle,
  ListSeparator,
} from "./list";
import { LIST_ITEM_MEDIA_VARIANT, LIST_ITEM_SIZE, LIST_ITEM_VARIANT } from "./list.definition";

const meta = {
  title: "Display/List",
  component: List,
  parameters: { layout: "centered" },
} satisfies Meta<typeof List>;

export default meta;
type Story = StoryObj<typeof meta>;

/** アイコン・見出し・説明・補助操作を並べた基本構成。 */
export const Default: Story = {
  render: () => (
    <List className="w-96">
      <ListItem>
        <ListItemMedia variant={LIST_ITEM_MEDIA_VARIANT.ICON}>
          <BellIcon />
        </ListItemMedia>
        <ListItemContent>
          <ListItemTitle>通知</ListItemTitle>
          <ListItemDescription>新着や状態の変化をお知らせします。</ListItemDescription>
        </ListItemContent>
        <ListItemActions>
          <SwitchNative aria-label="通知を受け取る" defaultChecked />
        </ListItemActions>
      </ListItem>
      <ListSeparator />
      <ListItem>
        <ListItemMedia variant={LIST_ITEM_MEDIA_VARIANT.ICON}>
          <ShieldIcon />
        </ListItemMedia>
        <ListItemContent>
          <ListItemTitle>二要素認証</ListItemTitle>
          <ListItemDescription>ログイン時に追加の確認を求めます。</ListItemDescription>
        </ListItemContent>
        <ListItemActions>
          <Button size="sm" variant="outline">
            設定
          </Button>
        </ListItemActions>
      </ListItem>
    </List>
  ),
};

/** 行全体を遷移先にする場合。`li` を保ったまま `ListItemLink` を子に置く。 */
export const WithLinks: Story = {
  render: () => (
    <List className="w-96">
      <ListItem variant={LIST_ITEM_VARIANT.OUTLINE}>
        <ListItemLink asChild>
          <Link href="/settings/notifications">
            <ListItemMedia variant={LIST_ITEM_MEDIA_VARIANT.ICON}>
              <BellIcon />
            </ListItemMedia>
            <ListItemContent>
              <ListItemTitle>通知設定</ListItemTitle>
              <ListItemDescription>受け取る通知の種類を選びます。</ListItemDescription>
            </ListItemContent>
          </Link>
        </ListItemLink>
      </ListItem>
      <ListItem variant={LIST_ITEM_VARIANT.OUTLINE}>
        <ListItemLink asChild>
          <Link href="/settings/security">
            <ListItemMedia variant={LIST_ITEM_MEDIA_VARIANT.ICON}>
              <ShieldIcon />
            </ListItemMedia>
            <ListItemContent>
              <ListItemTitle>セキュリティ</ListItemTitle>
              <ListItemDescription>ログイン方法と認証を管理します。</ListItemDescription>
            </ListItemContent>
          </Link>
        </ListItemLink>
      </ListItem>
    </List>
  ),
};

function QuantityRow({
  description,
  label,
  name,
}: {
  description: string;
  label: string;
  name: string;
}) {
  const inputId = useId();

  return (
    <ListItem>
      <ListItemContent>
        <ListItemTitle>
          <Label htmlFor={inputId}>{label}</Label>
        </ListItemTitle>
        <ListItemDescription>{description}</ListItemDescription>
      </ListItemContent>
      <ListItemActions>
        <Input className="w-20" defaultValue="1" id={inputId} min="0" name={name} type="number" />
      </ListItemActions>
    </ListItem>
  );
}

/**
 * 行が入力を持つ場合。行を入力用の部品にはせず、`Label` と `Input` を行の中で合成する。
 * 追加・削除や保存は feature が所有するため、この一覧は持たない。
 */
export const WithInputs: Story = {
  render: () => (
    <form action="/submit" className="w-96">
      <List>
        <QuantityRow
          description="1 個あたり 1,200 円"
          label="ノートの数量"
          name="quantity-notebook"
        />
        <ListSeparator />
        <QuantityRow description="1 個あたり 800 円" label="ペンの数量" name="quantity-pen" />
      </List>
      <Button className="mt-4" type="submit">
        更新する
      </Button>
    </form>
  ),
};

/** 面の見せ方。 */
export const Variants: Story = {
  render: () => (
    <List className="w-96 gap-3">
      <ListItem variant={LIST_ITEM_VARIANT.DEFAULT}>
        <ListItemContent>
          <ListItemTitle>既定</ListItemTitle>
        </ListItemContent>
      </ListItem>
      <ListItem variant={LIST_ITEM_VARIANT.OUTLINE}>
        <ListItemContent>
          <ListItemTitle>枠線</ListItemTitle>
        </ListItemContent>
      </ListItem>
      <ListItem variant={LIST_ITEM_VARIANT.MUTED}>
        <ListItemContent>
          <ListItemTitle>控えめな面</ListItemTitle>
        </ListItemContent>
      </ListItem>
    </List>
  ),
};

/** 余白の大きさ。 */
export const Sizes: Story = {
  render: () => (
    <List className="w-96 gap-3">
      <ListItem size={LIST_ITEM_SIZE.DEFAULT} variant={LIST_ITEM_VARIANT.OUTLINE}>
        <ListItemContent>
          <ListItemTitle>既定</ListItemTitle>
        </ListItemContent>
      </ListItem>
      <ListItem size={LIST_ITEM_SIZE.SMALL} variant={LIST_ITEM_VARIANT.OUTLINE}>
        <ListItemContent>
          <ListItemTitle>小</ListItemTitle>
        </ListItemContent>
      </ListItem>
    </List>
  ),
};

/** 見出し行と脚注行を持つ場合。 */
export const WithHeaderAndFooter: Story = {
  render: () => (
    <List className="w-96">
      <ListItem variant={LIST_ITEM_VARIANT.OUTLINE}>
        <ListItemHeader>
          <span className="text-xs text-muted-foreground">セキュリティ</span>
          <span className="text-xs text-muted-foreground">3 日前に更新</span>
        </ListItemHeader>
        <ListItemContent>
          <ListItemTitle>二要素認証</ListItemTitle>
          <ListItemDescription>ログイン時に追加の確認を求めます。</ListItemDescription>
        </ListItemContent>
        <ListItemFooter>
          <span className="text-xs text-muted-foreground">認証アプリを使用中</span>
          <Button size="sm" variant="ghost">
            変更
          </Button>
        </ListItemFooter>
      </ListItem>
    </List>
  ),
};

/** 順序に意味がある一覧。`asChild` で `ol` へ合成する。 */
export const Ordered: Story = {
  render: () => (
    <List asChild className="w-96">
      <ol>
        <ListItem size={LIST_ITEM_SIZE.SMALL}>
          <ListItemContent>
            <ListItemTitle>住所を入力する</ListItemTitle>
          </ListItemContent>
        </ListItem>
        <ListItem size={LIST_ITEM_SIZE.SMALL}>
          <ListItemContent>
            <ListItemTitle>支払い方法を選ぶ</ListItemTitle>
          </ListItemContent>
        </ListItem>
      </ol>
    </List>
  ),
};
