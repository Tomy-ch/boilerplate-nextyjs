import "server-only";

import { getApiConfig } from "@/config/api/api.server";
import { getHttpConfig } from "@/config/http/http.server";

import {
  PostInquiriesFeedStreamTicketResponse,
  PostInquiriesMeStreamTicketResponse,
} from "../../gen/api/endpoints.zod";
import { getAccessToken } from "../auth/session";
import { createHttpClient, type UserScopedHttpClient } from "../http/request";

const MY_TICKET_PATH = "/v1/inquiries/me/stream-ticket";

const FEED_TICKET_PATH = "/v1/inquiries/feed/stream-ticket";

const STREAMS_PATH = "/v1/streams";

/**
 * ブラウザが購読を始めるために要るもの。
 *
 * @remarks
 * **ticket を単体で渡さず、繋ぎ先の URL に組み込んで渡します。** ticket は query に載せる以外に
 * 使い道がなく（`EventSource` はヘッダを持てません）、値として渡すとブラウザ側で組み立てと
 * 取り回しが増え、文言やログへ写す経路がその分だけ増えます。
 *
 * 同じ理由で、接続先の origin もここで決めます。origin を browser 側の設定として持たせると、
 * 接続先がサーバの設定とブラウザの設定の 2 か所に現れます。
 */
export type StreamConnection = {
  /**
   * 購読を開く URL。開始位置だけを呼び出し側が足す。
   *
   * @remarks
   * **この値を文言・ログ・span の属性へ載せません。** ticket が含まれており、名前で伏せる
   * redaction は URL 文字列の中までは届きません。
   */
  readonly url: string;
  /** この URL で新しい接続を始められる期限。過ぎたら取り直す。 */
  readonly expiresAt: Date;
};

let client: UserScopedHttpClient | undefined;

function getClient(): UserScopedHttpClient {
  client ??= createHttpClient({
    scope: "user-scoped",
    baseUrl: getApiConfig().baseUrl,
    maxUrlBytes: getHttpConfig().maxUrlBytes,
    getBearerToken: getAccessToken,
  });

  return client;
}

/** 発券の応答から、そのまま開ける URL を組む。 */
function toConnection(ticket: string, streamId: string, expiresAt: string): StreamConnection {
  const url = new URL(
    `${getApiConfig().baseUrl.replace(/\/$/, "")}${STREAMS_PATH}/${encodeURIComponent(streamId)}`,
  );

  url.searchParams.set("ticket", ticket);

  return { url: url.toString(), expiresAt: new Date(expiresAt) };
}

/**
 * 自分の問い合わせを購読する口を発券する。
 *
 * @remarks
 * **発券は主体を名乗る要求です。** ブラウザは Access Token を持たないため、backend の認可を
 * 通せるのはこの経路だけです。
 *
 * 購読する問い合わせを持たない主体には `not-found` が返ります。まだ 1 通も送っていない状態が
 * これに当たり、履歴の取得が成功することとは両立します。
 */
export async function issueMyInquiryStreamConnection(): Promise<StreamConnection> {
  const wire = await getClient().request({
    path: MY_TICKET_PATH,
    method: "POST",
    schema: PostInquiriesMeStreamTicketResponse,
  });

  return toConnection(wire.ticket, wire.streamId, wire.expiresAt);
}

/** 問い合わせの更新フィードを購読する口を発券する（運営）。運ぶのは行の更新だけで、本文は含まない。 */
export async function issueInquiryFeedStreamConnection(): Promise<StreamConnection> {
  const wire = await getClient().request({
    path: FEED_TICKET_PATH,
    method: "POST",
    schema: PostInquiriesFeedStreamTicketResponse,
  });

  return toConnection(wire.ticket, wire.streamId, wire.expiresAt);
}
