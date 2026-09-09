"use client";

import { ContentContainer } from "@/components/shell/content-container/content-container";
import { getDefaultErrorMeta } from "@/errors/error-catalog";
import { ErrorKind } from "@/errors/error-kind";
import { ProductListError } from "@/features/products/list/ui/error-state/error-state";

/**
 * 商品一覧の error 境界。
 *
 * @remarks
 * 文言はここで組み立てません。production では Server Component から投げられたエラーの本文が
 * 伏せられ、境界には `digest` しか渡らないためです。分類ごとの文言は `errors` が持ちます。
 */
export default function ProductsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ContentContainer className="py-8">
      <ProductListError
        message={getDefaultErrorMeta(ErrorKind.INTERNAL).message}
        digest={error.digest}
        onRetry={reset}
      />
    </ContentContainer>
  );
}
