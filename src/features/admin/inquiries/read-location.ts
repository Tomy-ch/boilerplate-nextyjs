import { z } from "zod";

import { type RawSearchParams, repeatedValues, singleValue } from "@/model/search-params";

import { type AdminInquiryListLocation, CURSOR_KEY, TRAIL_KEY } from "./query";

/**
 * URL を読む側。**組む側（[`query.ts`](query.ts)）と分けてある。**
 *
 * @remarks
 * 分ける理由は商品一覧（[`../products/list/read-location.ts`](../products/list/read-location.ts)）と
 * 同じで、読む地点と組む地点が別の束に載るためです。
 */

/** 1 つしか受け取らない条件。読めなければ未指定（空文字）として扱う。 */
const textSchema = singleValue(z.string()).catch("");

/**
 * 通ってきたページの起点。
 *
 * @remarks
 * **重複を畳みません。** 並びの長さがそのまま戻れる段数で、同じ起点が 2 度並ぶのは 2 段ぶんです。
 */
const cursorsSchema = repeatedValues(z.array(z.string())).catch([]);

/**
 * 素の `searchParams` を、いま見ている場所として読む。
 *
 * @remarks
 * **URL は利用者が直接編集できます。** 起点が消えているのに通ってきた道だけが残った URL も
 * 届き得るため、先頭ページでは道を捨てます。捨てないと、先頭ページで「前へ」が押せる状態に
 * なります。
 */
export function toAdminInquiryListLocation(params: RawSearchParams): AdminInquiryListLocation {
  const cursor = textSchema.parse(params[CURSOR_KEY]);

  return {
    cursor: cursor === "" ? null : cursor,
    trail: cursor === "" ? [] : cursorsSchema.parse(params[TRAIL_KEY]),
  };
}
