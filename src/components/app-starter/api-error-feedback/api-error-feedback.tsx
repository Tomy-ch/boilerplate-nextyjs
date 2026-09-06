"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/design-system/action/button/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/design-system/overlay/alert-dialog/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/design-system/status/alert/alert";
import { AlertTriangleIcon, CircleXIcon } from "@/components/icon";

/**
 * {@link ApiErrorAlert} と {@link ApiErrorDialog} が表示できる形へ正規化した API 失敗。
 *
 * @remarks
 * status code の分類、raw response からの変換、再試行の可否判定は `errors/` と feature が行う。
 * この型は表示に必要な値だけを運び、利用者へ見せられない情報は含めない。
 */
export type ApiError = {
  /** 失敗の発生場所。`client` は 4xx 相当、`server` は 5xx 相当、`network` は到達不能を表す。 */
  kind: "client" | "server" | "network";
  /** 利用者へ表示する安全なメッセージ。raw response は渡さない。 */
  message: string;
  /** サポート照会用の不透明な識別子。token や個人情報は含めない。 */
  requestId?: string;
  /** 呼び出し側が再試行導線を提供できる場合に true。 */
  retryable?: boolean;
  /** 再試行可能になるまでの秒数。429 などで API が返した値を渡す。 */
  retryAfter?: number;
};

function getTitle(kind: ApiError["kind"]) {
  if (kind === "client") return "入力を確認してください";
  if (kind === "network") return "通信を確認してください";
  return "処理に失敗しました";
}

function ErrorIcon({ kind }: { kind: ApiError["kind"] }) {
  return kind === "client" ? (
    <AlertTriangleIcon aria-hidden="true" />
  ) : (
    <CircleXIcon aria-hidden="true" />
  );
}

/**
 * client-side API failure を文脈内へ表示する Alert。
 *
 * @see Storybook `Feedback/ApiErrorFeedback`
 */
export function ApiErrorAlert({
  children,
  error,
  onRetry,
  retryPending = false,
}: {
  /** 認証・遷移など feature 固有の補助操作。 */
  children?: ReactNode;
  error: ApiError;
  onRetry?: () => void;
  /** 再試行処理中はボタンを無効化する。 */
  retryPending?: boolean;
}) {
  return (
    <Alert variant={error.kind === "client" ? "warning" : "destructive"}>
      <ErrorIcon kind={error.kind} />
      <AlertTitle>{getTitle(error.kind)}</AlertTitle>
      <AlertDescription>
        {error.message}
        {error.requestId === undefined ? null : <p>問い合わせ ID: {error.requestId}</p>}
        {error.retryAfter === undefined ? null : (
          <span>再試行可能まで約 {error.retryAfter} 秒</span>
        )}
        {error.retryable && onRetry !== undefined ? (
          <Button disabled={retryPending} onClick={onRetry} type="button">
            {retryPending ? "再試行中…" : "再試行"}
          </Button>
        ) : null}
        {children}
      </AlertDescription>
    </Alert>
  );
}

/**
 * 操作継続を止める client-side API failure dialog。
 *
 * @see Storybook `Feedback/ApiErrorFeedback`
 */
export function ApiErrorDialog({
  children,
  error,
  onRetry,
  open,
  onOpenChange,
  retryPending = false,
}: {
  /** 認証・遷移など feature 固有の補助操作。 */
  children?: ReactNode;
  error: ApiError;
  onRetry?: () => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 再試行処理中はボタンを無効化する。 */
  retryPending?: boolean;
}) {
  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <ErrorIcon kind={error.kind} />
          <AlertDialogTitle>{getTitle(error.kind)}</AlertDialogTitle>
          <AlertDialogDescription>
            {error.message}
            {error.requestId === undefined ? null : <span>問い合わせ ID: {error.requestId}</span>}
            {error.retryAfter === undefined ? null : (
              <span>再試行可能まで約 {error.retryAfter} 秒</span>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>閉じる</AlertDialogCancel>
          {error.retryable && onRetry !== undefined ? (
            <Button disabled={retryPending} onClick={onRetry} type="button">
              {retryPending ? "再試行中…" : "再試行"}
            </Button>
          ) : null}
          {children}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
