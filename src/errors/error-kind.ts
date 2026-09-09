/**
 * errors カーネルが扱う、プロトコルに依存しないエラー分類です。
 *
 * この値は transport の変換前後で共通に用いるため、分類を足すときは同層の [README](README.md) の
 * 分類表と、変換を持つ `adapters` 境界を併せて直します。
 */
/** errors カーネルが受け入れるエラー分類です。 */
export type ErrorKind =
  | "invalid-argument"
  | "unauthenticated"
  | "permission-denied"
  | "not-found"
  | "conflict"
  | "validation"
  | "unsupported-media-type"
  | "payload-too-large"
  | "uri-too-long"
  | "too-many-requests"
  | "canceled"
  | "unavailable"
  | "unimplemented"
  | "internal";

/** エラー分類の名前付き定数です。 */
export const ErrorKind = {
  INVALID_ARGUMENT: "invalid-argument",
  UNAUTHENTICATED: "unauthenticated",
  PERMISSION_DENIED: "permission-denied",
  NOT_FOUND: "not-found",
  CONFLICT: "conflict",
  VALIDATION: "validation",
  UNSUPPORTED_MEDIA_TYPE: "unsupported-media-type",
  PAYLOAD_TOO_LARGE: "payload-too-large",
  URI_TOO_LONG: "uri-too-long",
  TOO_MANY_REQUESTS: "too-many-requests",
  CANCELED: "canceled",
  UNAVAILABLE: "unavailable",
  UNIMPLEMENTED: "unimplemented",
  INTERNAL: "internal",
} satisfies Readonly<
  Record<
    | "INVALID_ARGUMENT"
    | "UNAUTHENTICATED"
    | "PERMISSION_DENIED"
    | "NOT_FOUND"
    | "CONFLICT"
    | "VALIDATION"
    | "UNSUPPORTED_MEDIA_TYPE"
    | "PAYLOAD_TOO_LARGE"
    | "URI_TOO_LONG"
    | "TOO_MANY_REQUESTS"
    | "CANCELED"
    | "UNAVAILABLE"
    | "UNIMPLEMENTED"
    | "INTERNAL",
    ErrorKind
  >
>;

/** errors カーネルが扱う全分類の配列です。 */
export const errorKinds: readonly ErrorKind[] = Object.values(ErrorKind);
