import { z } from "zod";

import type { FieldErrors } from "@/model/action-state";
import { IDEMPOTENCY_KEY_FIELD } from "@/model/idempotency-key";
import type { SafeReturnUrl } from "@/model/return-url";
import { toSafeReturnUrl } from "@/model/return-url";
import type { ProfileField } from "@/model/user/profile-schema";
import type { UserProfile } from "@/model/user/user";
import { parseProfileForm } from "../parse-profile-form";
import { RETURN_URL_FIELD } from "./form-names";

/** {@link parseRegistrationForm} の結果。 */
export type RegistrationFormParseResult =
  | {
      readonly status: "ok";
      readonly profile: UserProfile;
      readonly idempotencyKey: string;
      readonly returnUrl: SafeReturnUrl;
    }
  | { readonly status: "invalid-input"; readonly fieldErrors: FieldErrors<ProfileField> }
  | { readonly status: "broken-request" };

/**
 * 送信された `FormData` を、登録に渡せる形へ解く。
 *
 * @remarks
 * 入力の検証は編集と同じ `parseProfileForm` に委ね、ここが足すのは**画面が載せた 2 つ**
 * （冪等キーと戻り先）だけです。
 *
 * **入力の誤りと、壊れた要求を分けます。** 前者は利用者が直せるもので項目ごとに返しますが、
 * 冪等キーが無い・形が違う送信は画面が組んだものではなく、利用者に直せることがありません。
 *
 * 戻り先は検証を通した相対パスへ倒します。載っていなくても失敗にはしません。
 */
export function parseRegistrationForm(formData: FormData): RegistrationFormParseResult {
  const idempotencyKey = z.uuid().safeParse(formData.get(IDEMPOTENCY_KEY_FIELD));

  if (!idempotencyKey.success) {
    return { status: "broken-request" };
  }

  const parsed = parseProfileForm(formData);

  if (!parsed.ok) {
    return { status: "invalid-input", fieldErrors: parsed.fieldErrors };
  }

  const returnUrl = formData.get(RETURN_URL_FIELD);

  return {
    status: "ok",
    profile: parsed.profile,
    idempotencyKey: idempotencyKey.data,
    returnUrl: toSafeReturnUrl(typeof returnUrl === "string" ? returnUrl : undefined),
  };
}
