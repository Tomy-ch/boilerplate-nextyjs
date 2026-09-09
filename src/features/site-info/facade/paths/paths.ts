/**
 * この feature が持つルート。
 *
 * @remarks
 * `facade` へ置くのは、マイページ（別の feature）がこの 2 つを指すためです。feature どうしは
 * 直接 import できず、公開する口だけをここへ出します。
 */

/** このサイトについて。 */
export const ABOUT_PATH = "/about";

/** プライバシーポリシー。 */
export const PRIVACY_PATH = "/privacy";

/** 利用規約。 */
export const TERMS_PATH = "/terms";
