import "server-only";

import { cookies } from "next/headers";
import { cache } from "react";

import type { Session } from "@/model/session";

import { taintObjectReference } from "../taint/taint";
import { getSessionResolver } from "./resolver";
import {
  baseCookieOptions,
  SESSION_COOKIE_NAME,
  TRANSACTION_COOKIE_NAME,
  TRANSACTION_MAX_AGE_SECONDS,
} from "./session-cookie";
import type { AuthorizationTransaction, SessionRecord } from "./session-resolver";

/**
 * cookie から session とトークンを復元する。
 *
 * @remarks
 * `adapters/server` の外へ出しません。返り値には Access Token が含まれるため、内側の層が
 * これを呼べると「うっかり client へ渡す」経路が生まれます。内側が使うのは
 * {@link verifySession} です。
 *
 * 復号を 1 リクエストにつき 1 度へ畳むために memo 化します。認可の検査はデータ源の近くで
 * 何度も行われる想定であり、その都度復号すると回数がそのまま費用になります。
 *
 * **復元した記録を汚します。** 出しては困るのは Access Token と ID Token で、それを含む
 * 記録をそのまま Client Component へ渡すと、渡した時点で描画が落ちます。ここで汚すのは、
 * 記録が生まれる場所がここだけだからです。**参照でしか追えない**ので、項目を抜き出した値には
 * 及びません —— 内側の層へ渡してよいのは {@link verifySession} が返す身元だけ、という約束が主で、
 * これはそこを抜けたときに実行時で捕まえる補助です。
 */
const readSessionRecord = cache(async (): Promise<SessionRecord | null> => {
  const sealed = (await cookies()).get(SESSION_COOKIE_NAME)?.value;

  if (sealed === undefined) {
    return null;
  }

  const record = await getSessionResolver().restore(sealed);

  if (record !== null) {
    taintObjectReference(
      "session の記録には資格情報が含まれます。Client Component へ渡すのは verifySession() が返す身元だけにしてください",
      record,
    );
  }

  return record;
});

/**
 * 確定認可の入口。session を検証して身元を返す。
 *
 * @remarks
 * データ取得・Server Action・Route Handler は、進む前に必ずここを通します。`proxy.ts` の楽観判定は
 * 入口の前捌きに過ぎず、防御線はこちら側です。
 *
 * 返すのは身元だけで、トークンは含めません。
 *
 * @returns 未認証・失効・復号できないときは null
 */
export const verifySession = cache(async (): Promise<Session | null> => {
  return (await readSessionRecord())?.session ?? null;
});

/**
 * 認証済みの API 呼び出しに付ける Bearer を返す。
 *
 * @remarks
 * 呼び出し側が個別に Authorization ヘッダを組み立てないよう、取り出し口をここに 1 つだけ置きます。
 *
 * @returns 未認証なら null
 */
export async function getAccessToken(): Promise<string | null> {
  return (await readSessionRecord())?.accessToken ?? null;
}

/**
 * session を cookie へ載せる。
 *
 * @remarks
 * cookie の寿命は session の失効時刻に合わせます。長く持たせても、中の Access Token が
 * 期限切れになった時点で API が通らなくなるだけです。
 */
export async function storeSession(record: SessionRecord): Promise<void> {
  const sealed = await getSessionResolver().seal(record);
  const maxAge = Math.max(0, Math.floor((record.session.expiresAt.getTime() - Date.now()) / 1000));

  (await cookies()).set(SESSION_COOKIE_NAME, sealed, { ...baseCookieOptions(), maxAge });
}

/**
 * ログアウトする。自分の cookie を破棄し、IdP 側を終わらせるための送り先を返す。
 *
 * @remarks
 * **cookie の破棄を先に行い、これは必ず成功します。** 送り先の組み立てはそのあとです。順序を
 * 逆にすると、IdP を引けないときに手元の session まで残ります。
 *
 * **IdP 側の終了はここでは済んでいません。** 終わらせるのは、返した先へ利用者のブラウザが
 * 実際に着いたときです（`SessionResolver.endSession`）。返り値を捨てると手元だけのログアウトに
 * なり、直後の再ログインが認証を求めずに素通りします。
 *
 * 送り先を組み立てられなかったときは投げます。呼び出し側は「自分の session は既に消えている」
 * ことを前提に、利用者へ何を見せるかを決められます。ここで握り潰すと、IdP に session が残った
 * ことを誰も知れなくなります。
 *
 * @returns 利用者のブラウザを送り出す先。未認証だったとき、または IdP が口を持たないとき null
 * @throws IdP を引けず送り先を組み立てられなかったとき
 */
export async function signOut(): Promise<string | null> {
  const record = await readSessionRecord();

  (await cookies()).delete(SESSION_COOKIE_NAME);

  if (record === null) {
    return null;
  }

  return getSessionResolver().endSession(record);
}

/**
 * 認可要求の一時状態を cookie へ載せる。
 *
 * @remarks
 * 中身は Resolver が封緘したまま扱います。ここが形を知っていると、認証方式を差し替えるたびに
 * cookie を扱う側も書き直すことになります。
 */
export async function storeTransaction(transaction: AuthorizationTransaction): Promise<void> {
  const sealed = await getSessionResolver().sealTransaction(transaction);

  (await cookies()).set(TRANSACTION_COOKIE_NAME, sealed, {
    ...baseCookieOptions(),
    maxAge: TRANSACTION_MAX_AGE_SECONDS,
  });
}

/**
 * 認可要求の一時状態を取り出し、同時に破棄する。
 *
 * @remarks
 * 取り出しと破棄を分けません。一時状態は 1 回の往復でだけ有効であり、残しておくと同じ
 * `state` と検証子で 2 度目の交換を試せます。
 *
 * @returns 無い、または解釈できなければ null
 */
export async function takeTransaction(): Promise<AuthorizationTransaction | null> {
  const store = await cookies();
  const sealed = store.get(TRANSACTION_COOKIE_NAME)?.value;

  store.delete(TRANSACTION_COOKIE_NAME);

  if (sealed === undefined) {
    return null;
  }

  return getSessionResolver().restoreTransaction(sealed);
}
