import { describe, expect, it } from "vitest";

import { IDEMPOTENCY_KEY_FIELD } from "@/model/idempotency-key";

import {
  parseAdminInquiryReplyForm,
  REPLY_BODY_FIELD,
  REPLY_INQUIRY_ID_FIELD,
} from "./parse-reply-form";

const KEY = "0198a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a99";

const INQUIRY_ID = "0198a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a60";

function formOf(
  body: string,
  { key = KEY, inquiryId = INQUIRY_ID }: { key?: string; inquiryId?: string } = {},
): FormData {
  const formData = new FormData();

  formData.set(REPLY_BODY_FIELD, body);
  formData.set(IDEMPOTENCY_KEY_FIELD, key);
  formData.set(REPLY_INQUIRY_ID_FIELD, inquiryId);

  return formData;
}

describe("parseAdminInquiryReplyForm", () => {
  // ----- 正常系 -----
  it("回答先・本文・冪等キーを取り出す", () => {
    expect(parseAdminInquiryReplyForm(formOf("回答"))).toEqual({
      ok: true,
      inquiryId: INQUIRY_ID,
      body: "回答",
      idempotencyKey: KEY,
    });
  });

  it("前後の空白を落とす", () => {
    expect(parseAdminInquiryReplyForm(formOf("  回答  "))).toMatchObject({ body: "回答" });
  });

  // ----- 異常系 -----
  it("空の本文を項目の文言として返す", () => {
    expect(parseAdminInquiryReplyForm(formOf(""))).toMatchObject({
      ok: false,
      bodyError: "本文を入力してください。",
    });
  });

  it("上限を超えた本文を項目の文言として返す", () => {
    expect(parseAdminInquiryReplyForm(formOf("あ".repeat(4_001)))).toMatchObject({ ok: false });
  });

  it("回答先が読めない送信を、項目に紐づかない失敗として返す", () => {
    expect(parseAdminInquiryReplyForm(formOf("回答", { inquiryId: "not-a-uuid" }))).toEqual({
      ok: false,
      bodyError: null,
    });
  });

  it("冪等キーが読めない送信を、項目に紐づかない失敗として返す", () => {
    expect(parseAdminInquiryReplyForm(formOf("回答", { key: "not-a-uuid" }))).toEqual({
      ok: false,
      bodyError: null,
    });
  });
});
