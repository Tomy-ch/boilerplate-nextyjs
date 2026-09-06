import type { ComponentProps, MouseEvent, ReactNode } from "react";
import { FeedbackState } from "@/components/app-starter/feedback-state/feedback-state";
import { FEEDBACK_STATE_KIND } from "@/components/app-starter/feedback-state/feedback-state.definition";
import { cn } from "@/components/cn";
import { Button } from "@/components/design-system/action/button/button";
import { BUTTON_VARIANT } from "@/components/design-system/action/button/button.definition";
import { Badge } from "@/components/design-system/display/badge/badge";
import { BADGE_VARIANT } from "@/components/design-system/display/badge/badge.definition";
import { List, ListItem, ListItemMedia } from "@/components/design-system/display/list/list";
import { BellIcon } from "@/components/icon";

/** {@link NotificationTrigger} の props。 */
export type NotificationTriggerProps = Omit<ComponentProps<typeof Button>, "asChild"> & {
  /** 未読の件数。0 のときは数を出さない。 */
  unreadCount?: number;
  /** 操作の名前の基。既定は「通知」。 */
  label?: string;
};

/**
 * 通知の一覧を開く操作。
 *
 * @remarks
 * 名前に未読の件数を含める。icon と数字だけでは、支援技術から「何の数か」が分からない。
 *
 * 件数は live region にしない。背景で増えるたびに読み上げると、他の操作の最中に割り込む。件数の
 * 変化を伝えるのは、一覧を開いている間だけでよい（{@link NotificationPanel} が担う）。
 *
 * `Popover` や `Sheet` の trigger へ `asChild` で渡す。開いた先の器はこの部品が持たない。
 *
 * @param props.unreadCount - 未読の件数。
 *
 * @see Storybook `Status/NotificationCenter`
 */
export function NotificationTrigger({
  unreadCount = 0,
  label = "通知",
  variant = BUTTON_VARIANT.GHOST,
  ...props
}: NotificationTriggerProps) {
  const name = unreadCount === 0 ? label : `${label} 未読 ${unreadCount} 件`;

  return (
    <Button aria-label={name} data-slot="notification-trigger" variant={variant} {...props}>
      <BellIcon aria-hidden="true" />
      {unreadCount === 0 ? null : (
        <Badge aria-hidden="true" variant={BADGE_VARIANT.DESTRUCTIVE}>
          {unreadCount}
        </Badge>
      )}
    </Button>
  );
}

/** {@link NotificationPanel} の props。 */
export type NotificationPanelProps = ComponentProps<"div"> & {
  /** 未読の件数。 */
  unreadCount: number;
  /** すべてを既読にする操作。渡すと操作を表示する。 */
  onMarkAllRead?: () => void;
  /** すべて既読にする操作の文言。 */
  markAllReadLabel?: string;
  /** 通知の一覧、または通知が無いことの表示。 */
  children?: ReactNode;
};

/**
 * 未読の件数と、すべて既読にする操作をまとめる領域。
 *
 * @remarks
 * 件数は開いている間だけ `aria-live` で伝える。既読にした結果が一覧の見た目にしか出ないと、画面を
 * 見ていない利用者には何件残ったか分からない。
 *
 * すべて既読にすると、その操作自身が押せなくなる。押した focus がそこへ残ると行き場を失うため、
 * 実行の直前に focus を一覧へ移す。
 *
 * 既読の記録、配信、通知種別の意味は持たない。件数と操作を呼び出し元が渡す。
 *
 * @param props.unreadCount - 未読の件数。
 * @param props.onMarkAllRead - すべてを既読にする操作。
 *
 * @see Storybook `Status/NotificationCenter`
 */
export function NotificationPanel({
  className,
  unreadCount,
  onMarkAllRead,
  markAllReadLabel = "すべて既読にする",
  children,
  ...props
}: NotificationPanelProps) {
  return (
    <div className={cn("flex flex-col gap-3", className)} data-slot="notification-panel" {...props}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p
          aria-live="polite"
          className="text-muted-foreground text-sm"
          data-slot="notification-count"
        >
          {unreadCount === 0 ? "未読はありません" : `未読 ${unreadCount} 件`}
        </p>
        {onMarkAllRead === undefined ? null : (
          <Button
            disabled={unreadCount === 0}
            onClick={onMarkAllRead}
            onClickCapture={focusNotificationList}
            size="sm"
            type="button"
            variant={BUTTON_VARIANT.GHOST}
          >
            {markAllReadLabel}
          </Button>
        )}
      </div>
      {children}
    </div>
  );
}

