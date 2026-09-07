import { z } from "zod";

import { type RawSearchParams, singleValue } from "@/model/search-params";

import { LOGIN_NOTICE, LOGIN_NOTICE_KEY, type LoginNotice } from "./facade/login-notice";

/**
 * URL を読む側。**組む側（[`login-notice.ts`](facade/login-notice.ts)）と分けてある**
 * （`docs/rules.md`「URL と条件」の「`searchParams` を読むスキーマは URL へ組む側と別の module へ置く」）。
 * 組むのは行き先を返す Route Handler です。
 */

/** 宣言に無い理由は、案内なしへ倒す。 */
const noticeSchema = singleValue(z.enum(LOGIN_NOTICE).nullable()).catch(null);

/**
 * 素の `searchParams` から、案内する理由を読む。
 *
 * @remarks
 * **知らない値は案内しません。** URL は利用者が直接編集できるため、載っている文字列を根拠に
 * 画面を変えると、任意の案内を出させる導線になります（`docs/rules.md`「URL と条件」の
 * 「`searchParams` は zod で検証する」）。
 *
 * @returns 案内する理由。宣言に無い値・繰り返された値・未指定なら null
 */
export function readLoginNotice(params: RawSearchParams): LoginNotice | null {
  return noticeSchema.parse(params[LOGIN_NOTICE_KEY]);
}
