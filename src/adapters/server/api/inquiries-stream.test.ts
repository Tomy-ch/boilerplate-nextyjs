import { beforeEach, describe, expect, it, vi } from "vitest";

import { PARSED_ENVIRONMENT } from "@/config/environment.fixture";
import { findAppError } from "@/errors/app-error";
import { ErrorKind } from "@/errors/error-kind";

import { serveStatus, serveWrite } from "../../../../vitest.setup.msw";

const { getAccessToken, getEnvironment } = vi.hoisted(() => ({
  getAccessToken: vi.fn(async (): Promise<string | null> => null),
  getEnvironment: vi.fn(() => PARSED_ENVIRONMENT),
}));

vi.mock("@/config/environment", () => ({ getEnvironment }));
vi.mock("../auth/session", () => ({ getAccessToken }));

import {
  issueInquiryFeedStreamConnection,
  issueMyInquiryStreamConnection,
} from "./inquiries-stream";

const TOKEN = "test-access-token";

const MY_TICKET_URL = `${PARSED_ENVIRONMENT.APP_API_BASE_URL}/v1/inquiries/me/stream-ticket`;

const FEED_TICKET_URL = `${PARSED_ENVIRONMENT.APP_API_BASE_URL}/v1/inquiries/feed/stream-ticket`;

const wireTicket = {
  ticket: "test-stream-ticket",
  streamId: "0198a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a60",
  expiresAt: "2026-09-01T12:39:56Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  getAccessToken.mockResolvedValue(TOKEN);
});

describe("issueMyInquiryStreamConnection", () => {
  // ----- 正常系 -----
  it("ticket を組み込んだ、そのまま開ける URL を返す", async () => {
    serveWrite("post", MY_TICKET_URL, wireTicket);

    const connection = await issueMyInquiryStreamConnection();
    const url = new URL(connection.url);

    expect(url.origin).toBe(new URL(PARSED_ENVIRONMENT.APP_API_BASE_URL).origin);
    expect(url.pathname).toBe(`/v1/streams/${wireTicket.streamId}`);
    expect(url.searchParams.get("ticket")).toBe(wireTicket.ticket);
  });

  it("新しい接続を始められる期限を返す", async () => {
    serveWrite("post", MY_TICKET_URL, wireTicket);

    await expect(issueMyInquiryStreamConnection()).resolves.toMatchObject({
      expiresAt: new Date(wireTicket.expiresAt),
    });
  });

  it("発券は POST で行う", async () => {
    const requests = serveWrite("post", MY_TICKET_URL, wireTicket);

    await issueMyInquiryStreamConnection();

    expect(requests[0]?.method).toBe("POST");
  });

  // ----- 異常系 -----
  it("購読する対象を持たない主体を not-found として返す", async () => {
    serveStatus("post", MY_TICKET_URL, 404);

    await expect(
      issueMyInquiryStreamConnection().catch((error) => findAppError(error)?.kind),
    ).resolves.toBe(ErrorKind.NOT_FOUND);
  });

  it("session が切れた発券を unauthenticated として返す", async () => {
    serveStatus("post", MY_TICKET_URL, 401);

    await expect(
      issueMyInquiryStreamConnection().catch((error) => findAppError(error)?.kind),
    ).resolves.toBe(ErrorKind.UNAUTHENTICATED);
  });
});

describe("issueInquiryFeedStreamConnection", () => {
  // ----- 正常系 -----
  it("フィードの口を発券する", async () => {
    serveWrite("post", FEED_TICKET_URL, { ...wireTicket, streamId: "inquiry-feed" });

    const connection = await issueInquiryFeedStreamConnection();

    expect(new URL(connection.url).pathname).toBe("/v1/streams/inquiry-feed");
  });

  // ----- 異常系 -----
  it("役割が足りない発券を permission-denied として返す", async () => {
    serveStatus("post", FEED_TICKET_URL, 403);

    await expect(
      issueInquiryFeedStreamConnection().catch((error) => findAppError(error)?.kind),
    ).resolves.toBe(ErrorKind.PERMISSION_DENIED);
  });
});
