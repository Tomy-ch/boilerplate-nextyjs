"use server";

import { revalidatePath } from "next/cache";

import { postInquiryReply } from "@/adapters/server/api/inquiries";
import {
  type ActionState,
  actionStateFromError,
  failedActionState,
  succeededActionState,
} from "@/model/action-state";

import { adminInquiryDetailPath } from "../paths";
import { REPLY_BODY_FIELD } from "./form-names";
import { parseAdminInquiryReplyForm } from "./parse-reply-form";

/** 回答が画面へ返す結果。成功しても返す値は無く、送った 1 通は取り直した正本に現れる。 */
export type AdminInquiryReplyActionState = ActionState<void, typeof REPLY_BODY_FIELD>;

/** 送信された内容を解けなかったときの文言。 */
const MALFORMED_MESSAGE = "送信を受け付けられませんでした。画面を読み込み直してください。";

/**
 * 問い合わせへ回答を 1 通送る。
 *
 * @remarks
 * 送信の後に画面を取り直す理由は、利用者側の送信（`../../inquiry/actions.ts`）と同じです。
 * 取り直すのは開いている 1 件だけで、一覧は購読が知らせます。
 */
export async function replyInquiryAction(
  _previous: AdminInquiryReplyActionState,
  formData: FormData,
): Promise<AdminInquiryReplyActionState> {
  const parsed = parseAdminInquiryReplyForm(formData);

  if (!parsed.ok) {
    return parsed.bodyError === null
      ? failedActionState({ formError: MALFORMED_MESSAGE })
      : failedActionState({ fieldErrors: { [REPLY_BODY_FIELD]: [parsed.bodyError] } });
  }

  try {
    await postInquiryReply(parsed.inquiryId, parsed.body, parsed.idempotencyKey);
  } catch (error) {
    return actionStateFromError(error);
  }

  revalidatePath(adminInquiryDetailPath(parsed.inquiryId));

  return succeededActionState(undefined);
}
