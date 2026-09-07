// @vitest-environment jsdom

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { ListItemContent, ListItemTitle } from "@/components/design-system/display/list/list";
import {
  NotificationEmpty,
  NotificationItem,
  NotificationList,
  NotificationPanel,
  NotificationTrigger,
} from "./notification-center";

const NOTIFICATIONS = [
  { id: "3", title: "申請が承認されました", unread: true },
  { id: "2", title: "使用量が上限に近づいています", unread: true },
  { id: "1", title: "月次レポートが生成されました", unread: false },
];

function PanelFixture({
  unreadCount = 2,
  onMarkAllRead,
}: {
  unreadCount?: number;
  onMarkAllRead?: () => void;
} = {}) {
  return (
    <NotificationPanel onMarkAllRead={onMarkAllRead} unreadCount={unreadCount}>
      <NotificationList>
        {NOTIFICATIONS.map((notification) => (
          <NotificationItem key={notification.id} unread={notification.unread}>
            <ListItemContent>
              <ListItemTitle>{notification.title}</ListItemTitle>
            </ListItemContent>
          </NotificationItem>
        ))}
      </NotificationList>
    </NotificationPanel>
  );
}

describe("NotificationTrigger", () => {
  it("未読の件数を操作の名前に含める", () => {
    render(<NotificationTrigger unreadCount={3} />);

    expect(screen.getByRole("button", { name: "通知 未読 3 件" })).toBeInTheDocument();
  });

  it("未読が無ければ数を出さない", () => {
    render(<NotificationTrigger />);

    expect(screen.getByRole("button", { name: "通知" })).toBeInTheDocument();
  });

  it("名前の基を呼び出し元が差し替えられる", () => {
    render(<NotificationTrigger label="お知らせ" unreadCount={1} />);

    expect(screen.getByRole("button", { name: "お知らせ 未読 1 件" })).toBeInTheDocument();
  });

  describe("NotificationCenter 全体", () => {
    it("a11y 自動検査に違反しない", async () => {
      const { container } = render(
        <div>
          <NotificationTrigger unreadCount={2} />
          <PanelFixture onMarkAllRead={vi.fn()} />
        </div>,
      );

      const result = await axe(container, { rules: { "color-contrast": { enabled: false } } });

      expect(result.violations).toEqual([]);
    });
  });
});

describe("NotificationPanel", () => {
  it("未読の件数を開いている間だけ伝える", () => {
    const { container } = render(<PanelFixture />);

    const count = container.querySelector("[data-slot='notification-count']");

    expect(count).toHaveTextContent("未読 2 件");
    expect(count).toHaveAttribute("aria-live", "polite");
  });

  it("未読が無いことも文言で示す", () => {
    render(<PanelFixture unreadCount={0} />);

    expect(screen.getByText("未読はありません")).toBeInTheDocument();
  });

  it("すべて既読にする操作を呼び出し元へ返す", async () => {
    const onMarkAllRead = vi.fn();
    render(<PanelFixture onMarkAllRead={onMarkAllRead} />);

    await userEvent.click(screen.getByRole("button", { name: "すべて既読にする" }));

    expect(onMarkAllRead).toHaveBeenCalledOnce();
  });

  it("すべて既読にすると focus が一覧へ移る", async () => {
    render(<PanelFixture onMarkAllRead={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: "すべて既読にする" }));

    expect(screen.getByRole("list", { name: "通知の一覧" })).toHaveFocus();
  });

  it("未読が無ければすべて既読にできない", () => {
    render(<PanelFixture onMarkAllRead={vi.fn()} unreadCount={0} />);

    expect(screen.getByRole("button", { name: "すべて既読にする" })).toBeDisabled();
  });

  it("操作を渡さなければ表示しない", () => {
    render(<PanelFixture />);

    expect(screen.queryByRole("button", { name: "すべて既読にする" })).not.toBeInTheDocument();
  });

  it("一覧の外に置いても押せる", async () => {
    const onMarkAllRead = vi.fn();
    render(<NotificationPanel onMarkAllRead={onMarkAllRead} unreadCount={1} />);

    await userEvent.click(screen.getByRole("button", { name: "すべて既読にする" }));

    expect(onMarkAllRead).toHaveBeenCalledOnce();
  });
});

describe("NotificationList", () => {
  it("名前のある一覧として通知を並べる", () => {
    render(<PanelFixture />);

    const list = screen.getByRole("list", { name: "通知の一覧" });

    expect(within(list).getAllByRole("listitem")).toHaveLength(3);
  });

  it("一覧の名前を呼び出し元が差し替えられる", () => {
    render(
      <NotificationList label="お知らせの一覧">
        <NotificationItem>
          <ListItemContent>
            <ListItemTitle>通知</ListItemTitle>
          </ListItemContent>
        </NotificationItem>
      </NotificationList>,
    );

    expect(screen.getByRole("list", { name: "お知らせの一覧" })).toBeInTheDocument();
  });
});

describe("NotificationItem", () => {
  it("未読を印だけでなく語でも示す", () => {
    render(<PanelFixture />);

    const unreadMarks = screen
      .getAllByRole("listitem")
      .map((item) => within(item).queryByText("未読") !== null);

    expect(unreadMarks).toEqual(NOTIFICATIONS.map((notification) => notification.unread));
  });

  it("未読の語を呼び出し元が差し替えられる", () => {
    render(
      <NotificationList>
        <NotificationItem unread unreadLabel="未確認">
          <ListItemContent>
            <ListItemTitle>通知</ListItemTitle>
          </ListItemContent>
        </NotificationItem>
      </NotificationList>,
    );

    expect(screen.getByText("未確認")).toBeInTheDocument();
  });
});

describe("NotificationEmpty", () => {
  it("通知が無いことを示す", () => {
    render(<NotificationEmpty />);

    expect(screen.getByText("通知はありません")).toBeInTheDocument();
  });

  it("文言を呼び出し元が差し替えられる", () => {
    render(<NotificationEmpty description="新しい通知はここに並びます。" title="お知らせなし" />);

    expect(screen.getByText("お知らせなし")).toBeInTheDocument();
    expect(screen.getByText("新しい通知はここに並びます。")).toBeInTheDocument();
  });
});
