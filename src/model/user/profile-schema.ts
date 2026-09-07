import * as z from "zod/mini";

/**
 * プロフィール入力の表示検証。
 *
 * @remarks
 * 手書きなのは、これが**表示のための規則**であって wire contract ではないためです。生成スキーマを
 * 入力検証へ持ち込むと、契約の型が `model` と feature へ漏れます。契約側の検証は `adapters` の
 * 境界が生成スキーマで別に行うので、ここが通っても契約破れは素通りしません。
 *
 * 上限は契約の**更新要求**側に合わせます。応答側はより緩い上限を宣言していますが、送って
 * 受け付けられない長さを入力させる理由がありません。
 *
 * 文言は項目名を主語にして書きます。エラーだけを読んでもどこを直せばよいか判るようにするためで、
 * 支援技術は項目から離れた位置で読み上げることがあります。
 */
export const profileSchema = z.object({
  firstName: z
    .string()
    .check(
      z.minLength(1, "名前を入力してください。"),
      z.maxLength(50, "名前は 50 文字以内で入力してください。"),
    ),
  lastName: z
    .string()
    .check(
      z.minLength(1, "名字を入力してください。"),
      z.maxLength(50, "名字は 50 文字以内で入力してください。"),
    ),
  email: z.pipe(
    z
      .string()
      .check(
        z.minLength(1, "メールアドレスを入力してください。"),
        z.maxLength(100, "メールアドレスは 100 文字以内で入力してください。"),
      ),
    z.email("メールアドレスの形式が正しくありません。"),
  ),
  phone: z
    .string()
    .check(
      z.minLength(1, "電話番号を入力してください。"),
      z.regex(/^\+?\d{10,15}$/, "電話番号はハイフンなしの 10〜15 桁で入力してください。"),
    ),
  postalCode: z
    .string()
    .check(
      z.minLength(1, "郵便番号を入力してください。"),
      z.regex(/^\d{3}-\d{4}$/, "郵便番号は 123-4567 の形式で入力してください。"),
    ),
  prefecture: z
    .string()
    .check(
      z.minLength(1, "都道府県を選択してください。"),
      z.maxLength(100, "都道府県は 100 文字以内で入力してください。"),
    ),
  city: z
    .string()
    .check(
      z.minLength(1, "市区町村を入力してください。"),
      z.maxLength(100, "市区町村は 100 文字以内で入力してください。"),
    ),
  street: z
    .string()
    .check(
      z.minLength(1, "丁目・番地を入力してください。"),
      z.maxLength(200, "丁目・番地は 200 文字以内で入力してください。"),
    ),
  building: z.string().check(z.maxLength(200, "建物名は 200 文字以内で入力してください。")),
});

/** {@link profileSchema} を通した入力。 */
export type ProfileInput = z.infer<typeof profileSchema>;

/** 入力欄として現れる項目名。項目エラーのキーになる。 */
export type ProfileField = keyof ProfileInput;

/**
 * 空欄を受け付けない項目かを返す。
 *
 * @remarks
 * 必須かどうかを列挙せず、スキーマへ空文字を通して判定します。列挙すると、規則を緩めたのに
 * 画面が必須のままという状態を作れます。**印と検証の出所を 1 つにするための判定**です。
 */
export function isRequiredProfileField(field: ProfileField): boolean {
  return !profileSchema.shape[field].safeParse("").success;
}
