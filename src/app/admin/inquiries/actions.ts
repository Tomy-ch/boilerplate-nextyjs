"use server";

import { revalidatePath } from "next/cache";

import { postInquiryReply } from "@/adapters/server/api/inquiries";
import { verifySession } from "@/adapters/server/auth/session";
import { createAppError } from "@/errors/app-error";
import { ErrorKind } from "@/errors/error-kind";
import { REPLY_BODY_FIELD } from "@/features/admin/inquiries/form-names";
import type { AdminInquiryReplyState } from "@/features/admin/inquiries/form-state";
import { REPLY_MALFORMED_MESSAGE } from "@/features/admin/inquiries/form-state";
import { parseAdminInquiryReplyForm } from "@/features/admin/inquiries/parse-reply-form";
import { adminInquiryDetailPath } from "@/features/admin/paths";
import {
  actionStateFromError,
  failedActionState,
  succeededActionState,
} from "@/model/action-state";
import { isAdmin } from "@/model/authz";

/** 役割を持たない主体の要求をここで止める。 */
async function assertAdmin(): Promise<void> {
  if (!isAdmin(await verifySession())) {
    throw createAppError(ErrorKind.PERMISSION_DENIED, {
      cause: new Error("管理の操作に必要な役割がありません"),
    });
  }
}

/**
 * 問い合わせへ回答を 1 通送る。
 *
 * @remarks
 * **回答先は送信が名指しします。** 運営は複数の問い合わせを行き来するため、「いま開いているもの」
 * をサーバ側で決められません。名指しできる以上、役割の確認をこの口の内側で済ませます —— 画面が
 * 保護されていることは、action が保護されていることを意味しません。
 *
 * 送信の後に開いている 1 件だけを取り直します。一覧は購読が知らせます。
 */
export async function replyInquiryAction(
  _previous: AdminInquiryReplyState,
  formData: FormData,
): Promise<AdminInquiryReplyState> {
  try {
    await assertAdmin();
  } catch (error) {
    return actionStateFromError(error);
  }

  const parsed = parseAdminInquiryReplyForm(formData);

  if (!parsed.ok) {
    return parsed.bodyError === null
      ? failedActionState({ formError: REPLY_MALFORMED_MESSAGE })
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
