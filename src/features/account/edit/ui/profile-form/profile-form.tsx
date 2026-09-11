"use client";

import Link from "next/link";
import { useActionState, useEffect } from "react";

import { FormFeedback } from "@/components/app-starter/form-feedback/form-feedback";
import { Button } from "@/components/design-system/action/button/button";
import { BUTTON_VARIANT } from "@/components/design-system/action/button/button.definition";
import { FieldGroup, FieldLegend, FieldSet } from "@/components/design-system/form/field/field";
import { useToast } from "@/components/shell/toaster/toaster";
import { idleActionState } from "@/model/action-state";
import type { Prefecture, UserProfile } from "@/model/user/user";

import { updateProfileAction } from "../../../actions";
import { PROFILE_FIELD_LABELS } from "../../../field-labels";
import type { ProfileFormState } from "../../../form-state";
import { MYPAGE_PATH } from "../../../paths";
import { PostalCodeField } from "../../../ui/postal-code-field/postal-code-field";
import { PrefectureField } from "../../../ui/prefecture-field/prefecture-field";
import { ProfileSubmitButton } from "../../../ui/submit-button/submit-button";
import { TextField } from "../../../ui/text-field/text-field";
import { useAddressField } from "../../../use-address-field";
import { useProfileFields } from "../../../use-profile-fields";

const SUBMIT_LABEL = "保存する";
const PENDING_LABEL = "保存しています…";

type ProfileFormProps = {
  readonly profile: UserProfile;
  readonly prefectures: readonly Prefecture[];
};

/**
 * 検証も補完も持たず、並びだけを持つプロフィール編集フォーム。
 *
 * @remarks
 * 検証といつ誤りを見せるかは `useProfileFields`、住所の補完は `useAddressField` が持ちます。
 *
 * 送信は `<form action>` に委ねます。react-hook-form が持つのは入力中の検証だけで、送信機構は
 * 置き換えません。JavaScript が動かない環境でも form はそのまま送信され、server 側が同じ
 * スキーマで検証します。
 *
 * 成功は toast で伝えます。画面を移さない保存なので、この場に留まる通知が合います。
 */
export function ProfileForm({ prefectures, profile }: ProfileFormProps) {
  const [state, formAction] = useActionState<ProfileFormState, FormData>(
    updateProfileAction,
    idleActionState(),
  );
  const { toast } = useToast();
  const fields = useProfileFields(profile, state);
  const address = useAddressField(fields);

  useEffect(() => {
    if (state.status === "success") {
      toast({ title: "プロフィールを保存しました" });
    }
  }, [state, toast]);

  const postalCode = fields.fieldOf("postalCode");
  const prefecture = fields.fieldOf("prefecture");

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-8">
      {state.status === "error" && state.formError !== null ? (
        <FormFeedback
          description={state.formError}
          title="保存できませんでした"
          variant="destructive"
        />
      ) : null}

      <FieldSet>
        <FieldLegend>基本情報</FieldLegend>
        <div className="grid gap-6 sm:grid-cols-2">
          <TextField
            autoComplete="family-name"
            label={PROFILE_FIELD_LABELS.lastName}
            {...fields.fieldOf("lastName")}
          />
          <TextField
            autoComplete="given-name"
            label={PROFILE_FIELD_LABELS.firstName}
            {...fields.fieldOf("firstName")}
          />
        </div>
      </FieldSet>

      <FieldSet>
        <FieldLegend>連絡先</FieldLegend>
        <FieldGroup>
          <TextField
            autoComplete="email"
            label={PROFILE_FIELD_LABELS.email}
            type="email"
            {...fields.fieldOf("email")}
          />
          <TextField
            autoComplete="tel"
            inputMode="tel"
            label={PROFILE_FIELD_LABELS.phone}
            type="tel"
            {...fields.fieldOf("phone")}
          />
        </FieldGroup>
      </FieldSet>

      <FieldSet>
        <FieldLegend>住所</FieldLegend>
        <FieldGroup>
          {/* 補完は focus が外れた時点で走る。起きたことを画面の変化だけで伝えると、
              入力欄を見ていない利用者には届かない。 */}
          <p className="text-sm text-muted-foreground" role="status">
            {address.message}
          </p>
          <PostalCodeField
            controlId={postalCode.controlId}
            message={postalCode.message}
            onSearch={address.onSearch}
            registration={address.registration}
            required={postalCode.required}
            searching={address.searching}
            unavailable={address.unavailable}
          />
          <PrefectureField prefectures={prefectures} {...prefecture} />
          <TextField
            autoComplete="address-level2"
            label={PROFILE_FIELD_LABELS.city}
            {...fields.fieldOf("city")}
          />
          <TextField
            autoComplete="address-line1"
            label={PROFILE_FIELD_LABELS.street}
            {...fields.fieldOf("street")}
          />
          <TextField
            autoComplete="address-line2"
            label={PROFILE_FIELD_LABELS.building}
            {...fields.fieldOf("building")}
          />
        </FieldGroup>
      </FieldSet>

      <div className="flex justify-end gap-3">
        <Button asChild variant={BUTTON_VARIANT.OUTLINE}>
          <Link href={MYPAGE_PATH}>キャンセル</Link>
        </Button>
        <ProfileSubmitButton label={SUBMIT_LABEL} pendingLabel={PENDING_LABEL} />
      </div>
    </form>
  );
}
