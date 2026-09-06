import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useId } from "react";

import { SearchIcon, XIcon } from "@/components/icon";

import { Label } from "../label/label";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
  InputGroupTextarea,
} from "./input-group";
import { INPUT_GROUP_ADDON_ALIGN, INPUT_GROUP_BUTTON_SIZE } from "./input-group.definition";

function UnitInputGroup() {
  const quantityId = useId();

  return (
    <div className="w-80 space-y-2">
      <Label htmlFor={quantityId}>数量</Label>
      <InputGroup>
        <InputGroupInput id={quantityId} inputMode="numeric" name="quantity" />
        <InputGroupAddon align={INPUT_GROUP_ADDON_ALIGN.INLINE_END}>
          <InputGroupText>kg</InputGroupText>
        </InputGroupAddon>
      </InputGroup>
    </div>
  );
}

function IconAddonInputGroup() {
  const keywordId = useId();

  return (
    <div className="w-80 space-y-2">
      <Label htmlFor={keywordId}>キーワード</Label>
      <InputGroup>
        <InputGroupAddon>
          <SearchIcon aria-hidden="true" />
        </InputGroupAddon>
        <InputGroupInput id={keywordId} name="keyword" type="search" />
      </InputGroup>
    </div>
  );
}

function BothAddonsInputGroup() {
  const keywordId = useId();

  return (
    <div className="w-80 space-y-2">
      <Label htmlFor={keywordId}>キーワード</Label>
      <InputGroup>
        <InputGroupAddon>
          <SearchIcon aria-hidden="true" />
        </InputGroupAddon>
        <InputGroupInput defaultValue="入力済みの値" id={keywordId} name="keyword" />
        <InputGroupAddon align={INPUT_GROUP_ADDON_ALIGN.INLINE_END}>
          <InputGroupButton aria-label="入力を消去" size={INPUT_GROUP_BUTTON_SIZE.ICON_EXTRA_SMALL}>
            <XIcon aria-hidden="true" />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </div>
  );
}

function ButtonSizesInputGroup() {
  const extraSmallId = useId();
  const smallId = useId();
  const iconExtraSmallId = useId();
  const iconSmallId = useId();

  return (
    <div className="w-80 space-y-4">
      <div className="space-y-2">
        <Label htmlFor={extraSmallId}>xs</Label>
        <InputGroup>
          <InputGroupInput id={extraSmallId} name="extraSmall" />
          <InputGroupAddon align={INPUT_GROUP_ADDON_ALIGN.INLINE_END}>
            <InputGroupButton>実行</InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </div>
      <div className="space-y-2">
        <Label htmlFor={smallId}>sm</Label>
        <InputGroup>
          <InputGroupInput id={smallId} name="small" />
          <InputGroupAddon align={INPUT_GROUP_ADDON_ALIGN.INLINE_END}>
            <InputGroupButton size={INPUT_GROUP_BUTTON_SIZE.SMALL}>実行</InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </div>
      <div className="space-y-2">
        <Label htmlFor={iconExtraSmallId}>icon-xs</Label>
        <InputGroup>
          <InputGroupInput id={iconExtraSmallId} name="iconExtraSmall" />
          <InputGroupAddon align={INPUT_GROUP_ADDON_ALIGN.INLINE_END}>
            <InputGroupButton aria-label="検索する" size={INPUT_GROUP_BUTTON_SIZE.ICON_EXTRA_SMALL}>
              <SearchIcon aria-hidden="true" />
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </div>
      <div className="space-y-2">
        <Label htmlFor={iconSmallId}>icon-sm</Label>
        <InputGroup>
          <InputGroupInput id={iconSmallId} name="iconSmall" />
          <InputGroupAddon align={INPUT_GROUP_ADDON_ALIGN.INLINE_END}>
            <InputGroupButton aria-label="検索する" size={INPUT_GROUP_BUTTON_SIZE.ICON_SMALL}>
              <SearchIcon aria-hidden="true" />
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </div>
    </div>
  );
}

