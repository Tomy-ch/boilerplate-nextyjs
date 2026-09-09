import { ErrorKind } from "@/errors/error-kind";

/** 再試行してよい HTTP メソッド。副作用が冪等であることが根拠。 */
const IDEMPOTENT_METHODS: readonly string[] = ["GET", "HEAD", "PUT", "DELETE", "OPTIONS"];

const BASE_DELAY_MS = 100;
const MAX_DELAY_MS = 2_000;
const MS_PER_SECOND = 1_000;

/** 再試行の判断に必要な 1 回分の結果。 */
export type AttemptOutcome = {
  /** 応答が返った場合の HTTP status。通信自体が失敗したなら undefined。 */
  status?: number;
};

/**
 * メソッドが再試行の対象かを返す。
 *
 * @remarks
 * `POST` / `PATCH` は既定で対象外です。同じ要求を 2 度送ってよいかは呼び出し側の設計に
 * 属し、adapters からは判断できません。冪等性を担保した呼び出しだけが明示的に opt-in します。
 */
export function isRetryableMethod(method: string, idempotent: boolean): boolean {
  return idempotent || IDEMPOTENT_METHODS.includes(method.toUpperCase());
}

/**
 * 応答が再試行に値するかを返す。
 *
 * @remarks
 * 再試行してよいのは、同じ要求をもう一度送れば結果が変わりうる失敗だけです。4xx は
 * 要求そのものが誤っているため、送り直しても同じ結果になります（429 は例外で、
 * 時間を空ければ通る）。応答が無い場合（通信断・タイムアウト）は届いていない可能性が
 * あるため対象に含めます。
 */
export function isRetryableOutcome({ status }: AttemptOutcome): boolean {
  if (status === undefined) {
    return true;
  }

  return status === 429 || status >= 500;
}

/**
 * 次の試行までの待ち時間。
 *
 * @remarks
 * full jitter（0 から上限までの一様乱数）を使います。指数関数的に伸ばすだけでは、同時に
 * 失敗した呼び出しが同じ間隔で足並みを揃えて再送し、復旧しかけた接続先を再び倒します。
 *
 * @param attempt - 完了した試行の回数（1 始まり）
 * @param random - 0 以上 1 未満の乱数を返す関数。呼び出し側が渡す
 */
export function backoffDelayMs(attempt: number, random: () => number): number {
  const ceiling = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** (attempt - 1));

  return Math.floor(random() * ceiling);
}

/**
 * `Retry-After` ヘッダが指示する待ち時間。
 *
 * @remarks
 * 接続先が待ち時間を明示しているなら、こちらの backoff より優先します。秒数と HTTP-date の
 * 両形式を受け付け、解釈できない値や過去の日時は指示なしとして扱います。
 *
 * @param header - ヘッダの値。無い場合は null
 * @param now - 現在時刻のミリ秒。HTTP-date 形式の解釈に使う
 */
export function retryAfterDelayMs(header: string | null, now: number): number | null {
  if (header === null) {
    return null;
  }

  const seconds = Number(header);

  if (Number.isFinite(seconds)) {
    return seconds >= 0 ? seconds * MS_PER_SECOND : null;
  }

  const at = Date.parse(header);

  if (Number.isNaN(at)) {
    return null;
  }

  return Math.max(0, at - now);
}

/**
 * HTTP status をプロトコル非依存の分類へ写す。
 *
 * @remarks
 * 表に無い status は `internal` へ矯正します。分類できない応答を素通しすると、生の status が
 * 上位層へ漏れます。対応表の出所は[同区画の README](README.md)。
 */
export function toErrorKind(status: number): ErrorKind {
  switch (status) {
    case 400:
      return ErrorKind.INVALID_ARGUMENT;
    case 401:
      return ErrorKind.UNAUTHENTICATED;
    case 403:
      return ErrorKind.PERMISSION_DENIED;
    case 404:
      return ErrorKind.NOT_FOUND;
    case 409:
      return ErrorKind.CONFLICT;
    case 413:
      return ErrorKind.PAYLOAD_TOO_LARGE;
    case 414:
      return ErrorKind.URI_TOO_LONG;
    case 415:
      return ErrorKind.UNSUPPORTED_MEDIA_TYPE;
    case 422:
      return ErrorKind.VALIDATION;
    case 429:
      return ErrorKind.TOO_MANY_REQUESTS;
    case 499:
      return ErrorKind.CANCELED;
    case 501:
      return ErrorKind.UNIMPLEMENTED;
    case 503:
      return ErrorKind.UNAVAILABLE;
    default:
      return ErrorKind.INTERNAL;
  }
}
