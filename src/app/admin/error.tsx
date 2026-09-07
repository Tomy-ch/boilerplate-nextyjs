"use client";

import { ContentContainer } from "@/components/shell/content-container/content-container";
import { getDefaultErrorMeta } from "@/errors/error-catalog";
import { ErrorKind } from "@/errors/error-kind";
import { AdminScreenError } from "@/features/admin/ui/error-state/error-state";

/**
 * 管理画面の error 境界。
 *
 * @remarks
 * `/admin` の直下へ置きます。ここが無いと配下の取得の失敗が `global-error` まで抜け、
 * 脇の導線も header も失われた素の画面になります。
 *
 * 文言はここで組み立てません。production では Server Component から投げられたエラーの本文が
 * 伏せられ、境界には `digest` しか渡らないためです。分類ごとの文言は `errors` が持ちます。
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ContentContainer className="py-8">
      <AdminScreenError
        message={getDefaultErrorMeta(ErrorKind.INTERNAL).message}
        digest={error.digest}
        onRetry={reset}
      />
    </ContentContainer>
  );
}
