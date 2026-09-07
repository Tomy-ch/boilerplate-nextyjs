import "server-only";

import { cache } from "react";

import { getMyCart } from "@/adapters/server/api/cart";
import { getLogger, reportQuietly } from "@/logging/logging.server";
import type { Cart } from "@/model/cart/cart";

/**
 * 外枠に出すカートを読む。取得に失敗しても投げない。
 *
 * @remarks
 * **外枠は配下のすべての画面に出ます。** ここで投げると、カートと無関係な画面まで巻き添えにして
 * 落ちます。しかも同じ段の layout が投げた例外は子の `error` 境界では捕まらないため、握るなら
 * この層しかありません。
 *
 * **空のカートとして返しません。** 「空」と「読めなかった」は別の状態で、混ぜると利用者には
 * カートが勝手に空になったように見えます。読めなかったことは外枠がカートを出さないことで表し、
 * 理由はカートの画面（自分で取り直し、失敗すれば `error` 境界が受ける）が示します。
 *
 * **握りごと 1 リクエストに畳みます。** 外枠はカートを複数の口から読むため、畳まないと 1 度の
 * 失敗に対して警告が口の数だけ出ます。取得自体は `getMyCart` が畳んでいますが、`catch` は
 * 呼び出しごとに走るので、畳む場所はここでなければなりません。
 *
 * @returns 読めなければ null
 */
export const readShellCart = cache(async (): Promise<Cart | null> => {
  try {
    return await getMyCart();
  } catch (cause) {
    reportQuietly(() =>
      getLogger().warn("外枠に出すカートを読めませんでした", { cause: String(cause) }),
    );

    return null;
  }
});
