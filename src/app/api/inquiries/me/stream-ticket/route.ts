import { issueMyInquiryStreamConnection } from "@/adapters/server/api/inquiries-stream";
import { toCaughtErrorResponse } from "@/adapters/server/http/error-response";

/**
 * 自分の問い合わせを購読する口の発券。
 *
 * @remarks
 * ブラウザは Access Token を持たないため、backend の発券口を通せるのはこの中継だけです。
 * ここが持つのは分類を HTTP へ写すことだけで、取得も検証も `adapters/server` が済ませています。
 *
 * **`GET` を置きません。** 発券は ticket という状態を作る操作で、契約も `POST` だけを受けます。
 *
 * 認証は発券そのものが要求します。ここで先に弾かないのは、判定を 2 か所に置くと片方だけが
 * 緩む余地が残るためで、資格情報が無い要求は `adapters` が `unauthenticated` として返し、
 * それがそのまま 401 になります。読み進めている最中に session が切れた購読は、この 401 を
 * 見て入り直しへ落ちます。
 */
export async function POST(): Promise<Response> {
  try {
    return Response.json(await issueMyInquiryStreamConnection());
  } catch (error) {
    return toCaughtErrorResponse(error);
  }
}
