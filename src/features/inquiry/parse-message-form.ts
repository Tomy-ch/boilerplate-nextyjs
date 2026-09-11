import { z } from "zod";

import { INQUIRY_BODY_MAX_LENGTH } from "@/adapters/server/api/inquiries";
import { IDEMPOTENCY_KEY_FIELD } from "@/model/idempotency-key";

/** 本文を載せるフォーム項目の名前。 */
export const INQUIRY_BODY_FIELD = "body";

/** 送信の内容を解いた結果。読めなかった項目は、そのまま項目の文言になる。 */
export type InquiryMessageFormResult =
  | { readonly ok: true; readonly body: string; readonly idempotencyKey: string }
  | { readonly ok: false; readonly bodyError: string | null };

const EMPTY_MESSAGE = "本文を入力してください。";

const TOO_LONG_MESSAGE = `本文は ${INQUIRY_BODY_MAX_LENGTH} 文字以内で入力してください。`;

/**
 * 送信された内容を、契約が受け付ける形へ解く。
 *
 * @remarks
 * **前後の空白は落とします。** 改行だけの送信を空として扱うためで、落とした結果が空になる本文は
 * 契約の下限に掛かる前にここで止めます。
 *
 * 長さは契約の上限をそのまま当てます。文字数の数え方は契約と揃える必要があり、UTF-16 の要素数で
 * 数えると絵文字を含む本文が実際より長く見えます。
 */
export function parseInquiryMessageForm(formData: FormData): InquiryMessageFormResult {
  const body = z.string().safeParse(formData.get(INQUIRY_BODY_FIELD));
  const idempotencyKey = z.uuid().safeParse(formData.get(IDEMPOTENCY_KEY_FIELD));

  if (!idempotencyKey.success) {
    return { ok: false, bodyError: null };
  }

  const trimmed = body.success ? body.data.trim() : "";

  if (trimmed === "") {
    return { ok: false, bodyError: EMPTY_MESSAGE };
  }

  if ([...trimmed].length > INQUIRY_BODY_MAX_LENGTH) {
    return { ok: false, bodyError: TOO_LONG_MESSAGE };
  }

  return { ok: true, body: trimmed, idempotencyKey: idempotencyKey.data };
}
