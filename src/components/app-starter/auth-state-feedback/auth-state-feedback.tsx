import type { ReactNode } from "react";
import { Button } from "@/components/design-system/action/button/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/design-system/status/alert/alert";
import { KeyIcon, LockIcon, SearchOffIcon } from "@/components/icon";
import {
  AUTH_STATE,
  AUTH_STATE_MESSAGE,
  AUTH_STATE_VARIANT,
  type AuthState,
} from "./auth-state-feedback.definition";

/** {@link AuthStateFeedback} の props。 */
export type AuthStateFeedbackProps = {
  /** 表示する状態。 */
  state: AuthState;
  /** 既定の見出しの差し替え。 */
  title?: string;
  /** 既定の説明の差し替え。 */
  description?: string;
  /** サインイン・復帰など、次に取る行動。 */
  children?: ReactNode;
};

function StateIcon({ state }: { state: AuthState }) {
  if (state === AUTH_STATE.FORBIDDEN) return <LockIcon aria-hidden="true" />;
  if (state === AUTH_STATE.NOT_FOUND) return <SearchOffIcon aria-hidden="true" />;

  return <KeyIcon aria-hidden="true" />;
}

/**
 * 認証・認可の状態と、そこから抜け出すための導線を表示する SSR first component。
 *
 * @remarks
 * 401 / 403 / 404 は再試行しても結果が変わらないため、`ApiErrorAlert` の再試行導線とは分けている。
 * 通信や処理そのものの失敗は `ApiErrorAlert` が扱い、この部品は「利用者が別の行動を取る必要が
 * ある状態」だけを扱う。
 *
 * 404 をここへ含めるのは、権限の無い資源の存在を伏せるために 403 ではなく 404 を返す運用が
 * あるためである。利用者から見た次の行動は 403 と同じく「戻る」になる。
 *
 * session の検証、権限の判定、status code の分類は持たない。`adapters/server` が正規化した結果を
 * feature が {@link AuthState} へ対応させて渡す。
 *
 * @example
 * ```tsx
 * <AuthStateFeedback state="session-expired">
 *   <AuthSignInAction href={signInHref} />
 * </AuthStateFeedback>
 * ```
 *
 * @param props.state - 表示する状態。
 * @param props.children - 次に取る行動。
 *
 * @see Storybook `Feedback/AuthStateFeedback`
 */
export function AuthStateFeedback({
  state,
  title = AUTH_STATE_MESSAGE[state].title,
  description = AUTH_STATE_MESSAGE[state].description,
  children,
}: AuthStateFeedbackProps) {
  return (
    <Alert data-state={state} variant={AUTH_STATE_VARIANT[state]}>
      <StateIcon state={state} />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>
        <p>{description}</p>
        {children}
      </AlertDescription>
    </Alert>
  );
}

/** {@link AuthSignInAction} の props。 */
export type AuthSignInActionProps = {
  /** サインインを開始する Route Handler の URL。 */
  href: string;
  /** 操作の文言。 */
  children?: ReactNode;
};

/**
 * サインインを開始する Route Handler へ遷移する導線。
 *
 * @remarks
 * `next/link` ではなく `a` を使う。サインインの開始は Route Handler(`/api/auth/*`)から IdP への
 * redirect であり、client 側の遷移では処理できないため、必ず document 遷移にする。
 *
 * `href` の組み立てと `returnUrl` の検証は呼び出し元が持つ。復帰先を外部 URL にできないよう、
 * 同一 origin の相対パスに限定するのは feature / adapter の責務である。
 *
 * @param props.href - サインインを開始する URL。
 *
 * @see Storybook `Feedback/AuthStateFeedback`
 */
export function AuthSignInAction({ href, children = "サインインする" }: AuthSignInActionProps) {
  return (
    <Button asChild>
      <a href={href}>{children}</a>
    </Button>
  );
}
