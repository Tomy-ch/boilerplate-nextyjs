import { beforeEach, describe, expect, it, vi } from "vitest";

import { createAppError } from "@/errors/app-error";
import { ErrorKind } from "@/errors/error-kind";
import { REPLY_BODY_FIELD, REPLY_INQUIRY_ID_FIELD } from "@/features/admin/inquiries/form-names";
import { idleActionState } from "@/model/action-state";
import { IDEMPOTENCY_KEY_FIELD } from "@/model/idempotency-key";
import { SESSION_ROLE } from "@/model/session";

const { verifySession, postInquiryReply, revalidatePath } = vi.hoisted(() => ({
  verifySession: vi.fn(),
  postInquiryReply: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/adapters/server/auth/session", () => ({ verifySession }));
vi.mock("@/adapters/server/api/inquiries", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/adapters/server/api/inquiries")>()),
  postInquiryReply,
}));

import { replyInquiryAction } from "./actions";

const INQUIRY_ID = "0198a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a60";

const KEY = "00000000-0000-4000-8000-000000000001";

/** 形の上で通る最小の入力。個々のケースは、ここから 1 項目だけ崩す。 */
function replyForm(overrides: Readonly<Record<string, string>> = {}): FormData {
  const form = new FormData();
  const values: Record<string, string> = {
    [REPLY_BODY_FIELD]: "本日中に発送いたします。",
    [REPLY_INQUIRY_ID_FIELD]: INQUIRY_ID,
    [IDEMPOTENCY_KEY_FIELD]: KEY,
    ...overrides,
  };

  for (const [key, value] of Object.entries(values)) {
    form.append(key, value);
  }

  return form;
}

beforeEach(() => {
  vi.clearAllMocks();
  verifySession.mockResolvedValue({ role: SESSION_ROLE.admin });
});

describe("replyInquiryAction", () => {
  // ----- 正常系 -----
  it("送信が名指しした問い合わせへ回答を送る", async () => {
    await replyInquiryAction(idleActionState(), replyForm());

    expect(postInquiryReply).toHaveBeenCalledWith(INQUIRY_ID, "本日中に発送いたします。", KEY);
  });

  it("成立したら、開いている 1 件だけを取り直させる", async () => {
    const state = await replyInquiryAction(idleActionState(), replyForm());

    expect(state.status).toBe("success");
    expect(revalidatePath).toHaveBeenCalledWith(`/admin/inquiries/${INQUIRY_ID}`);
  });

  // ----- 認可 -----
  it("役割を持たない主体の要求を、口の内側で止める", async () => {
    verifySession.mockResolvedValue({ role: SESSION_ROLE.user });

    const state = await replyInquiryAction(idleActionState(), replyForm());

    expect(state).toMatchObject({ status: "error", kind: ErrorKind.PERMISSION_DENIED });
    expect(postInquiryReply).not.toHaveBeenCalled();
  });

  it("session を持たない要求も止める", async () => {
    verifySession.mockResolvedValue(null);

    const state = await replyInquiryAction(idleActionState(), replyForm());

    expect(state).toMatchObject({ status: "error", kind: ErrorKind.PERMISSION_DENIED });
    expect(postInquiryReply).not.toHaveBeenCalled();
  });

  // ----- 異常系 -----
  it("空の本文を項目の文言として返し、送らない", async () => {
    const state = await replyInquiryAction(
      idleActionState(),
      replyForm({ [REPLY_BODY_FIELD]: " " }),
    );

    expect(state).toMatchObject({
      status: "error",
      fieldErrors: { [REPLY_BODY_FIELD]: ["本文を入力してください。"] },
    });
    expect(postInquiryReply).not.toHaveBeenCalled();
  });

  it("回答先を解けない送信を、項目に紐づかない失敗として返す", async () => {
    const state = await replyInquiryAction(
      idleActionState(),
      replyForm({ [REPLY_INQUIRY_ID_FIELD]: "broken" }),
    );

    expect(state).toMatchObject({
      status: "error",
      formError: "送信を受け付けられませんでした。画面を読み込み直してください。",
    });
  });

  it("存在しない問い合わせへの回答を分類のまま返す", async () => {
    postInquiryReply.mockRejectedValue(createAppError(ErrorKind.NOT_FOUND));

    const state = await replyInquiryAction(idleActionState(), replyForm());

    expect(state).toMatchObject({ status: "error", kind: ErrorKind.NOT_FOUND });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
