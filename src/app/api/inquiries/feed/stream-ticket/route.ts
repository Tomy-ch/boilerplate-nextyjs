import { issueInquiryFeedStreamConnection } from "@/adapters/server/api/inquiries-stream";
import { toCaughtErrorResponse } from "@/adapters/server/http/error-response";

/**
 * 問い合わせの更新フィードを購読する口の発券（運営）。
 *
 * @remarks
 * 中継である理由と、認証をここで先に判定しない理由は、自分の問い合わせ側
 * （`../../me/stream-ticket/route.ts`）と同じです。役割の判定も同じ理由で持ちません ——
 * 役割が足りない主体には backend が `permission-denied` を返し、それがそのまま 403 になります。
 */
export async function POST(): Promise<Response> {
  try {
    return Response.json(await issueInquiryFeedStreamConnection());
  } catch (error) {
    return toCaughtErrorResponse(error);
  }
}
