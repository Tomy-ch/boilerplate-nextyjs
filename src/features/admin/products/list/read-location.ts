import { z } from "zod";

import { type RawSearchParams, repeatedValues, singleValue } from "@/model/search-params";

import { type AdminProductListLocation, CURSOR_KEY, FILTER_KEY, TRAIL_KEY } from "./query";

/**
 * URL を読む側。**組む側（[`query.ts`](query.ts)）と分けてある。**
 *
 * @remarks
 * 読むのは画面を組み立てる地点だけで、組むのは絞り込みの入力欄といった client の部品です。同じ
 * module に置くと、スキーマを組み立てる module 直下の式が tree-shaking を妨げ、**検証ライブラリごと
 * client の束に載ります**（[0101](../../../../../docs/adr/0101-performance-budget.md)）。境界を
 * 強制しているのは束であって、読みやすさではありません。
 */

/** 1 つしか受け取らない条件。読めなければ未指定（空文字）として扱う。 */
const textSchema = singleValue(z.string()).catch("");

/**
 * 複数を選べる条件。
 *
 * @remarks
 * **重複を畳みます。** 契約は重複の無い並びとして宣言しており、同じ値が 2 度届くのは URL を直接
 * 編集したときで、指している条件は 1 度のときと同じです。畳まないと、意味の同じ条件が契約を外れた
 * 要求として backend まで届きます。並び順は最初に現れた位置を保ちます。
 */
const codesSchema = repeatedValues(
  z.array(z.string()).transform((values): readonly string[] => [...new Set(values)]),
).catch([]);

/**
 * 通ってきたページの起点。
 *
 * @remarks
 * **重複を畳みません。** 並びの長さがそのまま戻れる段数で、`toPreviousPageHref` が末尾から 1 つずつ
 * 取り出します。同じ起点が 2 度並ぶのは 2 段ぶんであり、畳むと戻れる回数が変わります。
 */
const cursorsSchema = repeatedValues(z.array(z.string())).catch([]);

/**
 * 素の `searchParams` を、いま見ている場所として読む。
 *
 * @remarks
 * **URL は利用者が直接編集できます。** 起点が消えているのに通ってきた道だけが残った URL も届き得る
 * ため、先頭ページでは道を捨てます。捨てないと、先頭ページで「前へ」が押せる状態になります。
 *
 * 読み方はスキーマが持ちます（`docs/rules.md`「URL と条件」の「`searchParams` は zod で検証する」）。
 * 1 つしか受け取らない条件が繰り返されていたら未指定として扱い、複数を選べる条件だけが並びのまま残ります。
 */
export function toAdminProductListLocation(params: RawSearchParams): AdminProductListLocation {
  const cursor = textSchema.parse(params[CURSOR_KEY]);

  return {
    keyword: textSchema.parse(params[FILTER_KEY.KEYWORD]),
    categoryCodes: codesSchema.parse(params[FILTER_KEY.CATEGORY]),
    statusCodes: codesSchema.parse(params[FILTER_KEY.STATUS]),
    cursor: cursor === "" ? null : cursor,
    trail: cursor === "" ? [] : cursorsSchema.parse(params[TRAIL_KEY]),
  };
}
