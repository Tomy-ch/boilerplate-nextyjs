"use client";

import { useCallback } from "react";

import { Button } from "@/components/design-system/action/button/button";
import { MessageCircleIcon } from "@/components/icon";
import { useToast } from "@/components/shell/toaster/toaster";

/** 問い合わせの受け口がまだ無いことを伝える文言。 */
const NOTICE = "チャット欄の作成までお待ちください";

/**
 * 在庫の無い商品について問い合わせる入口。
 *
 * @remarks
 * **押しても問い合わせは送られません。** 受け口はまだ無く、この操作が持っているのは入口の位置
 * だけです。それでも置くのは、在庫が無いと分かった時点で利用者が次にしたいことがここに現れる
 * ためで、入口が後から生えると、その場所を探す動線を作り直すことになります。
 *
 * 通知で返します。押した場所から視線を動かさずに読め、読み終わったら自分で消えます。画面を
 * 遷移させると、一覧の読み進めた位置ごと失われます。
 */
export function ProductContactButton() {
  const { toast } = useToast();
  const notify = useCallback(() => {
    toast({ title: NOTICE, duration: 5000 });
  }, [toast]);

  return (
    <Button onClick={notify} type="button" variant="outline">
      <MessageCircleIcon aria-hidden="true" className="size-4" />
      お問い合わせ
    </Button>
  );
}
