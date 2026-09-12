import { describe, expect, it } from "vitest";

import { mergeMessages, pruneApplied, toConversationDays } from "./conversation";
import { INQUIRY_AUTHOR_KIND, type InquiryMessage } from "./inquiry";

function messageAt(sequence: number, createdAt: string, id = `m${sequence}`): InquiryMessage {
  return {
    id,
    authorKind: INQUIRY_AUTHOR_KIND.user,
    body: `本文 ${sequence}`,
    sequence,
    createdAt: new Date(createdAt),
  };
}

describe("mergeMessages", () => {
  it("正本と受信分を、位置の昇順で 1 本に畳む", () => {
    const merged = mergeMessages(
      [messageAt(1, "2026-09-01T01:00:00.000Z")],
      [messageAt(3, "2026-09-01T03:00:00.000Z"), messageAt(2, "2026-09-01T02:00:00.000Z")],
    );

    expect(merged.map((message) => message.sequence)).toEqual([1, 2, 3]);
  });

  it("同じ識別子を 1 件に畳む", () => {
    const merged = mergeMessages(
      [messageAt(1, "2026-09-01T01:00:00.000Z")],
      [messageAt(1, "2026-09-01T01:00:00.000Z")],
    );

    expect(merged).toHaveLength(1);
  });

  it("どちらも空なら空を返す", () => {
    expect(mergeMessages([], [])).toEqual([]);
  });
});

describe("pruneApplied", () => {
  it("正本に入った位置までを落とす", () => {
    const appended = [
      messageAt(2, "2026-09-01T02:00:00.000Z"),
      messageAt(3, "2026-09-01T03:00:00.000Z"),
    ];

    expect(pruneApplied(appended, 2).map((message) => message.sequence)).toEqual([3]);
  });

  it("正本がまだ追いついていなければ、何も落とさない", () => {
    const appended = [messageAt(5, "2026-09-01T05:00:00.000Z")];

    expect(pruneApplied(appended, 4)).toEqual(appended);
  });
});

describe("toConversationDays", () => {
  it("日付が変わる位置で区切る", () => {
    const days = toConversationDays([
      messageAt(1, "2026-09-01T01:00:00.000Z"),
      messageAt(2, "2026-09-01T02:00:00.000Z"),
      messageAt(3, "2026-09-02T02:00:00.000Z"),
    ]);

    expect(days.map((day) => day.messages.length)).toEqual([2, 1]);
  });

  it("表示するタイムゾーンで丸めた日付を、区切りの文言にする", () => {
    // UTC では 8/31 だが、表示するタイムゾーンでは 9/1 に当たる時刻。
    const days = toConversationDays([messageAt(1, "2026-08-31T15:30:00.000Z")]);

    expect(days).toHaveLength(1);
    expect(days[0]?.day).toBe("2026/09/01");
  });

  it("空の並びからは、区切りを作らない", () => {
    expect(toConversationDays([])).toEqual([]);
  });
});
