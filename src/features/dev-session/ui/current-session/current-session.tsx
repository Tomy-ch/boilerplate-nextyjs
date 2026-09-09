"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { FormFeedback } from "@/components/app-starter/form-feedback/form-feedback";
import { Button } from "@/components/design-system/action/button/button";
import { BUTTON_VARIANT } from "@/components/design-system/action/button/button.definition";
import {
  KeyValueItem,
  KeyValueLabel,
  KeyValueList,
  KeyValueValue,
} from "@/components/design-system/display/key-value-list/key-value-list";
import { idleActionState } from "@/model/action-state";
import { formatDateTime } from "@/model/datetime";
import type { Session } from "@/model/session";

import type { DiscardDevSessionAction, DiscardSessionFormState } from "../../form-state";

/** `CurrentSession` の props。 */
export type CurrentSessionProps = {
  /** いま持っている session。持っていなければ null。 */
  session: Session | null;
  /** 破棄の送信先。route が渡す。 */
  action: DiscardDevSessionAction;
};

const DISCARD_LABEL = "session を捨てる";
const PENDING_LABEL = "session を捨てています";

/** 送信部。`useFormStatus` は form の子でしか状態を読めないため切り出している。 */
function DiscardSubmit() {
  const { pending } = useFormStatus();

  return (
    <Button
      pending={pending}
      pendingLabel={PENDING_LABEL}
      type="submit"
      variant={BUTTON_VARIANT.OUTLINE}
    >
      {DISCARD_LABEL}
    </Button>
  );
}

/**
 * いま持っている session と、それを捨てる操作。
 *
 * @remarks
 * Access Token は出しません。**ブラウザから観測できない**ことが session をこの形にしている理由
 * そのもので、確かめる画面のために出すと、その性質を自分で壊すことになります。
 *
 * 捨てたあとは画面に留まります。結果は同じ画面が出し直すこの表示に現れます。
 */
export function CurrentSession({ session, action }: CurrentSessionProps) {
  const [state, formAction] = useActionState<DiscardSessionFormState, FormData>(
    action,
    idleActionState(),
  );

  if (session === null) {
    return <p className="text-muted-foreground text-sm">いま session は持っていません。</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <KeyValueList>
        <KeyValueItem>
          <KeyValueLabel>利用者 ID</KeyValueLabel>
          <KeyValueValue className="break-all">{session.userId}</KeyValueValue>
        </KeyValueItem>
        <KeyValueItem>
          <KeyValueLabel>役割</KeyValueLabel>
          <KeyValueValue>{session.role}</KeyValueValue>
        </KeyValueItem>
        <KeyValueItem>
          <KeyValueLabel>失効</KeyValueLabel>
          <KeyValueValue>{formatDateTime(session.expiresAt)}</KeyValueValue>
        </KeyValueItem>
      </KeyValueList>
      <form action={formAction} className="flex flex-col items-start gap-2">
        <DiscardSubmit />
        {state.status === "error" && state.formError !== null ? (
          <FormFeedback
            description={state.formError}
            title="session を捨てられませんでした"
            variant="destructive"
          />
        ) : null}
      </form>
    </div>
  );
}