function BlockAlignInputGroup() {
  const noteId = useId();

  return (
    <div className="w-80 space-y-2">
      <Label htmlFor={noteId}>補足</Label>
      <InputGroup>
        <InputGroupAddon align={INPUT_GROUP_ADDON_ALIGN.BLOCK_START}>
          <InputGroupText>Markdown 記法が使えます</InputGroupText>
        </InputGroupAddon>
        <InputGroupTextarea id={noteId} name="note" placeholder="自由に記入できます" rows={3} />
        <InputGroupAddon align={INPUT_GROUP_ADDON_ALIGN.BLOCK_END}>
          <InputGroupButton size={INPUT_GROUP_BUTTON_SIZE.SMALL}>添付する</InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </div>
  );
}

function InvalidInputGroup() {
  const quantityId = useId();
  const errorId = useId();

  return (
    <div className="w-80 space-y-2">
      <Label htmlFor={quantityId}>数量</Label>
      <InputGroup>
        <InputGroupInput
          aria-describedby={errorId}
          aria-invalid="true"
          defaultValue="-1"
          id={quantityId}
          inputMode="numeric"
          name="quantity"
        />
        <InputGroupAddon align={INPUT_GROUP_ADDON_ALIGN.INLINE_END}>
          <InputGroupText>kg</InputGroupText>
        </InputGroupAddon>
      </InputGroup>
      <p className="text-sm text-destructive" id={errorId}>
        0 以上の値を入力してください。
      </p>
    </div>
  );
}

function DisabledInputGroup() {
  const enabledId = useId();
  const controlOnlyId = useId();
  const groupDisabledId = useId();

  return (
    <div className="w-80 space-y-4">
      <div className="space-y-2">
        <Label htmlFor={enabledId}>操作できる状態</Label>
        <InputGroup>
          <InputGroupInput defaultValue="12" id={enabledId} inputMode="numeric" name="quantity" />
          <InputGroupAddon align={INPUT_GROUP_ADDON_ALIGN.INLINE_END}>
            <InputGroupText>kg</InputGroupText>
          </InputGroupAddon>
        </InputGroup>
      </div>
      <div className="space-y-2">
        <Label htmlFor={controlOnlyId}>control だけ disabled</Label>
        <InputGroup>
          <InputGroupInput
            defaultValue="12"
            disabled
            id={controlOnlyId}
            inputMode="numeric"
            name="quantity"
          />
          <InputGroupAddon align={INPUT_GROUP_ADDON_ALIGN.INLINE_END}>
            <InputGroupText>kg</InputGroupText>
          </InputGroupAddon>
        </InputGroup>
      </div>
      <div className="space-y-2">
        <Label htmlFor={groupDisabledId}>枠ごと disabled にする</Label>
        <InputGroup disabled>
          <InputGroupInput
            defaultValue="12"
            disabled
            id={groupDisabledId}
            inputMode="numeric"
            name="quantity"
          />
          <InputGroupAddon align={INPUT_GROUP_ADDON_ALIGN.INLINE_END}>
            <InputGroupText>kg</InputGroupText>
          </InputGroupAddon>
        </InputGroup>
      </div>
    </div>
  );
}

const meta = {
  title: "Form/InputGroup",
  component: InputGroup,
  parameters: { layout: "centered" },
} satisfies Meta<typeof InputGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 入力欄の後ろへ単位を添える基本構成。addon の空白を押すと入力欄へ focus が移る。 */
export const Default: Story = { render: () => <UnitInputGroup /> };

/** 入力欄の前へアイコンを置く場合。アイコンは装飾であり、名前は `Label` が与える。 */
export const IconAddon: Story = { render: () => <IconAddonInputGroup /> };

/** 前後の両方に addon を置く場合。後ろの addon には操作を収める。 */
export const BothAddons: Story = { render: () => <BothAddonsInputGroup /> };

/** 枠内へ収まる button の大きさ。文言を伴う `xs` / `sm` と、正方形の `icon-xs` / `icon-sm`。 */
export const ButtonSizes: Story = { render: () => <ButtonSizesInputGroup /> };

/** addon を上下へ積む場合。外枠は縦積みになり、複数行の入力欄と組み合わせられる。 */
export const BlockAlign: Story = { render: () => <BlockAlignInputGroup /> };

/** `aria-invalid` を指定した場合。外枠の枠線も invalid の表示へ変わる。 */
export const Invalid: Story = { render: () => <InvalidInputGroup /> };

/** control を `disabled` にすると枠線が控えめな色へ落ちる。`disabled` を渡すと addon も減光し、枠ごと操作できないことが支援技術へ伝わる。 */
export const Disabled: Story = { render: () => <DisabledInputGroup /> };
