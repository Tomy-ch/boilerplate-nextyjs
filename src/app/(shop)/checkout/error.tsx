"use client";

import { ApiErrorAlert } from "@/components/app-starter/api-error-feedback/api-error-feedback";
import { ContentContainer } from "@/components/shell/content-container/content-container";
import { getDefaultErrorMeta } from "@/errors/error-catalog";
import { ErrorKind } from "@/errors/error-kind";

/**
 * 購入確認の error 境界。
 *
 * @remarks
 * 置かないと、取得の失敗が `global-error.tsx` まで抜けます。あちらは root layout ごと壊れたときの
 * 最後の境界なので、header も nav も消えた画面になります。
 *
 * この境界は**確定の前後どちらの失敗も受けません**。確定の失敗は Server Action が結果として
 * 返し、操作の隣に出ます。ここへ来るのは、確かめる内容そのものを読めなかったときです。
 *
 * 文言はここで組み立てません。production では Server Component から投げられたエラーの本文が
 * 伏せられ、境界には `digest` しか渡らないためです。
 */
export default function CheckoutError({
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
