import { beforeEach, describe, expect, it, vi } from "vitest";

import type { issueMyInquiryStreamConnection as issueType } from "@/adapters/server/api/inquiries-stream";
import { createAppError } from "@/errors/app-error";
import { ErrorKind } from "@/errors/error-kind";

const { issueMyInquiryStreamConnection } = vi.hoisted(() => ({
  issueMyInquiryStreamConnection: vi.fn<typeof issueType>(),
}));

vi.mock("@/adapters/server/api/inquiries-stream", () => ({ issueMyInquiryStreamConnection }));

import { POST } from "./route";

const CONNECTION = {
  url: "https://api.example.test/v1/streams/s1?ticket=raw",
  expiresAt: new Date("2026-09-01T12:39:56.000Z"),
};

beforeEach(() => {
  issueMyInquiryStreamConnection.mockReset();
  issueMyInquiryStreamConnection.mockResolvedValue(CONNECTION);
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
  it("session が切れた発券を 401 で返す", async () => {
    issueMyInquiryStreamConnection.mockRejectedValue(createAppError(ErrorKind.UNAUTHENTICATED));

    expect((await POST()).status).toBe(401);
  });

  it("購読する対象が無い主体へ 404 を返す", async () => {
    issueMyInquiryStreamConnection.mockRejectedValue(createAppError(ErrorKind.NOT_FOUND));

    expect((await POST()).status).toBe(404);
  });

  it("分類の付いていない失敗を 500 へ矯正する", async () => {
    issueMyInquiryStreamConnection.mockRejectedValue(new Error("unexpected"));

    expect((await POST()).status).toBe(500);
  });
});
