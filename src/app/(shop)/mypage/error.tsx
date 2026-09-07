"use client";

import { ApiErrorAlert } from "@/components/app-starter/api-error-feedback/api-error-feedback";
import { ContentContainer } from "@/components/shell/content-container/content-container";
import { getDefaultErrorMeta } from "@/errors/error-catalog";
import { ErrorKind } from "@/errors/error-kind";

/**
 * マイページの error 境界。
 *
 * @remarks
 * 置かないと、取得の失敗が `global-error.tsx` まで抜けます。あちらは root layout ごと壊れたときの
 * 最後の境界なので `html` と `body` を自前で描き、header も nav も footer も消えた画面になります。
 * 取得が 1 系統落ちただけで戻る導線ごと失うのは、この画面の失敗の重さに合いません。
 *
 * 文言はここで組み立てません。production では Server Component から投げられたエラーの本文が
 * 伏せられ、境界には `digest` しか渡らないためです。分類ごとの文言は `errors` が持ちます。
 */
export default function MypageError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ContentContainer className="py-8">
      <ApiErrorAlert
        error={{
          kind: "server",
          message: getDefaultErrorMeta(ErrorKind.INTERNAL).message,
          requestId: error.digest,
          retryable: true,
        }}
        onRetry={reset}
      />
    </ContentContainer>
  );
}
