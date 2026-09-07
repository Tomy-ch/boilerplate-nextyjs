import { z } from "zod";

import type { FieldErrors } from "@/model/action-state";
import type { ProfileField } from "@/model/user/profile-schema";
import { profileSchema } from "@/model/user/profile-schema";
import type { UserProfile } from "@/model/user/user";

/** {@link parseProfileForm} の結果。 */
export type ProfileFormParseResult =
  | { readonly ok: true; readonly profile: UserProfile }
  | { readonly ok: false; readonly fieldErrors: FieldErrors<ProfileField> };

/** `FormData` の 1 項目を文字列として読む。未入力と欠落を同じ空文字へ均す。 */
function readField(formData: FormData, name: ProfileField): string {
  const value = formData.get(name);

  return typeof value === "string" ? value : "";
}

/**
 * 送信された `FormData` を、更新に渡せる形へ解く。
 *
 * @remarks
 * **送信の編成を持ちません。** 解いた結果を返すだけで、通信も分類も呼び出し側の仕事です。分けて
 * あるのは、入力の読み取り方（`FormData` の形）と、更新の手順が別々の理由で変わるためです。
 *
 * 検証は client と同じスキーマで通し直します。client の検証は即時に返すためのもので、そこを
 * 通ったことは何の保証にもなりません。
 */
export function parseProfileForm(formData: FormData): ProfileFormParseResult {
  const parsed = profileSchema.safeParse({
    firstName: readField(formData, "firstName"),
    lastName: readField(formData, "lastName"),
    email: readField(formData, "email"),
    phone: readField(formData, "phone"),
    postalCode: readField(formData, "postalCode"),
    prefecture: readField(formData, "prefecture"),
    city: readField(formData, "city"),
    street: readField(formData, "street"),
    building: readField(formData, "building"),
  });

  if (!parsed.success) {
    return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  return {
    ok: true,
    profile: {
      ...parsed.data,
      // 建物名は任意入力。空欄は「入力しなかった」であり、空文字という値ではない。
      building: parsed.data.building === "" ? null : parsed.data.building,
    },
  };
}
