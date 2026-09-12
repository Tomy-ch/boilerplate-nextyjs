import Link from "next/link";

import { Button } from "@/components/design-system/action/button/button";
import { MessageCircleIcon } from "@/components/icon";

import { INQUIRY_PATH } from "../../../../inquiry/facade/paths/paths";

/**
 * 在庫の無い商品について問い合わせる入口。
 *
 * @remarks
 * **どの商品かは引き継ぎません。** 問い合わせは利用者ごとに 1 件で、商品ごとの筋を持たない
 * ためです。何について尋ねているかは本文が示します。
 *
 * 遷移させるのは、送り先が画面だからです。一覧の読み進めた位置は戻る操作で戻ります。
 */
export function ProductContactButton() {
  return (
    <Button asChild variant="outline">
      <Link href={INQUIRY_PATH}>
        <MessageCircleIcon aria-hidden="true" className="size-4" />
        お問い合わせ
      </Link>
    </Button>
  );
}
