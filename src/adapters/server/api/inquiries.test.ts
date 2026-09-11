import { beforeEach, describe, expect, it, vi } from "vitest";

import { PARSED_ENVIRONMENT } from "@/config/environment.fixture";
import { findAppError } from "@/errors/app-error";
import { ErrorKind } from "@/errors/error-kind";

import { serveJson, serveStatus, serveWrite } from "../../../../vitest.setup.msw";

const { getAccessToken, getEnvironment } = vi.hoisted(() => ({
  getAccessToken: vi.fn(async (): Promise<string | null> => null),
  getEnvironment: vi.fn(() => PARSED_ENVIRONMENT),
}));

vi.mock("@/config/environment", () => ({ getEnvironment }));
vi.mock("../auth/session", () => ({ getAccessToken }));

import { toInquiryId } from "@/model/inquiry/inquiry";
import {
  getInquiryHistory,
  getMyInquiryHistory,
  INQUIRY_BODY_MAX_LENGTH,
  listInquiries,
  postInquiryReply,
  postMyInquiryMessage,
} from "./inquiries";

const TOKEN = "2LOUdXuXEQ7Yg2nJRAgDA9yQbLyjGvoITuwDse3u9Z0";

const INQUIRY_ID = toInquiryId("0198a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a60");

const MY_MESSAGES_URL = `${PARSED_ENVIRONMENT.APP_API_BASE_URL}/v1/inquiries/me/messages`;

const INQUIRIES_URL = `${PARSED_ENVIRONMENT.APP_API_BASE_URL}/v1/inquiries`;

const DETAIL_MESSAGES_URL = `${INQUIRIES_URL}/:inquiryId/messages`;

const wireMessage = {
  id: "0198a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a01",
  inquiryId: INQUIRY_ID,
  authorKind: "user",
  body: "注文した商品がまだ届きません。",
  sequence: 3,
  createdAt: "2026-09-01T12:34:56.789Z",
};

const wireHistory = {
  inquiryId: INQUIRY_ID,
  messages: [wireMessage],
  nextAfterSequence: null,
  streamCursor: 3,
};

beforeEach(() => {
  vi.clearAllMocks();
  getAccessToken.mockResolvedValue(TOKEN);
});

describe("getMyInquiryHistory", () => {
  // ----- 正常系 -----
  it("契約の応答を表示用の履歴へ写す", async () => {
    serveJson(MY_MESSAGES_URL, wireHistory);

    await expect(getMyInquiryHistory()).resolves.toEqual({
      inquiryId: INQUIRY_ID,
      messages: [
        {
          id: wireMessage.id,
          authorKind: "user",
          body: wireMessage.body,
          sequence: 3,
          createdAt: new Date(wireMessage.createdAt),
        },
      ],
      nextAfterSequence: null,
      streamCursor: 3,
    });
  });

  it("購読の開始位置をそのまま渡す", async () => {
    serveJson(MY_MESSAGES_URL, { ...wireHistory, streamCursor: 12 });

    await expect(getMyInquiryHistory()).resolves.toMatchObject({ streamCursor: 12 });
  });

  it("まだ問い合わせを持たない主体には、空の履歴を返す", async () => {
    serveJson(MY_MESSAGES_URL, {
      inquiryId: null,
      messages: [],
      nextAfterSequence: null,
      streamCursor: 0,
    });

    await expect(getMyInquiryHistory()).resolves.toEqual({
      inquiryId: null,
      messages: [],
      nextAfterSequence: null,
      streamCursor: 0,
    });
  });

  it("先頭から読むときは、位置を載せない", async () => {
    const requests = serveJson(MY_MESSAGES_URL, wireHistory);

    await getMyInquiryHistory();

    expect(new URL(requests[0]?.url ?? "").searchParams.has("afterSequence")).toBe(false);
  });

  it("続きを読むときは、位置を載せる", async () => {
    const requests = serveJson(MY_MESSAGES_URL, wireHistory);

    await getMyInquiryHistory(8);

    expect(new URL(requests[0]?.url ?? "").searchParams.get("afterSequence")).toBe("8");
  });

  // ----- 異常系 -----
  it("session が切れた取得を unauthenticated として返す", async () => {
    serveStatus("get", MY_MESSAGES_URL, 401);

    await expect(getMyInquiryHistory().catch((error) => findAppError(error)?.kind)).resolves.toBe(
      ErrorKind.UNAUTHENTICATED,
    );
  });
});

