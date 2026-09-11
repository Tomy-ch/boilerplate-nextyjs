import { describe, expect, it } from "vitest";

import { IDEMPOTENCY_KEY_FIELD } from "@/model/idempotency-key";

import { INQUIRY_BODY_FIELD, parseInquiryMessageForm } from "./parse-message-form";

const KEY = "0198a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a99";

function formOf(body: string | null, key: string | null = KEY): FormData {
  const formData = new FormData();

  if (body !== null) {
    formData.set(INQUIRY_BODY_FIELD, body);
  }

  if (key !== null) {
    formData.set(IDEMPOTENCY_KEY_FIELD, key);
  }

  return formData;
}

describe("parseInquiryMessageForm", () => {
  // ----- 正常系 -----
  it("本文と冪等キーを取り出す", () => {
    expect(parseInquiryMessageForm(formOf("本文"))).toEqual({
      ok: true,
      body: "本文",
      idempotencyKey: KEY,
    });
  });

  it("前後の空白を落とす", () => {
    expect(parseInquiryMessageForm(formOf("  本文  "))).toMatchObject({ body: "本文" });
  });

  it("上限ちょうどの本文を通す", () => {
    expect(parseInquiryMessageForm(formOf("あ".repeat(4_000)))).toMatchObject({ ok: true });
  });

  // ----- 異常系 -----
  it("空の本文を項目の文言として返す", () => {
    expect(parseInquiryMessageForm(formOf(""))).toEqual({
      ok: false,
      bodyError: "本文を入力してください。",
    });
  });

  it("空白と改行だけの本文を空として扱う", () => {
    expect(parseInquiryMessageForm(formOf(" \n "))).toMatchObject({ ok: false });
  });

  it("本文が載っていない送信を空として扱う", () => {
    expect(parseInquiryMessageForm(formOf(null))).toMatchObject({ ok: false });
  });

  it("上限を超えた本文を項目の文言として返す", () => {
    const result = parseInquiryMessageForm(formOf("あ".repeat(4_001)));

    expect(result).toMatchObject({ ok: false });
    expect(result.ok === false && result.bodyError).toContain("4000");
  });

  it("文字数はコードポイントで数える", () => {
    // UTF-16 の要素数では上限を超えるが、コードポイントでは上限ちょうど。
    expect(parseInquiryMessageForm(formOf("😀".repeat(4_000)))).toMatchObject({ ok: true });
  });

  it("冪等キーが読めない送信を、項目に紐づかない失敗として返す", () => {
    expect(parseInquiryMessageForm(formOf("本文", "not-a-uuid"))).toEqual({
      ok: false,
      bodyError: null,
    });
  });
});
