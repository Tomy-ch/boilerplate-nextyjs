import { beforeEach, describe, expect, it, vi } from "vitest";

import { createAppError } from "@/errors/app-error";
import { ErrorKind } from "@/errors/error-kind";
import { idleActionState } from "@/model/action-state";
import { IDEMPOTENCY_KEY_FIELD } from "@/model/idempotency-key";

const { postMyInquiryMessage, revalidatePath } = vi.hoisted(() => ({
  postMyInquiryMessage: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/adapters/server/api/inquiries", () => ({
  postMyInquiryMessage,
  INQUIRY_BODY_MAX_LENGTH: 4_000,
}));

import { sendInquiryMessageAction } from "./actions";
import { INQUIRY_BODY_FIELD } from "./parse-message-form";

const KEY = "0198a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a99";

function formOf(body: string, key = KEY): FormData {
  const formData = new FormData();

  formData.set(INQUIRY_BODY_FIELD, body);
  formData.set(IDEMPOTENCY_KEY_FIELD, key);

  return formData;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("sendInquiryMessageAction", () => {
  // ----- 正常系 -----
  it("本文と冪等キーを送る", async () => {
    await sendInquiryMessageAction(idleActionState(), formOf("本文"));

    expect(postMyInquiryMessage).toHaveBeenCalledWith("本文", KEY);
  });

  it("成立したら、画面を取り直させる", async () => {
    const state = await sendInquiryMessageAction(idleActionState(), formOf("本文"));

    expect(state.status).toBe("success");
    expect(revalidatePath).toHaveBeenCalledWith("/mypage/inquiry");
  });

  // ----- 異常系 -----
  it("空の本文を項目の文言として返し、送らない", async () => {
    const state = await sendInquiryMessageAction(idleActionState(), formOf(" "));

    expect(state).toMatchObject({
      status: "error",
      fieldErrors: { [INQUIRY_BODY_FIELD]: ["本文を入力してください。"] },
    });
    expect(postMyInquiryMessage).not.toHaveBeenCalled();
  });

  it("冪等キーを解けない送信を、項目に紐づかない失敗として返す", async () => {
    const state = await sendInquiryMessageAction(idleActionState(), formOf("本文", "broken"));

    expect(state).toMatchObject({
      status: "error",
      formError: "送信を受け付けられませんでした。画面を読み込み直してください。",
    });
  });

  it("取得の失敗を分類のまま返す", async () => {
    postMyInquiryMessage.mockRejectedValue(createAppError(ErrorKind.UNAVAILABLE));

    const state = await sendInquiryMessageAction(idleActionState(), formOf("本文"));

    expect(state).toMatchObject({ status: "error", kind: ErrorKind.UNAVAILABLE });
  });

  it("通らなかった送信では、画面を取り直させない", async () => {
    postMyInquiryMessage.mockRejectedValue(createAppError(ErrorKind.VALIDATION));

    await sendInquiryMessageAction(idleActionState(), formOf("本文"));

    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
