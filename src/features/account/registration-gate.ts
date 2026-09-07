import { redirect } from "next/navigation";

import { findRegistration } from "@/adapters/server/api/users";
import { loginPath } from "@/features/auth/facade/paths";
import { toSafeReturnUrl } from "@/model/return-url";

import { onboardingPath } from "./paths";

/**
 * 利用者として登録済みの主体であることを、画面を描く前に確かめる。
 *
 * @remarks
 * **保護された画面の入口はここを通します。** 各画面が同じ判定を書き写すと、条件が 1 箇所ずつ
 * ずれていきます。判定そのもの（session の検証と登録の有無）は `adapters` が持ち、ここが持つのは
 * **入れなかった主体をどこへ送るか**だけです。
 *
 * 認証と登録で送り先を分けます。ログインでは登録は済まず、登録は認証されていないと始められない
 * ためです。
 *
 * 判定に要る取得と、その費用は [README](./README.md) の運用が持ちます。
 *
 * @param returnTo - 認証・登録を終えた利用者を戻す先
 */
export async function requireRegisteredUser(returnTo: string): Promise<void> {
  const registration = await findRegistration();

  if (registration === "unauthenticated") {
    redirect(loginPath(returnTo));
  }

  if (registration === "unregistered") {
    redirect(onboardingPath(returnTo));
  }
}

/**
 * まだ登録していない主体であることを、登録画面を描く前に確かめる。
 *
 * @remarks
 * {@link requireRegisteredUser} の裏返しです。登録済みの主体を登録画面へ留めると、2 人目の
 * 利用者を作る操作を見せることになります。
 *
 * 認証は要求します。誰の登録なのかが決まらないまま入力させても、送る先がありません。
 *
 * @param returnTo - 登録済みだった場合に送る先
 */
export async function requireUnregisteredUser(returnTo: string): Promise<void> {
  const registration = await findRegistration();

  if (registration === "unauthenticated") {
    // 戻り先は登録画面の内側へ入れて渡す。ここで捨てると、認証をやり直した利用者は登録を終えた
    // 後に元居た場所へ戻れない —— 登録画面自身が戻り先を検索条件で受け取るためである。
    redirect(loginPath(onboardingPath(returnTo)));
  }

  if (registration === "registered") {
    redirect(toSafeReturnUrl(returnTo));
  }
}
