import { PurchaseCode } from "@/adapters/server/api/purchases";
import type { RawSearchParams } from "@/model/search-params";
import { singleValue } from "@/model/search-params";

import { PURCHASE_PARAM } from "../paths";

const purchaseCodeSchema = singleValue(PurchaseCode);

/**
 * 完了画面が見せる購入を、検索条件から読む。
 *
 * @remarks
 * 契約が受け付ける形まで確かめます。手で書き換えられる値であり、確かめずに取得へ渡すと、契約が
 * 受け付けない文字列がそのまま外へ出ます（`docs/rules.md`「URL と条件」の「`searchParams` は
 * zod で検証する」—— 動的セグメントの `params` も同じ）。**照らす形は adapters が公開するものを
 * 使い、ここで書き直しません。**
 *
 * 同じ条件が繰り返されていたら読みません。どれを指しているのかを決める根拠が無く、先頭を採るのは
 * 推測になります。
 *
 * @returns 指している購入が読み取れなければ null
 */
export function readPurchaseCode(searchParams: RawSearchParams): string | null {
  const parsed = purchaseCodeSchema.safeParse(searchParams[PURCHASE_PARAM]);

  return parsed.success ? parsed.data : null;
}
