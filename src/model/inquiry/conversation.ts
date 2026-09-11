import { formatDate } from "../datetime";
import type { InquiryMessage } from "./inquiry";

/** 日付で区切った、その日のやり取り。 */
export type ConversationDay = {
  /** 区切りに出す日付。同じ日かどうかの判定にも使う。 */
  readonly day: string;
  readonly messages: readonly InquiryMessage[];
};

/**
 * 正本のメッセージと、購読で届いたメッセージを 1 本の並びに畳む。
 *
 * @remarks
 * **同じ識別子は 1 件に畳みます。** 追記しかされないため、同じ識別子が別の内容を持つことは
 * なく、どちらを残しても結果は変わりません。
 *
 * 並べ直すのは位置の昇順です。届いた順は保証されないため、受け取った順のまま並べると、
 * 遅れて届いた発言が最後に付きます。
 */
export function mergeMessages(
  base: readonly InquiryMessage[],
  appended: readonly InquiryMessage[],
): readonly InquiryMessage[] {
  const byId = new Map<string, InquiryMessage>();

  for (const message of [...base, ...appended]) {
    byId.set(message.id, message);
  }

  return [...byId.values()].sort((left, right) => left.sequence - right.sequence);
}

/**
 * 正本に入ったぶんを、購読で受け取った控えから落とす。
 *
 * @remarks
 * 取り直した正本は、その時点の位置までを含みます。同じものを控えにも持ち続けると、次の
 * 取り直しまで畳み込みが効き続け、控えが際限なく伸びます。
 */
export function pruneApplied(
  appended: readonly InquiryMessage[],
  streamCursor: number,
): readonly InquiryMessage[] {
  return appended.filter((message) => message.sequence > streamCursor);
}

/**
 * 並びを日付で区切る。
 *
 * @remarks
 * 区切りの判定に整形済みの日付を使うのは、表示するタイムゾーンで丸めた値がそれだからです。
 * `Date` のまま比べると、丸める側と表示する側で別々にタイムゾーンを扱うことになります。
 */
export function toConversationDays(
  messages: readonly InquiryMessage[],
): readonly ConversationDay[] {
  const days: ConversationDay[] = [];

  for (const message of messages) {
    const day = formatDate(message.createdAt);
    const current = days.at(-1);

    if (current === undefined || current.day !== day) {
      days.push({ day, messages: [message] });
    } else {
      days[days.length - 1] = { day, messages: [...current.messages, message] };
    }
  }

  return days;
}
