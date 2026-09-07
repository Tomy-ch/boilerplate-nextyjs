"use client";

import { useEffect, useSyncExternalStore } from "react";
import { create } from "zustand";

import {
  CONSENT_COOKIE_NAME,
  CONSENT_MAX_AGE_SECONDS,
  type ConsentChoice,
  type ConsentState,
  parseConsentState,
  toConsentCookieValue,
  UNREAD_CONSENT,
} from "@/model/consent";

/** 同意状態を保つ横断 client 状態。 */
type ConsentStore = {
  /** いま分かっている同意状態。 */
  state: ConsentState;
};

/**
 * cookie から同意状態を読む。
 *
 * @remarks
 * 呼ぶのはブラウザ側だけです（{@link useConsentState} の effect）。
 */
function readConsentCookie(): ConsentState {
  const found = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(`${CONSENT_COOKIE_NAME}=`));

  return parseConsentState(found?.slice(CONSENT_COOKIE_NAME.length + 1));
}

/**
 * 選ばれた意思を cookie へ書く。
 *
 * @remarks
 * **`httpOnly` を付けられません。** 同じ値をこの層が読み、バナーを出すかどうかを決めるためです。
 * 載るのは「同意したかどうか」だけで、身元も識別子も含みません。
 *
 * `secure` は https で配信されているときだけ付けます。常に付けると `http://localhost` の開発で
 * 保存されず、選んでも次の描画でまた尋ねることになります。
 */
function writeConsentCookie(choice: ConsentChoice): void {
  const attributes = [
    `max-age=${CONSENT_MAX_AGE_SECONDS}`,
    "path=/",
    "samesite=lax",
    ...(location.protocol === "https:" ? ["secure"] : []),
  ];

  document.cookie = `${CONSENT_COOKIE_NAME}=${toConsentCookieValue(choice)}; ${attributes.join("; ")}`;
}

/**
 * 同意状態を配る store。
 *
 * @remarks
 * **初期値は「まだ読んでいない」で、サーバとブラウザで同じです。** cookie を読むのは
 * {@link useConsentState} が mount された後の 1 回だけで、以後の書き換えは
 * {@link decideConsent} だけが行います。
 */
const useConsentStore = create<ConsentStore>(() => ({ state: UNREAD_CONSENT }));

/** いまの同意状態。サーバでもブラウザでも同じ口から読む。 */
function snapshot(): ConsentState {
  return useConsentStore.getState().state;
}

/**
 * いまの同意状態を購読する。
 *
 * @remarks
 * **サーバ側とブラウザ側で同じ値を返します。** 別の値を返すと、`getServerSnapshot` が読まれる
 * たびに「まだ読んでいない」へ巻き戻ります —— Cache Components の下では穴が届いた時点で
 * subtree の hydration がもう一度走るため、**出したバナーがそこで一度消えて開き直り**、その消失が
 * layout shift として数えられます。
 *
 * cookie を読むのは mount 後の 1 回だけです。サーバは同意状態を知らないので、**バナーはその読み
 * 取りの後に現れます**。知らないまま尋ねるか、知るまで待つかのどちらかしかありません。
 */
export function useConsentState(): ConsentState {
  useEffect(() => {
    if (snapshot().status === "unread") {
      useConsentStore.setState({ state: readConsentCookie() });
    }
  }, []);

  return useSyncExternalStore(useConsentStore.subscribe, snapshot, snapshot);
}

/**
 * 選ばれた意思を保存し、ツリーへ反映する。
 *
 * @remarks
 * 保存と反映を 1 つにします。別々に呼べる形にすると、書いたが反映していない状態と、その逆を
 * 作れます。
 *
 * @param choice - 利用者が選んだ意思
 */
export function decideConsent(choice: ConsentChoice): void {
  writeConsentCookie(choice);
  useConsentStore.setState({ state: { status: "decided", optional: choice } });
}
