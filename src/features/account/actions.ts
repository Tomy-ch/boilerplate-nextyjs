"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { registerUser, updateMyProfile, withdrawMe } from "@/adapters/server/api/users";
import { findAppError } from "@/errors/app-error";
import { ErrorKind } from "@/errors/error-kind";
import {
  actionStateFromError,
  failedActionState,
  succeededActionState,
} from "@/model/action-state";
import type { ProfileFormState, WithdrawFormState } from "./form-state";
import { parseRegistrationForm } from "./onboarding/parse-registration-form";
import { parseProfileForm } from "./parse-profile-form";
import { MYPAGE_PATH } from "./paths";
import { toProfileFieldErrors } from "./profile-rejection";

const INVALID_INPUT_MESSAGE = "入力内容を確認してください。";
const BROKEN_REQUEST_MESSAGE = "登録の要求を受け取れませんでした。画面を開き直してください。";
const REGISTER_CONFLICT_MESSAGE =
  "この内容では登録できませんでした。すでに登録が済んでいるか、他の登録と重複しています。";
const WITHDRAW_CONFLICT_MESSAGE =
  "進行中の購入が残っているため退会できません。購入が完了またはキャンセルされてから、もう一度お試しください。";

/**
 * 接続先が項目を名指しして拒んだときの状態。
 *
 * @remarks
 * 送る前の検証が弾いたときと同じ形（フォーム全体の文言 + 項目ごとの文言）を返します。画面はどちらで
 * 弾かれたかを知らずに出せます。
 *
 * **名指しが 1 つも読めなければ何も返しません。**この画面の入力欄に結び付かない名前だけを受け取った
 * 場合で、そのまま鍵にすると、どこにも出ない文言を状態へ入れることになります。分類ごとの文言は
 * 呼び出し元が {@link actionStateFromError} で付けます。
 *
 * @param error 送信で投げられたエラー
 * @returns 名指しがあれば失敗の状態。無ければ undefined
 */
function rejectedFieldsState(error: unknown): ProfileFormState | undefined {
  const fieldErrors = toProfileFieldErrors(error);

  return Object.keys(fieldErrors).length === 0
    ? undefined
    : failedActionState({ formError: INVALID_INPUT_MESSAGE, fieldErrors });
}

/**
 * プロフィールを更新する。
 *
 * @remarks
 * 入力の読み取りと検証は `parseProfileForm` が持ちます。ここが持つのは**編成**だけで、解いて、
 * 渡して、結果を分類します。
 *
 * 成功しても画面を移しません。フォームの文脈に留まる保存なので、通知は toast が担います。
 * マイページ側は次に開いたときに新しい内容が出るよう、ここで再検証を要求しておきます。
 */
export async function updateProfileAction(
  _previous: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const parsed = parseProfileForm(formData);

  if (!parsed.ok) {
    return failedActionState({
      formError: INVALID_INPUT_MESSAGE,
      fieldErrors: parsed.fieldErrors,
    });
  }

  try {
    await updateMyProfile(parsed.profile);
  } catch (error) {
    return rejectedFieldsState(error) ?? actionStateFromError(error);
  }

  revalidatePath(MYPAGE_PATH);

  return succeededActionState(undefined);
}

/**
 * 利用者として登録する。
 *
 * @remarks
 * 成立したら戻り先へ送ります。登録は画面に留まる操作ではなく、**登録を終えて初めて開ける画面**
 * があるためです。戻り先は保護された画面で弾かれた利用者が元居た場所で、画面が hidden で
 * 載せています。
 *
 * 冪等キーは画面が載せたものをそのまま渡します（`newIdempotencyKey`）。
 *
 * `409` にだけ専用の文言を当てます。契約は既存の利用者との競合をこの分類で返すため、カタログの
 * 既定文言（分類だけを伝える）よりも、この画面でしか言えないことがあります。
 */
export async function registerAction(
  _previous: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const parsed = parseRegistrationForm(formData);

  if (parsed.status === "broken-request") {
    return failedActionState({ formError: BROKEN_REQUEST_MESSAGE });
  }

  if (parsed.status === "invalid-input") {
    return failedActionState({
      formError: INVALID_INPUT_MESSAGE,
      fieldErrors: parsed.fieldErrors,
    });
  }

  try {
    await registerUser(parsed.profile, parsed.idempotencyKey);
  } catch (error) {
    if (findAppError(error)?.kind === ErrorKind.CONFLICT) {
      return failedActionState({ formError: REGISTER_CONFLICT_MESSAGE });
    }

    return rejectedFieldsState(error) ?? actionStateFromError(error);
  }

  redirect(parsed.returnUrl);
}

/**
 * 退会する。
 *
 * @remarks
 * 成立したら手元に残るものが何も無いのでトップへ送ります。session はこの時点で既に破棄されて
 * いるため、保護されたルートへは戻れません。
 *
 * **{@link withdrawMe} が返す送り先を経由してから戻します。** 経由する先を持たない IdP なら
 * 直接トップへ送ります。
 *
 * `409` にだけ専用の文言を当てます。カタログの既定文言は分類だけを伝えるもので、退会が
 * 通らなかった理由が進行中の購入であることは、この画面でしか言えません。
 */
export async function withdrawAction(
  _previous: WithdrawFormState,
  _formData: FormData,
): Promise<WithdrawFormState> {
  let destination: string | null;

  try {
    destination = await withdrawMe();
  } catch (error) {
    if (findAppError(error)?.kind === ErrorKind.CONFLICT) {
      return failedActionState({ formError: WITHDRAW_CONFLICT_MESSAGE });
    }

    return actionStateFromError(error);
  }

  redirect(destination ?? "/");
}
