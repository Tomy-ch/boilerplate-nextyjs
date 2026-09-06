import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import Link from "next/link";

import { ClockIcon, InfoIcon } from "@/components/icon";

import { Marker, MarkerContent, MarkerIcon } from "./marker";
import { MARKER_VARIANT, type MarkerVariant } from "./marker.definition";

function MetaMarker({ variant }: { variant?: MarkerVariant }) {
  return (
    <Marker variant={variant}>
      <MarkerContent>最終更新 2026-08-03</MarkerContent>
    </Marker>
  );
}

function IconMarker() {
  return (
    <Marker>
      <MarkerIcon>
        <ClockIcon />
      </MarkerIcon>
      <MarkerContent>最終更新 2026-08-03</MarkerContent>
    </Marker>
  );
}

function SeparatorInContext() {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm">一つ前の内容がここに並びます。</p>
      <Marker variant={MARKER_VARIANT.SEPARATOR}>
        <MarkerContent>ここまで表示しました</MarkerContent>
      </Marker>
      <p className="text-sm">区切りより後ろの内容がここに続きます。</p>
    </div>
  );
}

function BorderInContext() {
  return (
    <div className="flex flex-col gap-3">
      <Marker variant={MARKER_VARIANT.BORDER}>
        <MarkerIcon>
          <InfoIcon />
        </MarkerIcon>
        <MarkerContent>補足</MarkerContent>
      </Marker>
      <p className="text-sm">罫線の直後から内容が始まります。</p>
    </div>
  );
}

function LinkMarker() {
  return (
    <Marker>
      <MarkerContent>
        詳しい条件は<Link href="/terms">利用条件</Link>を確認してください。
      </MarkerContent>
    </Marker>
  );
}

function WrappingMarker() {
  return (
    <Marker variant={MARKER_VARIANT.SEPARATOR}>
      <MarkerContent>
        一行に収まらない長さの注釈は、区切り線の間で折り返して中央に配置されます。
      </MarkerContent>
    </Marker>
  );
}

function HeadingMarker() {
  return (
    <Marker asChild variant={MARKER_VARIANT.BORDER}>
      <h3>
        <MarkerContent>区切りに見出しの意味を持たせる場合</MarkerContent>
      </h3>
    </Marker>
  );
}

const meta = {
  title: "Display/Marker",
  component: Marker,
  parameters: { layout: "centered" },
  decorators: [
    (Story) => (
      <div className="w-[32rem] max-w-[calc(100vw-2rem)]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Marker>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 区切り線を持たない既定の注釈行。 */
export const Default: Story = { render: () => <MetaMarker /> };

/** 先頭に装飾アイコンを添える場合。意味はテキスト側に置く。 */
export const WithIcon: Story = { render: () => <IconMarker /> };

/** 内容の左右へ水平線を伸ばし、区切りの見出しとして中央に置く場合。 */
export const Separator: Story = { render: () => <SeparatorInContext /> };

/** 下に罫線を引き、直後の内容の始まりを示す場合。 */
export const Border: Story = { render: () => <BorderInContext /> };

/** 本文に link を含む場合。下線と hover の表現が付く。 */
export const WithLink: Story = { render: () => <LinkMarker /> };

/** 一行に収まらない注釈の折り返し。 */
export const Wrapping: Story = { render: () => <WrappingMarker /> };

/** `asChild` で見出し要素へ合成し、区切りに意味論を与える場合。 */
export const AsHeading: Story = { render: () => <HeadingMarker /> };
