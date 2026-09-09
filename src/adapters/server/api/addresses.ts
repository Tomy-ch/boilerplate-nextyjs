import "server-only";

import { cache } from "react";
import type { z } from "zod";

import type { AddressCandidate, AddressLookup } from "@/model/user/user";

import { GetAddressesResponse } from "../../gen/api/endpoints.zod";
import { getPublicClient } from "./public-client";

type WireAddresses = z.infer<typeof GetAddressesResponse>;

/** 契約の応答を表示用の候補へ写す。`prefectureName` は `prefecture` へ改名する。 */
function toAddressCandidates(wire: WireAddresses): readonly AddressCandidate[] {
  return wire.candidates.map(({ prefectureName, city, town }) => ({
    prefecture: prefectureName,
    city,
    town,
  }));
}

/**
 * 郵便番号から住所を引く。
 *
 * @remarks
 * 認証を要しない公開の口です。登録の途中、まだ session を持たない利用者も同じ経路を通ります。
 *
 * **外部の lookup が落ちても失敗しません。** 契約は `503` ではなく空の候補と `isFallback: true` で
 * 返すと定めており、登録を止めないためです。
 *
 * **リクエストをまたぐキャッシュを持ちません。** 応答は落ちているときの形（`isFallback: true` と
 * 空の候補）も含むため、残すと外部の lookup が戻ったあとも空を配り続けます。鍵も郵便番号ごとに
 * 割れるので、再利用はほとんど起きないまま入れ物だけが増えます。マスタの口と分類は同じ public
 * でも、寿命の考え方が違います。
 *
 * `isFallback` は落とさずに運びます。該当なし（候補 0 件・`isFallback: false`）なら郵便番号を
 * 直せば埋まりますが、lookup 機構が動いていないなら何度引いても埋まりません。**画面が利用者へ
 * 言うべきことが変わる**ので、ここで両者を畳むと言い分けられなくなります。
 *
 * @param postalCode - `123-4567` 形式の郵便番号
 * @returns 候補と、lookup 機構が機能しなかったかどうか
 */
export const findAddresses = cache(async (postalCode: string): Promise<AddressLookup> => {
  const wire = await getPublicClient().request({
    path: "/v1/addresses",
    searchParams: { postalCode },
    schema: GetAddressesResponse,
  });

  return { candidates: toAddressCandidates(wire), isFallback: wire.isFallback };
});
