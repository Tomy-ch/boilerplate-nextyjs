import Link from "next/link";

import { ContentContainer } from "@/components/shell/content-container/content-container";
import { getDefaultErrorMeta } from "@/errors/error-catalog";
import { ErrorKind } from "@/errors/error-kind";

/**
 * 商品詳細の not-found 境界。
 *
 * @remarks
 * 表示だけを持ちます。文言は分類ごとに `errors` が持つため、ここで組み立てません。
 */
export default function ProductDetailNotFound() {
  return (
    <ContentContainer className="flex flex-col items-start gap-4 py-8">
      <h1 className="text-xl font-emphasis">{getDefaultErrorMeta(ErrorKind.NOT_FOUND).message}</h1>
      <Link className="underline" href="/products">
        商品一覧へ戻る
      </Link>
    </ContentContainer>
  );
}
