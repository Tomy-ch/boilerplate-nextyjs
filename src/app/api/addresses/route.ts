import { findAddresses } from "@/adapters/server/api/addresses";
import { toCaughtErrorResponse, toErrorResponse } from "@/adapters/server/http/error-response";
import { ErrorKind } from "@/errors/error-kind";

/** 契約が受け付ける郵便番号の形。ここを通らない要求はバックエンドへ出さない。 */
const POSTAL_CODE_PATTERN = /^\d{3}-\d{4}$/;

/**
 * 郵便番号からの住所補完。
 *
 * @remarks
 * 入力中の画面が叩く口です。ブラウザから外部オリジンへ直接出さないための中継であり、
 * 取得も検証も `adapters/server` が済ませています。
 *
 * 形を先に見てから中継します。契約の pattern を外れた値はどのみち `400` で返るので、往復を
 * 1 つ減らせます。
 *
 * 外部の lookup が落ちている場合も `200` と空の候補が返ります。契約がそう定めており、画面は
 * 手入力を続けられます。**そのとき `isFallback` が true になる**ので、該当なしと言い分けたい
 * 画面のためにそのまま渡します。
 */
export async function GET(request: Request): Promise<Response> {
  const postalCode = new URL(request.url).searchParams.get("postalCode") ?? "";

  if (!POSTAL_CODE_PATTERN.test(postalCode)) {
    return toErrorResponse(ErrorKind.INVALID_ARGUMENT);
  }

  try {
    return Response.json(await findAddresses(postalCode));
  } catch (error) {
    return toCaughtErrorResponse(error);
  }
}
