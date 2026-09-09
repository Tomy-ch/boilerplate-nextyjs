import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useCallback, useState } from "react";

import {
  ListItemContent,
  ListItemDescription,
  ListItemTitle,
} from "@/components/design-system/display/list/list";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/design-system/overlay/popover/popover";
import {
  NotificationEmpty,
  NotificationItem,
  NotificationList,
  NotificationPanel,
  NotificationTrigger,
} from "./notification-center";

const meta = {
  title: "Status/NotificationCenter",
  component: NotificationPanel,
  parameters: { layout: "centered" },
  args: { unreadCount: 2 },
} satisfies Meta<typeof NotificationPanel>;
export default meta;
type Story = StoryObj<typeof meta>;

type Notification = { id: string; title: string; description: string; unread: boolean };

const NOTIFICATIONS: readonly Notification[] = [
  {
    id: "3",
    title: "申請が承認されました",
    description: "利用申請 #1042 が承認されました。",
    unread: true,
  },
  {
    id: "2",
    title: "使用量が上限に近づいています",
    description: "今月の使用量が上限の 80% に達しました。",
    unread: true,
  },
  {
    id: "1",
    title: "月次レポートが生成されました",
    description: "2026 年 7 月分のレポートを確認できます。",
    unread: false,
  },
];

function Items({ notifications }: { notifications: readonly Notification[] }) {
  return (
    <>
      {notifications.map((notification) => (
        <NotificationItem key={notification.id} unread={notification.unread}>
          <ListItemContent>
            <ListItemTitle>{notification.title}</ListItemTitle>
            <ListItemDescription>{notification.description}</ListItemDescription>
          </ListItemContent>
        </NotificationItem>
      ))}
    </>
  );
}

/** 未読がある状態。件数は開いている間だけ live region で伝える。 */
export const Default: Story = {
  render: (args) => (
    <div className="w-80">
      <NotificationPanel {...args}>
        <NotificationList>
          <Items notifications={NOTIFICATIONS} />
        </NotificationList>
      </NotificationPanel>
    </div>
  ),
};

/** 通知が 1 件も無い状態。一覧ごと消さずに、無いことを示す。 */
export const Empty: Story = {
  args: { unreadCount: 0 },
  render: (args) => (
    <div className="w-80">
      <NotificationPanel {...args}>
        <NotificationEmpty description="新しい通知はここに並びます。" />
      </NotificationPanel>
    </div>
  ),
};

/** 件数が多い場合。一覧の内側だけが scroll し、開いた面はページごと伸びない。 */
export const ManyNotifications: Story = {
  args: { unreadCount: 8 },
  render: (args) => (
    <div className="w-80">
      <NotificationPanel {...args}>
        <NotificationList>
          <Items
            notifications={Array.from({ length: 4 }, () => NOTIFICATIONS)
              .flat()
              .map((notification, index) => ({
                ...notification,
                id: `n-${index}`,
                unread: index < 8,
              }))}
          />
        </NotificationList>
      </NotificationPanel>
    </div>
  ),
};

function NotificationCenterFixture() {
  const [notifications, setNotifications] = useState(NOTIFICATIONS);
  const markAllRead = useCallback(
    () => setNotifications((current) => current.map((item) => ({ ...item, unread: false }))),
    [],
  );
  const unreadCount = notifications.filter((item) => item.unread).length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <NotificationTrigger unreadCount={unreadCount} />
      </PopoverTrigger>
      <PopoverContent aria-label="通知" className="w-80">
        <NotificationPanel onMarkAllRead={markAllRead} unreadCount={unreadCount}>
          <NotificationList>
            <Items notifications={notifications} />
          </NotificationList>
        </NotificationPanel>
      </PopoverContent>
    </Popover>
  );
}

/**
 * 実際の合成。開く器は呼び出し元が組み立てる。すべて既読にすると操作が押せなくなるため、実行の
 * 直前に focus を一覧へ移す。
 */
export const InPopover: Story = {
  render: () => <NotificationCenterFixture />,
};
