import Link from "next/link";

import { ContentContainer } from "@/components/shell/content-container/content-container";
import { getDefaultErrorMeta } from "@/errors/error-catalog";
import { ErrorKind } from "@/errors/error-kind";

/**
 * 購入完了の not-found 境界。
 *
 * @remarks
 * 表示だけを持ちます。文言は分類ごとに `errors` が持つため、ここで組み立てません。
 *
 * ここへ来るのは、指し先の無い URL で開かれたときと、他人の購入を指していたときです。契約が
 * 両者を区別しないため、この画面も区別しません。
 */
export default function CheckoutCompleteNotFound() {
  return (
    <ContentContainer className="flex flex-col items-start gap-4 py-8">
      <h1 className="font-emphasis text-xl">{getDefaultErrorMeta(ErrorKind.NOT_FOUND).message}</h1>
      <Link className="underline" href="/mypage">
        購入の控えを見る
      </Link>
    </ContentContainer>
  );
}
