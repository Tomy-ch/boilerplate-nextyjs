/**
 * 同意を尋ねる対象の区分。
 *
 * @remarks
 * 2 値に留めます。細分（分析 / 広告 / 個人化…）は法域と、ゲートの先に繋ぐ製品が決めるもので、
 * 何も繋がっていない側が先に決めると、削る作業から始めることになります。
 */
export const CONSENT_CATEGORY = {
  /** 画面が成立するために要る用途。尋ねる対象ではなく、常に動く。 */
  necessary: "necessary",
  /** 無くても画面が成立する用途。同意を得るまで動かさない。 */
  optional: "optional",
} as const;

/** {@link CONSENT_CATEGORY} のいずれか。 */
export type ConsentCategory = (typeof CONSENT_CATEGORY)[keyof typeof CONSENT_CATEGORY];

/** 任意の用途について利用者が示した意思。 */
export const CONSENT_CHOICE = {
  /** 任意の用途を動かしてよい。 */
  granted: "granted",
  /** 任意の用途を動かしてはならない。 */
  denied: "denied",
} as const;

/** {@link CONSENT_CHOICE} のいずれか。 */
export type ConsentChoice = (typeof CONSENT_CHOICE)[keyof typeof CONSENT_CHOICE];

/**
 * ツリーへ配る同意状態。
 *
 * @remarks
 * **「まだ読んでいない」と「読んだが選ばれていない」を分けます。** どちらもゲートは閉じますが、
 * 尋ねてよいかどうかが逆になります。畳むと、cookie を読む前のサーバ描画がそのまま「未選択」に
 * 見え、選び終えた利用者にもバナーが出ます。
 */
export type ConsentState =
  | {
      /** まだ cookie を読んでいない。サーバ側の描画と、hydration が終わるまでの client がこれ。 */
      readonly status: "unread";
    }
  | {
      /** 読んだが、利用者はまだ選んでいない。尋ねるかどうかは {@link shouldAskConsent} が判定する。 */
      readonly status: "unset";
    }
  | {
      /** 読んだうえで、利用者が選び終えている。 */
      readonly status: "decided";
      /** 任意の用途について選ばれた意思。 */
      readonly optional: ConsentChoice;
    };

/** まだ cookie を読んでいない状態。 */
export const UNREAD_CONSENT: ConsentState = { status: "unread" };

/** 同意の意思を載せる cookie の名前。 */
export const CONSENT_COOKIE_NAME = "consent_choice";

/**
 * 同意を尋ねた文面の版。
 *
 * @remarks
 * **意思と一緒に cookie へ載せ、いまの版と違えば未選択へ倒します。** 期限だけでは、文面を書き
 * 換えても古い文面に同意した意思がそのまま効き続けます —— 何に同意したかが変わったのに、同意
 * だけが残ります。版を添えると、書き換えた瞬間に全員へ尋ね直せます。
 *
 * **文面を書き換えたらこの値を上げます。** 上げ忘れると、新しい文面を見ていない利用者の同意が
 * 効いたままになります。文面の所有者は `components/shell/consent-banner` の
 * `CONSENT_BANNER_COPY` で、そちらの doc が上げる義務を持ちます。
 */
export const CONSENT_COPY_VERSION = 1;

/** 同意に紐づけて発行する計測 id を載せる cookie の名前。 */
export const MEASUREMENT_ID_COOKIE_NAME = "analytics_id";

/**
 * 同意と計測 id を保つ秒数。
 *
 * @remarks
 * 同意は期限付きで、切れたらもう一度尋ねます。無期限にすると、繋ぐ製品も文面も変わったあとの
 * 画面が、何年も前の意思をもって動きます。
 *
 * 計測 id にも同じ期限を使います。id だけが同意より長く残ると、尋ね直している最中の利用者を
 * 前の id で識別できてしまいます。
 */
export const CONSENT_MAX_AGE_SECONDS = 60 * 60 * 24 * 180;

/**
 * cookie に載っていた綴りを同意状態へ直す。
 *
 * @remarks
 * **知らない綴りは「選ばれていない」へ倒します。** 期限切れ・手で書き換えられた値・区分を
 * 増やした版が残した綴りは、どれも意思として読めません。読めない値を同意として扱わないことが、
 * このカーネルが負う唯一の安全側です。
 *
 * **尋ねた文面の版が今と違えば、意思として読みません**（{@link CONSENT_COPY_VERSION}）。
 *
 * @param raw - cookie の値。cookie そのものが無ければ `undefined`
 * @returns 読み取れた同意状態。`"unread"` は返さない —— 呼んだ時点で読んでいる
 */
export function parseConsentState(raw: string | undefined): ConsentState {
  const [choice, version] = (raw ?? "").split(".");

  if (version !== String(CONSENT_COPY_VERSION)) {
    return { status: "unset" };
  }

  for (const known of Object.values(CONSENT_CHOICE)) {
    if (choice === known) {
      return { status: "decided", optional: known };
    }
  }

  return { status: "unset" };
}

/**
 * 選ばれた意思を cookie へ載せる綴りへ直す。
 *
 * @remarks
 * 尋ねた文面の版を添えます。読む側（{@link parseConsentState}）が版で弾けるのは、書く側がここを
 * 通っているからです。
 *
 * @param choice - 利用者が選んだ意思
 */
export function toConsentCookieValue(choice: ConsentChoice): string {
  return `${choice}.${CONSENT_COPY_VERSION}`;
}

/**
 * その区分を動かしてよいかを判定する。
 *
 * @remarks
 * **既定は閉じています。** 同意が読めていない間も、読んだうえで選ばれていない間も、任意の用途は
 * 動きません。ゲートを敷く側はこの述語だけを見ればよく、状態の形を知る必要はありません。
 *
 * @param state - いまの同意状態
 * @param category - 動かしたい用途の区分
 */
export function allowsCategory(state: ConsentState, category: ConsentCategory): boolean {
  if (category === CONSENT_CATEGORY.necessary) {
    return true;
  }

  return state.status === "decided" && state.optional === CONSENT_CHOICE.granted;
}

/**
 * 尋ねるべきかを判定する。
 *
 * @remarks
 * 読み終えていて、かつ選ばれていないときだけ尋ねます。読む前に尋ねると、選び終えた利用者にも
 * 一度バナーが出ます。
 *
 * @param state - いまの同意状態
 */
export function shouldAskConsent(state: ConsentState): boolean {
  return state.status === "unset";
}
