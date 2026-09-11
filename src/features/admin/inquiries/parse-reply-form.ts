import { z } from "zod";

import { INQUIRY_BODY_MAX_LENGTH } from "@/adapters/server/api/inquiries";
import { IDEMPOTENCY_KEY_FIELD } from "@/model/idempotency-key";
import { type InquiryId, toInquiryId } from "@/model/inquiry/inquiry";

/** 本文を載せるフォーム項目の名前。 */
export const REPLY_BODY_FIELD = "body";

/** 回答先を載せるフォーム項目の名前。 */
export const REPLY_INQUIRY_ID_FIELD = "inquiryId";

/** 送信の内容を解いた結果。 */
export type AdminInquiryReplyFormResult =
  | {
      readonly ok: true;
      readonly inquiryId: InquiryId;
      readonly body: string;
      readonly idempotencyKey: string;
    }
  | { readonly ok: false; readonly bodyError: string | null };

const EMPTY_MESSAGE = "本文を入力してください。";

const TOO_LONG_MESSAGE = `本文は ${INQUIRY_BODY_MAX_LENGTH} 文字以内で入力してください。`;

/**
 * 送信された回答を、契約が受け付ける形へ解く。
 *
 * @remarks
 * **回答先は画面が載せたものを使います。** 運営は複数の問い合わせを開けるため、「いま開いている
 * もの」をサーバ側で決められません。
 *
 * 前後の空白と長さの扱いは利用者側の送信と同じです。同じ契約の同じ項目を、役割ごとに違う
 * 規則で受けないためです。
 */
export function parseAdminInquiryReplyForm(formData: FormData): AdminInquiryReplyFormResult {
  const body = z.string().safeParse(formData.get(REPLY_BODY_FIELD));
  const idempotencyKey = z.uuid().safeParse(formData.get(IDEMPOTENCY_KEY_FIELD));
  const inquiryId = z.uuid().safeParse(formData.get(REPLY_INQUIRY_ID_FIELD));

  if (!idempotencyKey.success || !inquiryId.success) {
    return { ok: false, bodyError: null };
  }

  const trimmed = body.success ? body.data.trim() : "";

  if (trimmed === "") {
    return { ok: false, bodyError: EMPTY_MESSAGE };
  }

  if ([...trimmed].length > INQUIRY_BODY_MAX_LENGTH) {
    return { ok: false, bodyError: TOO_LONG_MESSAGE };
  }

  return {
    ok: true,
    inquiryId: toInquiryId(inquiryId.data),
    body: trimmed,
    idempotencyKey: idempotencyKey.data,
  };
}
