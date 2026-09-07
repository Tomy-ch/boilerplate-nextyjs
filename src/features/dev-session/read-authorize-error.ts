import { z } from "zod";

import { type RawSearchParams, singleValue } from "@/model/search-params";

import { AUTHORIZE_ERROR, AUTHORIZE_ERROR_PARAM, type AuthorizeError } from "./authorize-error";

/**
 * URL を読む側。**組む側（[`authorize-error.ts`](authorize-error.ts)）と分けてある**
 * （`docs/rules.md`「URL と条件」の「`searchParams` を読むスキーマは URL へ組む側と別 module へ
 * 置く」）。組むのは認可の応答を返す Route Handler の側です。
 */

/** 宣言に無い理由は、案内なしへ倒す。 */
const errorSchema = singleValue(z.enum(AUTHORIZE_ERROR).nullable()).catch(null);

/**
 * 素の `searchParams` から、案内する理由を読む。
 *
 * @remarks
 * **知らない値は案内しません。** URL は利用者が直接編集できるため、載っている文字列を根拠に
 * 画面を変えると、任意の案内を出させる導線になります。
 *
 * @returns 案内する理由。宣言に無い値・繰り返された値・未指定なら null
 */
export function readAuthorizeError(params: RawSearchParams): AuthorizeError | null {
  return errorSchema.parse(params[AUTHORIZE_ERROR_PARAM]);
}
