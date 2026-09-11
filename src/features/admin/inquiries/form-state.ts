import type { ActionState } from "@/model/action-state";

import type { REPLY_BODY_FIELD } from "./form-names";

/**
 * 回答の送信が画面へ返す結果。
 *
 * @remarks
 * 成功しても返す値はありません。送った 1 通は取り直した正本に現れます。
 */
export type AdminInquiryReplyState = ActionState<void, typeof REPLY_BODY_FIELD>;

/**
 * 回答の送信先。
 *
 * @remarks
 * **この画面は送信先を自分で決めません。** 回答は任意の問い合わせを名指しする操作で、役割の
 * 確認が要ります。確認に使う `adapters/server/auth` へ触れてよいのは app 層なので
 * （`architecture.ts` の `adapters-auth`）、送信先は route が渡します。
 */
export type AdminInquiryReplyAction = (
  state: AdminInquiryReplyState,
  formData: FormData,
) => Promise<AdminInquiryReplyState>;

/** 送信された内容を解けなかったときの文言。 */
export const REPLY_MALFORMED_MESSAGE =
  "送信を受け付けられませんでした。画面を読み込み直してください。";
