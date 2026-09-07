import { ErrorKind, type ErrorKind as ErrorKindType } from "@/errors/error-kind";

/**
 * 分類ごとの HTTP status。
 *
 * @remarks
 * `errors` は transport を知らない層なので、分類から status への変換はこの層が持ちます。逆向きの
 * `toErrorKind()` が隣（`retry-policy.ts`）にあり、同じ表の両向きを別の層へ散らしません。対応表の
 * 出所は[同区画の README](README.md)。
 */
const STATUS_BY_KIND: Readonly<Record<ErrorKindType, number>> = {
  [ErrorKind.INVALID_ARGUMENT]: 400,
  [ErrorKind.UNAUTHENTICATED]: 401,
  [ErrorKind.PERMISSION_DENIED]: 403,
  [ErrorKind.NOT_FOUND]: 404,
  [ErrorKind.CONFLICT]: 409,
  [ErrorKind.VALIDATION]: 422,
  [ErrorKind.UNSUPPORTED_MEDIA_TYPE]: 415,
  [ErrorKind.PAYLOAD_TOO_LARGE]: 413,
  [ErrorKind.URI_TOO_LONG]: 414,
  [ErrorKind.TOO_MANY_REQUESTS]: 429,
  [ErrorKind.CANCELED]: 499,
  [ErrorKind.UNAVAILABLE]: 503,
  [ErrorKind.UNIMPLEMENTED]: 501,
  [ErrorKind.INTERNAL]: 500,
};

/** 分類に対応する HTTP status を返す。 */
export function toHttpStatus(kind: ErrorKindType): number {
  return STATUS_BY_KIND[kind];
}
