import { type $ZodType, safeParse } from "zod/v4/core";

import { assertRequestTargetWithinBudget } from "@/adapters/http/url-budget";
import { MAX_URL_BYTES } from "@/config/http/http.client";
import { createAppError } from "@/errors/app-error";
import { ErrorKind, type ErrorKind as ErrorKindType } from "@/errors/error-kind";

/**
 * 応答の status に対応する分類。
 *
 * @remarks
 * 載せるのは、呼び出し側が扱いを変える分類だけです。BFF が返すのは自分で組み立てた応答なので、
 * それ以外の失敗はどれも「取得できなかった」に畳まれます。
 *
 * `414` を載せるのは、経路の中継が返すためです。予算を広く取りすぎた設定では送信前の判定を
 * すり抜け、ブラウザには中継が組み立てた応答だけが返ります。
 *
 * **`401` を内部の失敗へ畳みません。** 認証の内側にある口は、読み進めている最中に session が
 * 切れることがあります。畳むと画面に出せるのは読み直す操作だけで、押しても同じ経路を辿るので
 * 永久に直りません。分類が分かれていれば、呼び出し側は入り直しを促せます。
 *
 * **`403` と `404` も同じ理由で分けます。** 張り直しを繰り返す購読は、同じ経路を辿るだけの失敗
 * （権限が無い・対象が無い）とそうでない失敗を見分けられないと止まりません。畳むと、直らない
 * 相手へ張り直し続けます。
 */
const KIND_BY_STATUS: Readonly<Partial<Record<number, ErrorKindType>>> = {
  400: ErrorKind.INVALID_ARGUMENT,
  401: ErrorKind.UNAUTHENTICATED,
  403: ErrorKind.PERMISSION_DENIED,
  404: ErrorKind.NOT_FOUND,
  414: ErrorKind.URI_TOO_LONG,
};

/** 呼び出し 1 件の指定。既定は打ち切りも持たない GET。 */
export type RequestOptions = {
  /** 条件が変わった、または画面を離れたときに取得を打ち切る合図。 */
  readonly signal?: AbortSignal;
  /**
   * HTTP メソッド。既定は `GET`。
   *
   * @remarks
   * **本文を載せる口を持ちません。** ブラウザから状態を作る操作は Server Action が持つため、
   * この口を通るのは取得と、購読を開くための発券のように**引数を持たない要求**だけです。
   */
  readonly method?: "GET" | "POST";
};

/**
 * 同一オリジンの BFF を叩き、応答を検証して返す。
 *
 * @remarks
 * ブラウザから出る要求はここだけを通ります。timeout・再試行・遮断は `adapters/server` が持ちます。
 * ここで独自に持つと、同じ要求に対して 2 つの再試行が別々の勘定で走ります。
 *
 * **送る前に予算を確かめます。** 予算を超えた要求は経路の中継が弾き、返るのは中継が
 * 組み立てた応答です。送る前に落とせば、条件が多すぎることを画面が同じ 1 つの分類で扱えます。
 *
 * 生の status を投げ直さず分類へ写します。呼び出し側は「入力が悪いのか、取得できなかったのか」
 * だけを見て表示を決めます。
 *
 * @param path - 同一オリジンの絶対パス。クエリを含み、percent-encode 済みであること
 * @param schema - 応答の検証スキーマ。**流儀は問わない** —— `zod` と `zod/mini` は同じ core の型を
 *   共有するため、ここは core の口だけを見る。共有層が片方の流儀を要求すると、呼び出し側の移行が
 *   この 1 箇所のために止まる
 * @param options - 打ち切りの合図と、取得以外の要求で使う method
 */
export async function request<T>(
  path: string,
  schema: $ZodType<T>,
  options: RequestOptions = {},
): Promise<T> {
  assertRequestTargetWithinBudget(path, MAX_URL_BYTES);

  const response = await fetch(path, {
    method: options.method ?? "GET",
    headers: { accept: "application/json" },
    signal: options.signal,
  });

  if (!response.ok) {
    throw createAppError(KIND_BY_STATUS[response.status] ?? ErrorKind.INTERNAL);
  }

  const parsed = safeParse(schema, await response.json());

  if (!parsed.success) {
    throw createAppError(ErrorKind.INTERNAL, { cause: parsed.error });
  }

  return parsed.data;
}
