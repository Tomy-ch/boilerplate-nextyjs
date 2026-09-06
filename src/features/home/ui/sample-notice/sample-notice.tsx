import Link from "next/link";

import { Button } from "@/components/design-system/action/button/button";
import {
  BUTTON_SIZE,
  BUTTON_VARIANT,
} from "@/components/design-system/action/button/button.definition";
import { Alert, AlertDescription, AlertTitle } from "@/components/design-system/status/alert/alert";
import { AlertTriangleIcon } from "@/components/icon";
import { TERMS_PATH } from "@/features/site-info/facade/paths/paths";
import { withPartSpan } from "@/observability/render-span";

/**
 * このサイトがサンプルであることの断り書き。
 *
 * @remarks
 * 実在しそうな商品名と企業名を並べている以上、書かないと実在の取引と取り違えられます。伝える
 * べきは 3 つで、**サンプルであること・掲載物が実在しないこと・購入と決済が機能しないこと**です。
 * これらは並べる商品が変わっても要るため、一覧やカードの側ではなくここが持ちます。
 *
 * 利用規約への導線を先頭に置きます。**閲覧した時点で同意とみなす**以上、同意の対象へ最初に
 * 届く必要があり、フッターまで下りないと辿れない位置では成立しません。
 *
 * 取得を待たずに出します。断り書きが本文より後に現れると、待っている間は普通の EC に見えます。
 *
 * 閉じる操作を置きません。閉じられる断り書きは、閉じた利用者に対しては無いのと同じです。
 */
export const SampleNotice = withPartSpan("features/home/ui/sample-notice/sample-notice", () => {
  return (
    <Alert variant="warning">
      <AlertTriangleIcon />
      <AlertTitle>サンプルサイトです</AlertTitle>
      <AlertDescription className="flex flex-col items-start gap-3">
        <p>
          掲載している商品や企業は実在せず、購入・決済も機能しません。
          <strong>このサイトを閲覧する場合、利用規約に同意したものとみなします。</strong>
        </p>
        <Button asChild size={BUTTON_SIZE.SMALL} variant={BUTTON_VARIANT.OUTLINE}>
          <Link href={TERMS_PATH}>利用規約</Link>
        </Button>
      </AlertDescription>
    </Alert>
  );
});
