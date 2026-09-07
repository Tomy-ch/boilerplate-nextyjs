import type { Metadata } from "next";

import { LoginView } from "@/features/auth/login-view";
import { readLoginNotice } from "@/features/auth/read-login-notice";
import { toSafeReturnUrl } from "@/model/return-url";
import type { RawSearchParams } from "@/model/search-params";

export const metadata: Metadata = {
  title: "ログイン",
  description: "認証を始めます。資格情報の入力は認証基盤の画面で行われます。",
  robots: { index: false, follow: false },
};

/**
 * 待たずに配れる殻を持たない画面として宣言する。
 *
 * @remarks
 * 見えるもの（戻された理由の案内と、復帰先を載せた送信）が両方とも `searchParams` で決まります。
 * 分けても殻に残るのはカードの見出しだけで、待機表示と入れ替わる回数が増えるだけです。
 *
 * **これは「まだ手を付けていない」印ではありません。** 分けたうえで得られるものが無いという
 * 判断であり、この画面の構造が変わらない限り外れません。
 */
export const instant = false;

/**
 * ログイン。
 *
 * @remarks
 * 復帰先は URL から受け取るため、検索エンジンに拾わせません。同じ画面が復帰先の数だけ
 * 別 URL として索引され、そのどれもが単独では意味を持たないためです。
 *
 * `searchParams` は `readLoginNotice` / `toSafeReturnUrl` を通した検証済みの値だけを画面へ
 * 渡します。何を通すかはそれぞれの doc が持ちます。
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const params = await searchParams;
  const { returnUrl } = params;

  return (
    <LoginView
      returnUrl={toSafeReturnUrl(typeof returnUrl === "string" ? returnUrl : null)}
      notice={readLoginNotice(params)}
    />
  );
}