/**
 * すべて既読にする直前に、focus を一覧へ移す。
 *
 * 捕捉段階で受け取るのは、呼び出し元の処理でこの操作が押せなくなるより先に focus を動かすためで
 * ある。移さないと focus が document へ落ち、keyboard 利用者は通知へ辿り直すことになる。
 */
function focusNotificationList(event: MouseEvent<HTMLButtonElement>) {
  const panel = event.currentTarget.closest("[data-slot='notification-panel']");
  const list = panel?.querySelector("[data-slot='notification-list']");

  if (list instanceof HTMLElement) list.focus();
}

/** {@link NotificationList} の props。 */
export type NotificationListProps = ComponentProps<"ul"> & {
  /** 一覧の名前。 */
  label?: string;
};

/**
 * 通知を新しい順に並べる一覧。
 *
 * @remarks
 * 件数が増えるため高さを抑え、内側だけを scroll させる。開いた面がページごと伸びると、通知を読む
 * ために画面全体が動く。
 *
 * `tabIndex={0}` は二つを兼ねる。内側だけが scroll するため keyboard だけで送れる必要があり、
 * 同時に、すべて既読にしたあとの focus の受け皿にもなる。輪は `focus-visible` のときだけ描く。
 * pointer で操作したあとに focus を移す場合は、押した場所と無関係な枠が現れることになるためで、
 * 行き先は要素の名前が伝える。
 *
 * @param props.label - 一覧の名前。
 *
 * @see Storybook `Status/NotificationCenter`
 */
export function NotificationList({
  className,
  label = "通知の一覧",
  ...props
}: NotificationListProps) {
  return (
    <List asChild>
      <ul
        aria-label={label}
        className={cn(
          "max-h-80 gap-0 overflow-y-auto focus-visible:outline-2 focus-visible:outline-active focus-visible:shadow-glow-primary focus-visible:-outline-offset-2",
          className,
        )}
        data-slot="notification-list"
        // biome-ignore lint/a11y/noNoninteractiveTabindex: スクロール可能な領域は非対話でも focus 可能にする必要がある。外すと keyboard だけではスクロールできず WCAG 2.1.1 に反する
        tabIndex={0}
        {...props}
      />
    </List>
  );
}

/** {@link NotificationItem} の props。 */
export type NotificationItemProps = Omit<ComponentProps<"li">, "size"> & {
  /** まだ読んでいないか。 */
  unread?: boolean;
  /** 未読であることを読み上げへ伝える語。 */
  unreadLabel?: string;
  /** 通知の内容。 */
  children?: ReactNode;
};

/**
 * 通知 1 件。
 *
 * @remarks
 * 未読は点だけでなく読み上げ専用の語でも示す。色と印だけでは、その区別が支援技術へ伝わらない。
 *
 * 詳細への遷移は持たない。`ListItemLink` を内容として渡すか、内容の中へ link を置く。遷移先を
 * 決めるのは呼び出し元である。
 *
 * @param props.unread - まだ読んでいないか。
 *
 * @see Storybook `Status/NotificationCenter`
 */
export function NotificationItem({
  className,
  unread = false,
  unreadLabel = "未読",
  children,
  ...props
}: NotificationItemProps) {
  return (
    <ListItem
      className={cn("items-start", className)}
      data-slot="notification-item"
      data-unread={unread}
      {...props}
    >
      <ListItemMedia
        className="mt-1 size-2 shrink-0 rounded-full bg-transparent data-[unread=true]:bg-destructive"
        data-slot="notification-item-marker"
        data-unread={unread}
      >
        {unread ? <span className="sr-only">{unreadLabel}</span> : null}
      </ListItemMedia>
      {children}
    </ListItem>
  );
}

/** {@link NotificationEmpty} の props。 */
export type NotificationEmptyProps = {
  /** 通知が無いことを示す見出し。 */
  title?: string;
  /** 見出しを補う説明。 */
  description?: string;
};

/**
 * 通知が 1 件も無い状態。
 *
 * @remarks
 * 一覧ごと消さずに、無いことを示す。空白のままだと、読み込みに失敗したのか本当に無いのかが
 * 区別できない。
 *
 * @see Storybook `Status/NotificationCenter`
 */
export function NotificationEmpty({
  title = "通知はありません",
  description,
}: NotificationEmptyProps) {
  return <FeedbackState description={description} kind={FEEDBACK_STATE_KIND.EMPTY} title={title} />;
}
