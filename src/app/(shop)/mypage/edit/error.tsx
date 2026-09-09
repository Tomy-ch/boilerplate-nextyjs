"use client";

import { ApiErrorAlert } from "@/components/app-starter/api-error-feedback/api-error-feedback";
import { ContentContainer } from "@/components/shell/content-container/content-container";
import { getDefaultErrorMeta } from "@/errors/error-catalog";
import { ErrorKind } from "@/errors/error-kind";

/**
 * プロフィール編集の error 境界。
 *
 * @remarks
 * マイページと別に置きます。`error.tsx` は同じセグメントの `layout.tsx` を包まないため、
 * 親の境界に任せると失敗した子だけでなく親のパンくずまで一緒に消えます。
 *
 * 文言はここで組み立てません。production では Server Component から投げられたエラーの本文が
 * 伏せられ、境界には `digest` しか渡らないためです。
 */
export default function ProfileEditError({
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
