import { Button } from "@/components/design-system/action/button/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/design-system/display/card/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/design-system/status/alert/alert";
import type { SafeReturnUrl } from "@/model/return-url";

import { LOGIN_NOTICE, type LoginNotice } from "./facade/login-notice";

/** 理由ごとの案内。 */
const NOTICE_TEXT = {
  [LOGIN_NOTICE.UNAVAILABLE]: {
    title: "認証を始められませんでした",
    description: "認証基盤へ接続できませんでした。しばらく待ってから、もう一度お試しください。",
  },
} as const satisfies Readonly<Record<LoginNotice, { title: string; description: string }>>;

/**
 * 画面の説明。折り返しが半角空白として描かれないよう、1 つの文字列へ結合して渡す。
 *
 * @remarks
 * JSX の本文へ直に書くと、和文では語の途中に空白が入って見えます。
 */
const DESCRIPTION = [
  "操作を続けるには認証が必要です。",
  "認証はこのアプリの外にある認証基盤で行い、済むと元の操作に戻ります。",
  "この画面ではアカウントを作らず、初めての方も認証を済ませてから登録へ進みます。",
].join("");

/** `LoginView` の props。 */
export type LoginViewProps = {
  /**
   * 認証後に戻る先。
   *
   * @remarks
   * この画面は受け取った値をそのまま送り出すだけで、妥当性は判断しません。検証済みで
   * あることは型が示します（`toSafeReturnUrl`）。
   */
  returnUrl: SafeReturnUrl;
  /**
   * この画面へ戻された理由。無ければ null。
   *
   * @remarks
   * 判断済みの分類だけを受け取ります。URL に載っていた文字列をそのまま渡すと、この画面が
   * 検証の場所になります（検証は route segment が持ちます）。
   */
  notice: LoginNotice | null;
};

/**
 * 資格情報を受け取らず、認証基盤の画面へ送り出すログインの器。
 *
 * @remarks
 * 入力欄を持たないのは、既定の Resolver が
 * federation（連携先での認可）の形を採っており、借り物の画面へ渡す経路になっているためです。
 *
 * **目標は所有画面です。** `/login` が資格情報の入力面を所有し、検証だけをバックエンドへ
 * 中継する —— 利用者が見知らぬドメインへ着地しない 1 本の導線にします。**実装はまだそこへ
 * 届いていません。** 入力欄を足すときも、このリポジトリが資格情報を検証・保持しないことは
 * 変わりません。
 *
 * 説明と案内の文言の方針は[画面要件](../../../docs/spec/route/auth/login/page.screen.md)。
 *
 * リンクではなく form にしてあります。認証の開始は状態を作る操作（一時状態の cookie を置く）で
 * あり、リンクにすると prefetch や先読みで**利用者が押していないのに始まります**。同じ理由で
 * `next/link` も使いません。
 *
 * **面の見出しを `h1` として描きます。** `CardTitle` は見た目だけを持つので、文書構造上の見出しは
 * 呼び出し元が子として渡します。この画面は `PageHeader` を持たないため、ここが唯一の h1 です。
 */
export function LoginView({ returnUrl, notice }: LoginViewProps) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-12">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>
            <h1>ログイン</h1>
          </CardTitle>
          <CardDescription>{DESCRIPTION}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {notice === null ? null : (
            <Alert variant="destructive">
              <AlertTitle>{NOTICE_TEXT[notice].title}</AlertTitle>
              <AlertDescription>
                <p>{NOTICE_TEXT[notice].description}</p>
              </AlertDescription>
            </Alert>
          )}
          <form action="/api/auth/login" method="get">
            <input type="hidden" name="returnUrl" value={returnUrl} />
            <Button type="submit" className="w-full">
              ログインへ進む
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
