import { describe, expect, it } from "vitest";
import { safeParse } from "zod/v4/core";

import {
  inquiryConversationEventSchema,
  inquiryFeedEventSchema,
  toInquiryMessage,
  toUpdatedInquiryId,
} from "./inquiries";

const MESSAGE_EVENT = {
  eventId: "123e4567-e89b-12d3-a456-426614174000",
  streamId: "0198a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a60",
  sequence: "1",
  type: "inquiry.message.created.v1",
  occurredAt: "2026-09-11T18:31:04.038834Z",
  schemaVersion: 1,
  payload: {
    messageId: "0198a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a01",
    inquiryId: "0198a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a60",
    author: { kind: "user" },
    body: "注文した商品がまだ届きません。",
    sequence: 1,
    createdAt: "2026-09-12T03:31:04.038834+09:00",
  },
};

const FEED_EVENT = {
  ...MESSAGE_EVENT,
  streamId: "inquiry-feed",
  type: "inquiry.thread.updated.v1",
  payload: {
    inquiryId: "0198a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a60",
    userId: "550e8400-e29b-41d4-a716-446655440000",
    sequence: 1,
    updatedAt: "2026-09-12T03:31:04.043410674+09:00",
  },
};

describe("inquiryConversationEventSchema", () => {
  // ----- 正常系 -----
  it("会話の event を通す", () => {
    expect(safeParse(inquiryConversationEventSchema, MESSAGE_EVENT).success).toBe(true);
  });

  it("オフセット付きの時刻を落とさない", () => {
    const parsed = safeParse(inquiryConversationEventSchema, MESSAGE_EVENT);

    expect(parsed.success && parsed.data.payload.createdAt).toBe(MESSAGE_EVENT.payload.createdAt);
  });

  // ----- 異常系 -----
  it("契約に無い種別を落とす", () => {
    const event = { ...MESSAGE_EVENT, type: "inquiry.message.updated.v1" };

    expect(safeParse(inquiryConversationEventSchema, event).success).toBe(false);
  });

  it("送り手の種別が契約の外なら落とす", () => {
    const event = {
      ...MESSAGE_EVENT,
      payload: { ...MESSAGE_EVENT.payload, author: { kind: "system" } },
    };

    expect(safeParse(inquiryConversationEventSchema, event).success).toBe(false);
  });

  it("位置が数値でなければ落とす", () => {
    const event = { ...MESSAGE_EVENT, payload: { ...MESSAGE_EVENT.payload, sequence: "1" } };

    expect(safeParse(inquiryConversationEventSchema, event).success).toBe(false);
  });
});

describe("toInquiryMessage", () => {
  it("届いた event を、取得した履歴と同じ形へ写す", () => {
    const parsed = safeParse(inquiryConversationEventSchema, MESSAGE_EVENT);

    expect(parsed.success && toInquiryMessage(parsed.data)).toEqual({
      id: MESSAGE_EVENT.payload.messageId,
      authorKind: "user",
      body: MESSAGE_EVENT.payload.body,
      sequence: 1,
      createdAt: new Date(MESSAGE_EVENT.payload.createdAt),
    });
  });
});

describe("inquiryFeedEventSchema", () => {
  // ----- 正常系 -----
  it("フィードの event を通す", () => {
    expect(safeParse(inquiryFeedEventSchema, FEED_EVENT).success).toBe(true);
  });

  // ----- 異常系 -----
  it("会話の event をフィードとして読まない", () => {
    expect(safeParse(inquiryFeedEventSchema, MESSAGE_EVENT).success).toBe(false);
  });
});

describe("toUpdatedInquiryId", () => {
  it("更新のあった問い合わせを返す", () => {
    const parsed = safeParse(inquiryFeedEventSchema, FEED_EVENT);

    expect(parsed.success && toUpdatedInquiryId(parsed.data)).toBe(FEED_EVENT.payload.inquiryId);
  });
});
