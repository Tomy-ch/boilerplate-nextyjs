import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { InfoIcon } from "@/components/icon";

import { Button } from "../../action/button/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./tooltip";

function DescribedTooltip({
  align = "center",
  defaultOpen = false,
  side = "top",
}: {
  align?: "start" | "center" | "end";
  defaultOpen?: boolean;
  side?: "top" | "right" | "bottom" | "left";
}) {
  return (
    <TooltipProvider>
      <Tooltip defaultOpen={defaultOpen}>
        <TooltipTrigger asChild>
          <Button variant="outline">為替の参考額</Button>
        </TooltipTrigger>
        <TooltipContent align={align} side={side}>
          表示時点の参考レートで換算した概算です。
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function IconTriggerTooltip() {
  return (
    <TooltipProvider>
      <Tooltip defaultOpen>
        <TooltipTrigger aria-label="補足を表示" className="text-muted-foreground">
          <InfoIcon aria-hidden="true" className="size-4" />
        </TooltipTrigger>
        <TooltipContent>この値は保存されず、表示のたびに再計算されます。</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function SharedProviderTooltips() {
  return (
    <TooltipProvider delayDuration={400} skipDelayDuration={300}>
      <div className="flex gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="sm" variant="ghost">
              左
            </Button>
          </TooltipTrigger>
          <TooltipContent>最初の説明です。</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="sm" variant="ghost">
              中
            </Button>
          </TooltipTrigger>
          <TooltipContent>二つ目の説明です。</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="sm" variant="ghost">
              右
            </Button>
          </TooltipTrigger>
          <TooltipContent>三つ目の説明です。</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}

function LongContentTooltip() {
  return (
    <TooltipProvider>
      <Tooltip defaultOpen>
        <TooltipTrigger asChild>
          <Button variant="outline">条件</Button>
        </TooltipTrigger>
        <TooltipContent className="max-w-56">
          同じ内容の再送信を防ぐため、送信ごとに発行した識別子を一定期間保持します。
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

const meta = {
  title: "Overlay/Tooltip",
  component: Tooltip,
  parameters: {
    docs: { story: { inline: false, iframeHeight: 420 } },
    layout: "centered",
  },
} satisfies Meta<typeof Tooltip>;

export default meta;
type Story = StoryObj<typeof meta>;

/** trigger を hover または keyboard focus すると開く基本構成。 */
export const Default: Story = { render: () => <DescribedTooltip /> };

/** 開いた状態。内容は trigger の説明として `aria-describedby` から参照される。 */
export const Open: Story = { render: () => <DescribedTooltip defaultOpen /> };

/** trigger の右端へ開始位置を揃えて表示する場合。 */
export const Placement: Story = {
  render: () => <DescribedTooltip align="start" defaultOpen side="right" />,
};

/** icon だけの trigger。trigger 自身に `aria-label` で名前を与え、tooltip は説明に徹する。 */
export const IconTrigger: Story = { render: () => <IconTriggerTooltip /> };

/** 一つの Provider を共有する場合。表示遅延と、連続表示で遅延を省く猶予をまとめて指定する。 */
export const SharedProvider: Story = { render: () => <SharedProviderTooltips /> };

/** 内容が一行に収まらない場合。既定は `w-fit` なので、折り返す幅は呼び出し元が指定する。 */
export const LongContent: Story = { render: () => <LongContentTooltip /> };
