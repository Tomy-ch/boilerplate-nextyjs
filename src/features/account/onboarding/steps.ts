import type { ProfileField, ProfileInput } from "@/model/user/profile-schema";
import { profileSchema } from "@/model/user/profile-schema";

/**
 * 段の識別子。並び順がそのまま進む順になる。
 *
 * @remarks
 * 器（`WizardForm`）と待機表示の双方が段の数と並びを要ります。書き写すと、段を足したときに
 * 片方だけが古い並びで残ります。
 */
export const STEP_IDS = ["basics", "address", "confirm"] as const;

/** 基本情報の段で尋ねる項目。 */
export const BASICS_FIELDS: readonly ProfileField[] = ["lastName", "firstName", "email", "phone"];

/** 住所の段で尋ねる項目。 */
export const ADDRESS_FIELDS: readonly ProfileField[] = [
  "postalCode",
  "prefecture",
  "city",
  "street",
  "building",
];

/**
 * 登録で送る項目を、尋ねる順に並べたもの。
 *
 * @remarks
 * 確認の段がこの並びで読み返します。段ごとの一覧から組むのは、項目を足したときに確認へ出し
 * 忘れる経路を作らないためです。
 */
export const REGISTRATION_FIELDS: readonly ProfileField[] = [...BASICS_FIELDS, ...ADDRESS_FIELDS];

/**
 * その段を終えられるかを判定する。
 *
 * @remarks
 * 判定は入力欄と同じ表示検証スキーマで行います。条件を書き写すと、規則を変えたときに入力欄と
 * 段送りで言うことが割れます。
 *
 * **触れたかどうかを見ません。** 誤りの文言を出すかどうかは触れた項目だけを見ますが、進んで
 * よいかは入力そのもので決まります。開いた直後に空欄を赤くせず、しかし埋まるまでは進めない、
 * という組み合わせがこの 2 つの違いです。
 *
 * @param values - 入力中の値。触れていない項目は欠けている
 * @param fields - その段が尋ねる項目
 */
export function isStepComplete(
  values: Partial<ProfileInput>,
  fields: readonly ProfileField[],
): boolean {
  return fields.every((field) => profileSchema.shape[field].safeParse(values[field] ?? "").success);
}
