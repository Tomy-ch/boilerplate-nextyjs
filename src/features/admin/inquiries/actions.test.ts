import { beforeEach, describe, expect, it, vi } from "vitest";

import { createAppError } from "@/errors/app-error";
import { ErrorKind } from "@/errors/error-kind";
import { idleActionState } from "@/model/action-state";
import { IDEMPOTENCY_KEY_FIELD } from "@/model/idempotency-key";

const { postInquiryReply, revalidatePath } = vi.hoisted(() => ({
  postInquiryReply: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/adapters/server/api/inquiries", () => ({
  postInquiryReply,
  INQUIRY_BODY_MAX_LENGTH: 4_000,
}));

import { replyInquiryAction } from "./actions";
import { REPLY_BODY_FIELD, REPLY_INQUIRY_ID_FIELD } from "./parse-reply-form";

const KEY = "0198a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a99";

const INQUIRY_ID = "0198a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a60";

function formOf(body: string, inquiryId = INQUIRY_ID): FormData {
  const formData = new FormData();

  formData.set(REPLY_BODY_FIELD, body);
  formData.set(REPLY_INQUIRY_ID_FIELD, inquiryId);
  formData.set(IDEMPOTENCY_KEY_FIELD, KEY);

  return formData;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("replyInquiryAction", () => {
  // ----- 正常系 -----
  it("画面が載せた回答先へ送る", async () => {
    await replyInquiryAction(idleActionState(), formOf("回答"));

    expect(postInquiryReply).toHaveBeenCalledWith(INQUIRY_ID, "回答", KEY);
  });

  it("成立したら、開いている 1 件だけを取り直させる", async () => {
    const state = await replyInquiryAction(idleActionState(), formOf("回答"));

    expect(state.status).toBe("success");
    expect(revalidatePath).toHaveBeenCalledWith(`/admin/inquiries/${INQUIRY_ID}`);
  });

  // ----- 異常系 -----
  it("空の本文を項目の文言として返し、送らない", async () => {
    const state = await replyInquiryAction(idleActionState(), formOf(""));

    expect(state).toMatchObject({
      status: "error",
      fieldErrors: { [REPLY_BODY_FIELD]: ["本文を入力してください。"] },
    });
    expect(postInquiryReply).not.toHaveBeenCalled();
  });

  it("回答先を解けない送信を、項目に紐づかない失敗として返す", async () => {
    const state = await replyInquiryAction(idleActionState(), formOf("回答", "broken"));

    expect(state).toMatchObject({
      status: "error",
      formError: "送信を受け付けられませんでした。画面を読み込み直してください。",
    });
  });

  it("存在しない問い合わせへの回答を分類のまま返す", async () => {
    postInquiryReply.mockRejectedValue(createAppError(ErrorKind.NOT_FOUND));

    const state = await replyInquiryAction(idleActionState(), formOf("回答"));

    expect(state).toMatchObject({ status: "error", kind: ErrorKind.NOT_FOUND });
  });
});
