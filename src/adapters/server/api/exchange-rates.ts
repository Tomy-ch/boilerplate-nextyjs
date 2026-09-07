import "server-only";

import { getApiConfig } from "@/config/api/api.server";
import { getHttpConfig } from "@/config/http/http.server";
import { getLogger, reportQuietly } from "@/logging/logging.server";
import { BASE_CURRENCY, type ReferenceAmount } from "@/model/money";

import { GetExchangeRatesResponse } from "../../gen/api/endpoints.zod";
import { getAccessToken } from "../auth/session";
import { createHttpClient, type UserScopedHttpClient } from "../http/request";

/** 参考換算に使える表示通貨。契約が受け付ける値そのもの。 */
const DISPLAY_CURRENCY = "JPY";

/** 基準通貨 1 単位あたりの最小単位の数。契約が decimal 文字列を要求するため、ここで主単位へ戻す。 */
const MINOR_UNITS_PER_UNIT = 100;

/** 基準通貨の小数桁。 */
const MINOR_UNIT_DIGITS = 2;

let client: UserScopedHttpClient | undefined;

/**
 * 為替の接続先。
 *
 * @remarks
 * 認証を任意にします。参考換算は購入前の利用者にも要るため、契約が資格情報の無い呼び出しも
 * 受け付けます。
 */
function getClient(): UserScopedHttpClient {
  client ??= createHttpClient({
    scope: "user-scoped",
    baseUrl: getApiConfig().baseUrl,
    maxUrlBytes: getHttpConfig().maxUrlBytes,
    getBearerToken: getAccessToken,
    allowAnonymous: true,
  });

  return client;
}

/**
 * 基準通貨の金額を、表示通貨での参考換算額へ写す。
 *
 * @remarks
 * **参考換算額は請求額ではありません。** 保存される金額は基準通貨のままで、この値は表示にしか
 * 使いません。
 *
 * 換算できなかった場合（レートの提供元が表示通貨を持たない等）は契約が `null` を返します。
 * 通信そのものが失敗した場合は投げます。**画面が使う口はこちらではなく {@link readReferenceAmount}**
 * です。こちらは応答をそのまま伝える下地で、失敗を区別したい呼び出し側のために残しています。
 *
 * @param minorUnits - 最小単位（セント）の整数で表した基準通貨の金額
 * @returns 換算できなければ null
 */
export async function convertToReferenceAmount(
  minorUnits: number,
): Promise<ReferenceAmount | null> {
  const wire = await getClient().request({
    path: "/v1/exchange-rates",
    searchParams: {
      base: BASE_CURRENCY,
      quote: DISPLAY_CURRENCY,
      original: (minorUnits / MINOR_UNITS_PER_UNIT).toFixed(MINOR_UNIT_DIGITS),
      displayCurrency: DISPLAY_CURRENCY,
    },
    schema: GetExchangeRatesResponse,
  });

  if (wire.referenceAmount === undefined || wire.referenceAmount === null) {
    return null;
  }

  return {
    currency: wire.referenceAmount.currency,
    amount: wire.referenceAmount.amount,
    rate: wire.referenceAmount.rate,
    rateDate: wire.referenceAmount.rateDate,
  };
}

/**
 * 表示通貨での参考換算額を読む。読めなくても投げない。
 *
 * @remarks
 * **この値が無くても画面は成り立ちます。** 請求されるのは基準通貨の金額で、換算額は読み手が
 * 大きさを掴むための添え物です。投げると、外部のレート提供元が落ちているあいだ購入も履歴も
 * 読めなくなります。
 *
 * **落として良いかどうかを画面ごとに決めさせません。** そうすると同じ判断が画面の数だけ増え、
 * 片方だけが落ちる画面が生まれます。この値を出すどの画面も、読めなければ出さないという 1 つの
 * 扱いで足ります。
 *
 * 通信の失敗と「契約が換算を持たない」を同じ `null` へ畳みます。画面から見ればどちらも
 * 「出せない」であり、区別しても表示は変わりません。失敗した事実は記録に残します。
 *
 * **投げてほしい画面が現れたら {@link convertToReferenceAmount} を直接使います。** 残してあるのは
 * そのためで、この関数はいまのところ全画面が同じ扱いをしているぶんを 1 か所へ畳んだものです。
 *
 * 読めなかったことは、画面が円の表示を出さないことで表します。0 円や「—」を置きません。金額として
 * 読める形を残すと、換算できなかったことが「その金額である」と受け取られます。
 *
 * @param minorUnits - 最小単位（セント）の整数で表した基準通貨の金額
 * @returns 読めなければ null
 */
export async function readReferenceAmount(minorUnits: number): Promise<ReferenceAmount | null> {
  try {
    return await convertToReferenceAmount(minorUnits);
  } catch (cause) {
    reportQuietly(() => getLogger().warn("参考換算額を読めませんでした", { cause: String(cause) }));

    return null;
  }
}
