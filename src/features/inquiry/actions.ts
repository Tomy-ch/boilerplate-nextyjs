"use server";

import { revalidatePath } from "next/cache";

import { postMyInquiryMessage } from "@/adapters/server/api/inquiries";
import {
  type ActionState,
  actionStateFromError,
  failedActionState,
  succeededActionState,
} from "@/model/action-state";

import { INQUIRY_PATH } from "./facade/paths/paths";
import { INQUIRY_BODY_FIELD, parseInquiryMessageForm } from "./parse-message-form";

/**
 * 送信が画面へ返す結果。
 *
 * @remarks
 * 成功しても返す値はありません。送った 1 通は取り直した正本に現れ、それは同じ往復で再描画される
 * Server Component が持ちます。
 */
export type InquiryMessageActionState = ActionState<void, typeof INQUIRY_BODY_FIELD>;

/** 送信された内容を解けなかったときの文言。 */
const MALFORMED_MESSAGE = "送信を受け付けられませんでした。画面を読み込み直してください。";

/**
 * 自分の問い合わせへ 1 通送る。
 *
 * @remarks
 * **最初の 1 通が問い合わせを作ります。** 送る前に問い合わせを用意する操作はありません。
 *
 * 送信の後に画面を取り直すのは、送った 1 通を正本へ入れるためだけではありません。取り直した
 * 応答が新しい購読の開始位置を返すので、送信と購読の位置が同じ往復で揃います。
 */
export async function sendInquiryMessageAction(
  _previous: InquiryMessageActionState,
  formData: FormData,
): Promise<InquiryMessageActionState> {
  const parsed = parseInquiryMessageForm(formData);

  if (!parsed.ok) {
    return parsed.bodyError === null
      ? failedActionState({ formError: MALFORMED_MESSAGE })
      : failedActionState({ fieldErrors: { [INQUIRY_BODY_FIELD]: [parsed.bodyError] } });
  }

  try {
    await postMyInquiryMessage(parsed.body, parsed.idempotencyKey);
  } catch (error) {
    return actionStateFromError(error);
  }

  revalidatePath(INQUIRY_PATH);

  return succeededActionState(undefined);
}
