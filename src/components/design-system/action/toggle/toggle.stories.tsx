import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useCallback, useState } from "react";

import { TextWrapIcon } from "@/components/icon";

import { Toggle } from "./toggle";

function LocalStateToggle() {
  const [pressed, setPressed] = useState(false);
  const toggle = useCallback(() => setPressed((current) => !current), []);

  return (
    <div className="flex flex-col items-start gap-2">
      <Toggle onClick={toggle} pressed={pressed} variant="outline">
        折り返す
      </Toggle>
      <p className="text-muted-foreground text-sm">押下状態: {pressed ? "on" : "off"}</p>
    </div>
  );
}

function FormToggle() {
  return (
    <form action="/items" className="flex items-center gap-2">
      <Toggle name="density" pressed={false} type="submit" value="compact" variant="outline">
        表示を詰める
      </Toggle>
      <span className="text-muted-foreground text-sm">送信して URL に載せる</span>
    </form>
  );
}

const meta = {
  title: "Action/Toggle",
  component: Toggle,
  parameters: { layout: "centered" },
  args: { children: "折り返す", pressed: false },
} satisfies Meta<typeof Toggle>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 未押下。押下状態は `aria-pressed` が伝える。 */
export const Default: Story = {};

/** 押下中。面の塗りで適用中であることを示す。 */
export const Pressed: Story = { args: { pressed: true } };

/** 枠線のある `outline` variant。 */
export const Outline: Story = { args: { variant: "outline" } };

/** 押下中の `outline` variant。 */
export const OutlinePressed: Story = { args: { pressed: true, variant: "outline" } };

/**
 * 大きさの 3 段階。既定 variant は枠も塗りも持たないため、未押下では大きさの差が見えない。
 * 境界のある `outline` と、面が塗られる押下中の 2 行で示す。
 */
export const Sizes: Story = {
  render: (args) => (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        {(["sm", "default", "lg"] as const).map((size) => (
          <Toggle {...args} key={size} size={size} variant="outline">
            {size}
          </Toggle>
        ))}
      </div>
      <div className="flex items-center gap-2">
        {(["sm", "default", "lg"] as const).map((size) => (
          <Toggle {...args} key={size} pressed size={size}>
            {size}
          </Toggle>
        ))}
      </div>
    </div>
  ),
};

/** icon だけの場合。名前は `aria-label` で与え、状態では変えない。 */
export const IconOnly: Story = {
  args: { "aria-label": "折り返す", children: <TextWrapIcon aria-hidden="true" />, pressed: true },
};

/** 操作できない状態。 */
export const Disabled: Story = { args: { disabled: true } };

/** browser 側の一時的な state で切り替える場合。呼び出し元が `pressed` を保持する。 */
export const WithLocalState: Story = { render: () => <LocalStateToggle /> };

/** URL へ載せて切り替える場合。`type="submit"` と `name` / `value` で native form に載せる。 */
export const InForm: Story = { render: () => <FormToggle /> };
