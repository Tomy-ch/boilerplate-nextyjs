import { findAppError } from "@/errors/app-error";
import { getDefaultErrorMeta } from "@/errors/error-catalog";
import { ErrorKind, type ErrorKind as ErrorKindType } from "@/errors/error-kind";

import { toHttpStatus } from "./error-status";

/**
 * 分類から、返す status と文言を組む。
 *
 * @remarks
 * Route Handler が失敗を返す形をここに 1 つ持ちます。口ごとに組み立てると、返す形が口の数だけ
 * 分かれ、増えるたびに揃っているかを読んで確かめることになります。
 *
 * 載せるのは分類が持つ既定の文言だけです。外から来た文言をそのまま返すと、こちらが選んでいない
 * 文字列が利用者へ出ます。
 */
export function toErrorResponse(kind: ErrorKindType): Response {
  return Response.json(
    { message: getDefaultErrorMeta(kind).message },
    { status: toHttpStatus(kind) },
  );
}

/**
 * 捕まえた値から、返す status と文言を組む。
 *
 * @remarks
 * 分類の付いていない失敗は `internal` へ矯正します。分類を持たない値は、こちらが想定していない
 * 経路で投げられたものなので、利用者に見せる形を選べません。
 */
export function toCaughtErrorResponse(error: unknown): Response {
  return toErrorResponse(findAppError(error)?.kind ?? ErrorKind.INTERNAL);
}
