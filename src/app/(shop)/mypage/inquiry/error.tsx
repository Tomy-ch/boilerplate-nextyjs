"use client";

import { ApiErrorAlert } from "@/components/app-starter/api-error-feedback/api-error-feedback";
import { ContentContainer } from "@/components/shell/content-container/content-container";
import { getDefaultErrorMeta } from "@/errors/error-catalog";
import { ErrorKind } from "@/errors/error-kind";

/**
 * 問い合わせの error 境界。
 *
 * @remarks
 * 置く理由と、文言をここで組み立てない理由は、マイページの境界（`../error.tsx`）と同じです。
 * 別に置くのは、やり取りの取得が落ちたときに戻る導線ごと失わないためです。
 */
export default function InquiryError({
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
