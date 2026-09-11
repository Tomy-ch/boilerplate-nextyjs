"use client";

import { useState } from "react";

import { INQUIRY_BODY_MAX_LENGTH } from "@/adapters/server/api/inquiries";
import { Button } from "@/components/design-system/action/button/button";
import { Label } from "@/components/design-system/form/label/label";
import { Textarea } from "@/components/design-system/form/textarea/textarea";
import { IDEMPOTENCY_KEY_FIELD } from "@/model/idempotency-key";
import type { InquiryId } from "@/model/inquiry/inquiry";

import type { AdminInquiryReplyActionState } from "../../../actions";
import { REPLY_BODY_FIELD, REPLY_INQUIRY_ID_FIELD } from "../../../parse-reply-form";

/** `AdminInquiryReplyForm` の props。 */
export type AdminInquiryReplyFormProps = {
  /** 回答先。送信に載せる。 */
  inquiryId: InquiryId;
  /** 送信の受け口。 */
  action: (formData: FormData) => void;
  /** 直前の送信の結果。 */
  state: AdminInquiryReplyActionState;
  /** この送信に載せる冪等キー。成立するまで同じ値を使う。 */
  idempotencyKey: string;
  /** 送信中か。 */
  pending: boolean;
};

const LABEL = "回答";

const PLACEHOLDER = "回答を入力してください";

const SUBMIT_LABEL = "回答する";

const SENDING_LABEL = "送信中";

/**
 * 回答の入力欄。
 *
 * @remarks
 * **`⌘Enter` での送信を持ちません。** 運営の回答は書き上げてから送るもので、打ち終わりが
 * そのまま送信になると、書きかけが利用者へ届きます。
 */
export function AdminInquiryReplyForm({
  action,
  idempotencyKey,
  inquiryId,
  pending,
  state,
}: AdminInquiryReplyFormProps) {
  const [draft, setDraft] = useState("");
  const [seenState, setSeenState] = useState(state);

  // 送信が成立したら書きかけを片付ける。通らなかったときに残すのは、打ち直させないためである。
  if (seenState !== state) {
    setSeenState(state);

    if (state.status === "success") {
      setDraft("");
    }
  }

  const bodyErrors =
    state.status === "error" ? (state.fieldErrors?.[REPLY_BODY_FIELD] ?? []) : [];

  return (
    <form action={action} className="flex flex-col gap-2">
      <input name={IDEMPOTENCY_KEY_FIELD} type="hidden" value={idempotencyKey} />
      <input name={REPLY_INQUIRY_ID_FIELD} type="hidden" value={inquiryId} />

      <Label htmlFor={REPLY_BODY_FIELD}>{LABEL}</Label>
      <Textarea
        aria-describedby={bodyErrors.length === 0 ? undefined : `${REPLY_BODY_FIELD}-error`}
        aria-invalid={bodyErrors.length === 0 ? undefined : true}
        id={REPLY_BODY_FIELD}
        maxLength={INQUIRY_BODY_MAX_LENGTH}
        name={REPLY_BODY_FIELD}
        onChange={(event) => setDraft(event.target.value)}
        placeholder={PLACEHOLDER}
        rows={4}
        value={draft}
      />

      {bodyErrors.length === 0 ? null : (
        <p className="text-sm text-destructive" id={`${REPLY_BODY_FIELD}-error`}>
          {bodyErrors.join(" ")}
        </p>
      )}

      <div className="flex justify-end">
        <Button disabled={pending || draft.trim() === ""} type="submit">
          {pending ? SENDING_LABEL : SUBMIT_LABEL}
        </Button>
      </div>
    </form>
  );
}
