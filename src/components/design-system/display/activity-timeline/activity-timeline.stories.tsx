import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { ReactNode } from "react";

import {
  ListItemContent,
  ListItemDescription,
  ListItemTitle,
} from "@/components/design-system/display/list/list";
import { CoinIcon, PencilIcon, PlusIcon, UploadIcon } from "@/components/icon";
import { ActivityTimeline, ActivityTimelineItem, ActivityTimelineTime } from "./activity-timeline";

const meta = {
  title: "Display/ActivityTimeline",
  component: ActivityTimeline,
  parameters: { layout: "padded" },
  args: { label: "変更履歴" },
} satisfies Meta<typeof ActivityTimeline>;
export default meta;
type Story = StoryObj<typeof meta>;

type Event = {
  id: string;
  title: string;
  description?: string;
  at: string;
  display: string;
  marker?: ReactNode;
};

const EVENTS: readonly Event[] = [
  {
    id: "4",
    title: "田中 が 状態を「公開中」に変更しました",
    at: "2026-08-04T09:12:00+09:00",
    display: "2026-08-04 09:12",
    marker: <PencilIcon aria-hidden="true" />,
  },
  {
    id: "3",
    title: "佐藤 が 月額を ¥1,200 に変更しました",
    description: "変更前は ¥980 でした。",
    at: "2026-08-03T18:40:00+09:00",
    display: "2026-08-03 18:40",
    marker: <CoinIcon aria-hidden="true" />,
  },
  {
    id: "2",
    title: "佐藤 が 画像を差し替えました",
    at: "2026-08-02T11:20:00+09:00",
    display: "2026-08-02 11:20",
    marker: <UploadIcon aria-hidden="true" />,
  },
  {
    id: "1",
    title: "鈴木 が プランを作成しました",
    at: "2026-08-01T10:05:00+09:00",
    display: "2026-08-01 10:05",
    marker: <PlusIcon aria-hidden="true" />,
  },
];

function Events({ events }: { events: readonly Event[] }) {
  return (
    <>
      {events.map((event) => (
        <ActivityTimelineItem key={event.id} marker={event.marker}>
          <ListItemContent>
            <ListItemTitle>{event.title}</ListItemTitle>
            {event.description === undefined ? null : (
              <ListItemDescription>{event.description}</ListItemDescription>
            )}
            <ActivityTimelineTime dateTime={event.at}>{event.display}</ActivityTimelineTime>
          </ListItemContent>
        </ActivityTimelineItem>
      ))}
    </>
  );
}

/** 新しい順に並べた履歴。誰が何をしたかは文言が伝え、印は装飾に留まる。 */
export const Default: Story = {
  render: (args) => (
    <ActivityTimeline {...args}>
      <Events events={EVENTS} />
    </ActivityTimeline>
  ),
};

/** 印を渡さない場合。行の頭は揃ったまま、内容だけが並ぶ。 */
export const WithoutMarker: Story = {
  render: (args) => (
    <ActivityTimeline {...args}>
      <Events events={EVENTS.map((event) => ({ ...event, marker: undefined }))} />
    </ActivityTimeline>
  ),
};

/** 1 件だけの履歴。作成直後の状態。 */
export const SingleEvent: Story = {
  render: (args) => (
    <ActivityTimeline {...args}>
      <Events events={EVENTS.slice(-1)} />
    </ActivityTimeline>
  ),
};

/**
 * 続きの読み込み。件数が増え続けるため送りの導線を伴うが、この部品は持たない。隣へ並べる
 * のは呼び出し元の仕事で、URL の組み立ても呼び出し元が行う。
 */
export const WithPagination: Story = {
  render: (args) => (
    <div className="flex flex-col gap-4">
      <ActivityTimeline {...args}>
        <Events events={EVENTS} />
      </ActivityTimeline>
      <nav aria-label="変更履歴の移動">
        <a className="text-sm underline" href="#next">
          古い変更を読み込む
        </a>
      </nav>
    </div>
  ),
};

/**
 * 古い順に並べた場合。並び順はこの部品が決めず、渡された順にそのまま並べる。
 */
export const Ascending: Story = {
  render: (args) => (
    <ActivityTimeline {...args}>
      <Events events={[...EVENTS].reverse()} />
    </ActivityTimeline>
  ),
};
