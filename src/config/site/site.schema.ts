import { z } from "zod";

/** site purpose 専用の ENV validator を定義する。 */

/** `Origin` と同じ形（scheme + host + port、パス無し）か。 */
function isOrigin(value: string): boolean {
  try {
    return new URL(value).origin === value;
  } catch {
    return false;
  }
}

const publicOrigin = z.string().refine(isOrigin, {
  error: "http または https の origin（パス無し）を指定してください",
});

/**
 * 外から見たこのサイトの origin を検証する。
 *
 * @remarks
 * **パスを持たせません。** canonical / sitemap / OG 画像の絶対 URL はこの値へ経路を足して組み立てる
 * ため、パス付きの base を許すと `new URL("/about", base)` がそのパスを捨て、書いた人の意図と
 * 組み立ての結果が食い違います。サブパス配備が要るなら、テンプレートから作った側で組み立ての側ごと
 * 見直します。
 */
export function publicOriginValidator() {
  return publicOrigin;
}

const indexable = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value === undefined || value === "" ? "off" : value))
  .pipe(z.enum(["off", "on"]));

/**
 * 検索エンジンに索引させてよいかの指定を検証する。
 *
 * @remarks
 * **未設定と空文字はどちらも「索引させない」です。** 索引はいったん載ると取り下げに時間が掛かり、
 * 載せる側を既定にすると、設定を忘れた preview / staging が本番と並んで検索結果へ出ます。
 * 載せてよい環境だけが明示します（`docs/rules.md` #63）。
 */
export function indexableValidator() {
  return indexable;
}

export type SiteEnvironment = {
  SITE_PUBLIC_ORIGIN: z.infer<ReturnType<typeof publicOriginValidator>>;
  SITE_INDEXABLE: z.infer<ReturnType<typeof indexableValidator>>;
};
