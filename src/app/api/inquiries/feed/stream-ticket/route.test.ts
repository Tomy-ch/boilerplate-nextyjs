import { beforeEach, describe, expect, it, vi } from "vitest";

import type { issueInquiryFeedStreamConnection as issueType } from "@/adapters/server/api/inquiries-stream";
import { createAppError } from "@/errors/app-error";
import { ErrorKind } from "@/errors/error-kind";

const { issueInquiryFeedStreamConnection } = vi.hoisted(() => ({
  issueInquiryFeedStreamConnection: vi.fn<typeof issueType>(),
}));

vi.mock("@/adapters/server/api/inquiries-stream", () => ({ issueInquiryFeedStreamConnection }));

import { POST } from "./route";

const CONNECTION = {
  url: "https://api.example.test/v1/streams/inquiry-feed?ticket=raw",
  expiresAt: new Date("2026-09-01T12:39:56.000Z"),
};

beforeEach(() => {
  issueInquiryFeedStreamConnection.mockReset();
  issueInquiryFeedStreamConnection.mockResolvedValue(CONNECTION);
});

describe("POST", () => {
  // ----- 正常系 -----
  it("繋ぎ先と期限を JSON で返す", async () => {
    const response = await POST();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      url: CONNECTION.url,
      expiresAt: CONNECTION.expiresAt.toISOString(),
    });
  });

  // ----- 異常系 -----
  it("役割が足りない発券を 403 で返す", async () => {
    issueInquiryFeedStreamConnection.mockRejectedValue(createAppError(ErrorKind.PERMISSION_DENIED));

    expect((await POST()).status).toBe(403);
  });

  it("session が切れた発券を 401 で返す", async () => {
    issueInquiryFeedStreamConnection.mockRejectedValue(createAppError(ErrorKind.UNAUTHENTICATED));

    expect((await POST()).status).toBe(401);
  });

  it("分類の付いていない失敗を 500 へ矯正する", async () => {
    issueInquiryFeedStreamConnection.mockRejectedValue(new Error("unexpected"));

    expect((await POST()).status).toBe(500);
  });
});