describe("postMyInquiryMessage", () => {
  // ----- 正常系 -----
  it("追加された 1 通を返す", async () => {
    serveWrite("post", MY_MESSAGES_URL, { message: wireMessage });

    await expect(postMyInquiryMessage("本文", "key-1")).resolves.toMatchObject({
      id: wireMessage.id,
      sequence: 3,
    });
  });

  it("本文だけを送る", async () => {
    const requests = serveWrite("post", MY_MESSAGES_URL, { message: wireMessage });

    await postMyInquiryMessage("本文", "key-1");

    await expect(requests[0]?.json()).resolves.toEqual({ body: "本文" });
  });

  it("冪等キーをヘッダへ載せる", async () => {
    const requests = serveWrite("post", MY_MESSAGES_URL, { message: wireMessage });

    await postMyInquiryMessage("本文", "key-1");

    expect(requests[0]?.headers.get("Idempotency-Key")).toBe("key-1");
  });

  // ----- 異常系 -----
  it("契約を通らなかった送信を validation として返す", async () => {
    serveStatus("post", MY_MESSAGES_URL, 422);

    await expect(
      postMyInquiryMessage("本文", "key-1").catch((error) => findAppError(error)?.kind),
    ).resolves.toBe(ErrorKind.VALIDATION);
  });
});

describe("listInquiries", () => {
  // ----- 正常系 -----
  it("契約の応答を表示用の一覧へ写す", async () => {
    serveJson(INQUIRIES_URL, {
      items: [
        {
          id: INQUIRY_ID,
          userId: "550e8400-e29b-41d4-a716-446655440000",
          createdAt: "2026-09-01T10:00:00.000Z",
          updatedAt: "2026-09-01T12:34:56.789Z",
        },
      ],
      nextCursor: "cursor-2",
    });

    await expect(listInquiries()).resolves.toEqual({
      items: [
        {
          id: INQUIRY_ID,
          userId: "550e8400-e29b-41d4-a716-446655440000",
          createdAt: new Date("2026-09-01T10:00:00.000Z"),
          updatedAt: new Date("2026-09-01T12:34:56.789Z"),
        },
      ],
      nextCursor: "cursor-2",
    });
  });

  it("次が無いページを null で返す", async () => {
    serveJson(INQUIRIES_URL, { items: [], nextCursor: null });

    await expect(listInquiries()).resolves.toMatchObject({ nextCursor: null });
  });

  it("続きを読むときは、起点を載せる", async () => {
    const requests = serveJson(INQUIRIES_URL, { items: [], nextCursor: null });

    await listInquiries("cursor-2");

    expect(new URL(requests[0]?.url ?? "").searchParams.get("after")).toBe("cursor-2");
  });

  // ----- 異常系 -----
  it("役割が足りない取得を permission-denied として返す", async () => {
    serveStatus("get", INQUIRIES_URL, 403);

    await expect(listInquiries().catch((error) => findAppError(error)?.kind)).resolves.toBe(
      ErrorKind.PERMISSION_DENIED,
    );
  });
});

describe("getInquiryHistory", () => {
  // ----- 正常系 -----
  it("指定した問い合わせの履歴を取る", async () => {
    const requests = serveJson(DETAIL_MESSAGES_URL, wireHistory);

    await expect(getInquiryHistory(INQUIRY_ID)).resolves.toMatchObject({ streamCursor: 3 });
    expect(requests[0]?.url).toContain(`/v1/inquiries/${INQUIRY_ID}/messages`);
  });

  // ----- 異常系 -----
  it("存在しない問い合わせを not-found として返す", async () => {
    serveStatus("get", DETAIL_MESSAGES_URL, 404);

    await expect(
      getInquiryHistory(INQUIRY_ID).catch((error) => findAppError(error)?.kind),
    ).resolves.toBe(ErrorKind.NOT_FOUND);
  });
});

describe("postInquiryReply", () => {
  // ----- 正常系 -----
  it("回答を送り、追加された 1 通を返す", async () => {
    const requests = serveWrite("post", DETAIL_MESSAGES_URL, {
      message: { ...wireMessage, authorKind: "operator" },
    });

    await expect(postInquiryReply(INQUIRY_ID, "回答", "key-2")).resolves.toMatchObject({
      authorKind: "operator",
    });
    await expect(requests[0]?.json()).resolves.toEqual({ body: "回答" });
  });

  it("冪等キーをヘッダへ載せる", async () => {
    const requests = serveWrite("post", DETAIL_MESSAGES_URL, {
      message: { ...wireMessage, authorKind: "operator" },
    });

    await postInquiryReply(INQUIRY_ID, "回答", "key-2");

    expect(requests[0]?.headers.get("Idempotency-Key")).toBe("key-2");
  });
});

describe("INQUIRY_BODY_MAX_LENGTH", () => {
  it("契約が定めた上限を公開する", () => {
    expect(INQUIRY_BODY_MAX_LENGTH).toBe(4_000);
  });
});
