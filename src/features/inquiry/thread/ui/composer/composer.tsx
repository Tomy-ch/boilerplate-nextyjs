"use client";

import { type KeyboardEvent, useState } from "react";

import { Button } from "@/components/design-system/action/button/button";
import { Label } from "@/components/design-system/form/label/label";
import { Textarea } from "@/components/design-system/form/textarea/textarea";
import { INQUIRY_BODY_MAX_LENGTH } from "@/adapters/server/api/inquiries";
import { IDEMPOTENCY_KEY_FIELD } from "@/model/idempotency-key";

import type { InquiryMessageActionState } from "../../../actions";
import { INQUIRY_BODY_FIELD } from "../../../parse-message-form";

/** `InquiryComposer` の props。 */
export type InquiryComposerProps = {
  /** 送信の受け口。 */
  action: (formData: FormData) => void;
  /** 直前の送信の結果。成功していれば書きかけを片付ける。 */
  state: InquiryMessageActionState;
  /** この送信に載せる冪等キー。成立するまで同じ値を使う。 */
  idempotencyKey: string;
  /** 送信中か。 */
  pending: boolean;
};

const LABEL = "お問い合わせ内容";

const PLACEHOLDER = "ご用件をご記入ください";

const SUBMIT_LABEL = "送信";

const SENDING_LABEL = "送信中";

/** 送信欄。書きかけはここが持ち、成立したときだけ片付ける。 */
export function InquiryComposer({
  action,
  state,
  idempotencyKey,
  pending,
}: InquiryComposerProps) {
  const [draft, setDraft] = useState("");
  const [seenState, setSeenState] = useState(state);

  // 送信が成立したら書きかけを片付ける。通らなかったときに残すのは、打ち直させないためである。
  if (seenState !== state) {
    setSeenState(state);

    if (state.status === "success") {
      setDraft("");
    }
  }

  const bodyErrors = state.status === "error" ? (state.fieldErrors?.[INQUIRY_BODY_FIELD] ?? []) : [];
  const empty = draft.trim() === "";

  function submitOnModifierEnter(event: KeyboardEvent<HTMLTextAreaElement>): void {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey) && !empty) {
      event.currentTarget.form?.requestSubmit();
    }
  }

  return (
    <form action={action} className="flex flex-col gap-2">
      <input name={IDEMPOTENCY_KEY_FIELD} type="hidden" value={idempotencyKey} />

      <Label className="sr-only" htmlFor={INQUIRY_BODY_FIELD}>
        {LABEL}
      </Label>
      <Textarea
        aria-describedby={bodyErrors.length === 0 ? undefined : `${INQUIRY_BODY_FIELD}-error`}
        aria-invalid={bodyErrors.length === 0 ? undefined : true}
        id={INQUIRY_BODY_FIELD}
        maxLength={INQUIRY_BODY_MAX_LENGTH}
        name={INQUIRY_BODY_FIELD}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={submitOnModifierEnter}
        placeholder={PLACEHOLDER}
        rows={3}
        value={draft}
      />

      {bodyErrors.length === 0 ? null : (
        <p className="text-sm text-destructive" id={`${INQUIRY_BODY_FIELD}-error`}>
          {bodyErrors.join(" ")}
        </p>
      )}

      <div className="flex justify-end">
        <Button disabled={pending || empty} type="submit">
          {pending ? SENDING_LABEL : SUBMIT_LABEL}
        </Button>
      </div>
    </form>
  );
}
