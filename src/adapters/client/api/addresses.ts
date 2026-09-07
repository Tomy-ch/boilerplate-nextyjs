import * as z from "zod/mini";

import type { AddressLookup } from "@/model/user/user";

import { request } from "../http/request";

/**
 * BFF が返す結果の形。
 *
 * @remarks
 * 契約から生成したスキーマではありません。`/api/addresses` が組み立てた表示用の形を受け取るため
 * です。検証する理由は `api/products.ts` の同種のスキーマと同じです。
 */
const AddressLookupPayload = z.object({
  candidates: z.array(z.object({ prefecture: z.string(), city: z.string(), town: z.string() })),
  isFallback: z.boolean(),
});

/** 引けなかったときの結果。候補は無いが、lookup 機構が壊れているとまでは言えない。 */
const NOT_FOUND: AddressLookup = { candidates: [], isFallback: false };

/**
 * 郵便番号から住所を引く。
 *
 * @remarks
 * 同一オリジンの `/api/addresses` を {@link request} で叩くだけです。
 *
 * **失敗を投げません。** 補完は入力を助けるためのもので、引けなかったときにすることは
 * 「何もしない」です。呼び出し側に握り潰しの判断を配ると、画面ごとに扱いが割れます。
 *
 * **投げられた失敗を `isFallback` へ読み替えません。** この口の失敗には形の誤り（`400`）も
 * 打ち切りも含まれ、lookup 機構が動いていないと断じられるのは backend がそう宣言したときだけ
 * です。判らないものを「機構が壊れている」と伝えると、郵便番号を直せば済む利用者にまで
 * 全項目の手入力を促すことになります。
 *
 * @param postalCode - `123-4567` 形式の郵便番号
 * @param signal - 入力が続いた、または画面を離れたときに取得を打ち切る
 * @returns 候補と、lookup 機構が機能しなかったかどうか。引けなかったときは候補なし
 */
export async function fetchAddresses(
  postalCode: string,
  signal?: AbortSignal,
): Promise<AddressLookup> {
  try {
    return await request(
      `/api/addresses?postalCode=${encodeURIComponent(postalCode)}`,
      AddressLookupPayload,
      signal,
    );
  } catch {
    return NOT_FOUND;
  }
}
