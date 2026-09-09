import "server-only";

import type { Session } from "@/model/session";

import { getSessionResolver } from "./resolver";

/**
 * cookie の値だけから身元を読む。入口の楽観判定に使う。
 *
 * @remarks
 * `proxy.ts` はリクエスト完了前に走り、prefetch を含む全経路を通ります。そこで使える材料は cookie
 * だけであり、データ源を引く判定は置けません。
 *
 * 受け取るのが `Request` ではなく cookie の値そのものなのは、取り出し方（`NextRequest` か
 * ヘッダの解析か）に依存させないためです。
 *
 * **これは確定認可ではありません。** 返した身元が正しいことは、データ源に最も近い所で
 * 改めて確かめます。
 *
 * @param sealed - session cookie の値。無ければ undefined
 * @returns 復元できなければ null
 */
export async function readOptimisticSession(sealed: string | undefined): Promise<Session | null> {
  if (sealed === undefined) {
    return null;
  }

  return (await getSessionResolver().restore(sealed))?.session ?? null;
}
