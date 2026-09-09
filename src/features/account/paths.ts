import { toSafeReturnUrl } from "@/model/return-url";

/** マイページ。global nav が直接指す。 */
export const MYPAGE_PATH = "/mypage";

/** プロフィール編集。マイページの下の階層に置く。 */
export const PROFILE_EDIT_PATH = "/mypage/edit";

/**
 * 登録（オンボーディング）。
 *
 * @remarks
 * マイページの下ではなく認証の側に置きます。ここを通る利用者はまだ利用者の記録を持たず、
 * マイページを含む保護された画面のどれも開けないためです。
 */
export const ONBOARDING_PATH = "/onboarding";

/**
 * 登録を促す行き先を組む。
 *
 * @remarks
 * 戻り先を必ず検証してから載せます。受け取った値をそのまま置くと、自サイトの導線で外部の URL へ
 * 送れます（open redirect）。検証は `model` が持ち、ここはその結果を URL へ組むだけです。
 *
 * @param returnTo - 登録後に戻す先。同一 origin の相対パスでなければ `/` へ倒れる
 */
export function onboardingPath(returnTo: string): string {
  return `${ONBOARDING_PATH}?returnUrl=${encodeURIComponent(toSafeReturnUrl(returnTo))}`;
}
