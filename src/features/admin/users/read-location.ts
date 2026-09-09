import { z } from "zod";

import { type RawSearchParams, singleValue } from "@/model/search-params";

import { type AdminUserListLocation, FIRST_PAGE, USER_LIST_KEY, USER_SCOPE } from "./query";

/**
 * URL を読む側。**組む側（[`query.ts`](query.ts)）と分けてある**（`docs/rules.md`「URL と条件」の
 * 「`searchParams` を読むスキーマは URL へ組む側と別の module へ置く」）。組むのは選択欄やページ送りといった client の部品です。
 */

/** 範囲を読むスキーマ。宣言に無い名前は既定へ倒す。 */
const scopeSchema = singleValue(z.enum(USER_SCOPE)).catch(USER_SCOPE.ALL);

/**
 * ページ番号を読むスキーマを、契約が許す上限つきで組む。
 *
 * @remarks
 * 上限は契約が決めるため、外から受け取ります（`adapters` が公開する）。ここで数字を持つと、契約を
 * 再生成しても画面側だけが古い範囲のまま残ります。**下限だけを見ると、上限を超えたページ番号が
 * そのまま取得へ渡り、一覧の代わりにエラー面が出ます。**
 */
function pageSchema(pageMax: number) {
  return singleValue(z.coerce.number().int().min(FIRST_PAGE).max(pageMax)).catch(FIRST_PAGE);
}

/**
 * 素の `searchParams` を、いま見ている場所として読む。
 *
 * @remarks
 * **URL は利用者が直接編集できます。** 読めない範囲・読めないページ番号は既定へ倒します。契約が
 * 拒む値をそのまま送っても得られるのは `400` だけで、押した人にできることがありません。
 *
 * 判定はスキーマが持ちます（`docs/rules.md`「URL と条件」の「`searchParams` は zod で検証する」）。
 * 手で条件を並べると、契約が宣言している制約のどれを見ていないのかが読み取れません。
 *
 * @param pageMax - 契約が許すページ番号の上限
 */
export function toAdminUserListLocation(
  params: RawSearchParams,
  pageMax: number,
): AdminUserListLocation {
  return {
    scope: scopeSchema.parse(params[USER_LIST_KEY.SCOPE]),
    page: pageSchema(pageMax).parse(params[USER_LIST_KEY.PAGE]),
  };
}
