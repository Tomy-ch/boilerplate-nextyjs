import { ErrorKind, type ErrorKind as ErrorKindType } from "@/errors/error-kind";

/** 受け付ける本体の型。 */
const CONTENT_TYPE = "application/json";

/** 上限のもとで読んだ本体。 */
export type JsonBody =
  | Readonly<{ ok: true; value: unknown }>
  | Readonly<{ ok: false; kind: ErrorKindType }>;

/**
 * JSON を名乗る要求の本体を、上限のもとで読む。
 *
 * @remarks
 * **認証を要求しない口が持つ最小の防御です**。宣言された型と本体の大きさを見て、
 * 契約の外にあるものを落とします。レート制限と大域的な遮断は edge / WAF の責務なので、
 * ここには置きません（同 §1）。
 *
 * **大きさは 2 度見ます。** 宣言された長さで先に落とすと本体を読まずに済み、宣言の無い要求や偽った
 * 宣言は読んだ後の実測で落ちます。**読む前に打ち切ることまではしません** —— 際限なく流し込まれる
 * 本体を止めるのは配信経路の役割です。
 *
 * @param request - 受け取った要求
 * @param maxBytes - 本体に許すバイト数
 * @returns 落とした場合は、そのまま応答へ写せる分類
 */
export async function readJsonBody(request: Request, maxBytes: number): Promise<JsonBody> {
  if (!isJson(request.headers.get("content-type"))) {
    return { ok: false, kind: ErrorKind.UNSUPPORTED_MEDIA_TYPE };
  }

  const declaredLength = Number(request.headers.get("content-length"));

  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    return { ok: false, kind: ErrorKind.PAYLOAD_TOO_LARGE };
  }

  const body = await request.text();

  if (new TextEncoder().encode(body).byteLength > maxBytes) {
    return { ok: false, kind: ErrorKind.PAYLOAD_TOO_LARGE };
  }

  try {
    return { ok: true, value: JSON.parse(body) };
  } catch {
    return { ok: false, kind: ErrorKind.INVALID_ARGUMENT };
  }
}

/** 宣言された型が JSON かを見る。charset などの引数が付いていても本体の型は変わらない。 */
function isJson(contentType: string | null): boolean {
  return contentType !== null && contentType.split(";")[0]?.trim().toLowerCase() === CONTENT_TYPE;
}
