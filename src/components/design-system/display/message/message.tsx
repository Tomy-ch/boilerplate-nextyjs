import type { ComponentProps } from "react";

import { cn } from "@/components/cn";

import { MESSAGE_ALIGN, type MessageAlign } from "./message.definition";

/**
 * 続けて表示するメッセージをひとまとまりとして縦に並べる領域。
 *
 * @remarks
 * 同じ送信者の連続した発言や、同じ時間帯にまとまる通知を一つの塊として見せるための間隔だけを
 * 持つ。どこで塊を切るか、どの順に並べるかは呼び出し元が決める。
 *
 * この component 自身は role を持たない。会話や通知の一覧であることを支援技術へ伝える必要が
 * ある場合は、呼び出し元が `role` とアクセシブルな名前を与える。
 *
 *
 * @see Storybook `Display/Message`
 */
function MessageGroup({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("flex min-w-0 flex-col gap-2", className)}
      data-slot="message-group"
      {...props}
    />
  );
}

/**
 * 送信者と本文を持つ 1 件のメッセージ。
 *
 * @remarks
 * `MessageAvatar` と `MessageContent` を横に並べる表示専用の Server Component であり、
 * hydration を必要としない。送信・受信・既読といった状態の判定、日時の整形、本文の
 * sanitize はいずれも持たない。整形済みの内容を子として受け取る。
 *
 * `align` は avatar と本文の左右を入れ替えるだけの視覚的な区別であり、意味論を持たない。
 * 支援技術は向きを読み上げないため、誰の発言かは `MessageHeader` のテキストとして必ず示す。
 *
 * 吹き出しの面は持たない。本文の背景や角丸が必要な場合は `MessageContent` の子として
 * 呼び出し元が組む。
 *
 * @example
 * ```tsx
 * <Message align={MESSAGE_ALIGN.END}>
 *   <MessageContent>
 *     <MessageHeader>自分 12:04</MessageHeader>
 *     <p>本文</p>
 *   </MessageContent>
 * </Message>
 * ```
 *
 * @param props - native `div` 属性と、以下の表示用 props。
 * @param props.align - avatar と本文を寄せる向き。{@link MESSAGE_ALIGN} のいずれか。
 *
 * @see Storybook `Display/Message`
 */
function Message({
  className,
  align = MESSAGE_ALIGN.START,
  ...props
}: ComponentProps<"div"> & { align?: MessageAlign }) {
  return (
    <div
      className={cn(
        "group/message relative flex w-full min-w-0 gap-2 text-sm data-[align=end]:flex-row-reverse",
        className,
      )}
      data-align={align}
      data-slot="message"
      {...props}
    />
  );
}

/**
 * 送信者を示す円形の枠。
 *
 * @remarks
 * 枠と背景だけを持ち、中身は呼び出し元が置く。読み込み結果で代替表示へ切り替える必要がある
 * 場合は `Avatar` を、単なる画像表示でよい場合は `MediaImage` を子にする。頭文字などの
 * テキストをそのまま置いてもよい。
 *
 * 隣に送信者名を表示している場合、avatar は装飾であり、画像の `alt` は空にする。avatar だけで
 * 送信者を特定させる設計にしない。
 *
 * `MessageFooter` を持つメッセージでは、本文の高さに合わせて上へずらす。
 *
 *
 * @see Storybook `Display/Message`
 */
function MessageAvatar({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex w-fit min-w-8 shrink-0 items-center justify-center self-end overflow-hidden rounded-full bg-muted group-has-data-[slot=message-footer]/message:-translate-y-8",
        className,
      )}
      data-slot="message-avatar"
      {...props}
    />
  );
}

/**
 * 本文と、その前後に置く補助情報を縦に並べる領域。
 *
 * @remarks
 * `align="end"` のメッセージでは、`data-slot` を持つ直下の子を右端へ寄せる。素の要素を本文に
 * 置く場合はこの規則が働かないため、呼び出し元が幅を内容に合わせたうえで右端へ寄せる。
 *
 * 本文そのものの組版は持たないため、段落や強調は呼び出し元が組む。sanitize 済みの
 * Markdown / HTML を表示する場合は `Typeset` を併用する。
 *
 *
 * @see Storybook `Display/Message`
 */
function MessageContent({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex w-full min-w-0 flex-col gap-2.5 wrap-break-word group-data-[align=end]/message:*:data-slot:self-end",
        className,
      )}
      data-slot="message-content"
      {...props}
    />
  );
}

/**
 * 本文の前に置く、送信者名や時刻などの補助情報。
 *
 * @remarks
 * 誰の発言かを支援技術へ伝える唯一の経路であるため、`align` で向きを分けるメッセージには
 * 送信者が分かる文言を置く。日時は整形済みの文字列として受け取る。
 *
 *
 * @see Storybook `Display/Message`
 */
function MessageHeader({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex max-w-full min-w-0 items-center px-3 text-xs font-emphasis text-muted-foreground group-has-data-[variant=ghost]/message:px-0",
        className,
      )}
      data-slot="message-header"
      {...props}
    />
  );
}

/**
 * 本文の後ろに置く、送信状態や補助操作などの情報。
 *
 * @remarks
 * `align` に追従して左右へ寄る。操作を置く場合、その実行内容と結果の通知は呼び出し元が持つ。
 * 送信中や失敗のように利用者の対応が要る状態は、この位置の文言だけに頼らず feature 側で
 * `Alert` などの通知と組み合わせる。
 *
 *
 * @see Storybook `Display/Message`
 */
function MessageFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex max-w-full min-w-0 items-center px-3 text-xs font-emphasis text-muted-foreground group-has-data-[variant=ghost]/message:px-0 group-data-[align=end]/message:justify-end",
        className,
      )}
      data-slot="message-footer"
      {...props}
    />
  );
}

export { Message, MessageAvatar, MessageContent, MessageFooter, MessageGroup, MessageHeader };
