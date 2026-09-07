import { findAppError } from "@/errors/app-error";
import { getDefaultErrorMeta, resolveErrorMeta } from "@/errors/error-catalog";
import { ErrorKind } from "@/errors/error-kind";

/**
 * 項目ごとの失敗の文言。値が無い項目は成功しているか、まだ検証していない。
 *
 * @remarks
 * 1 項目に複数の文言を持てる形にしています。検証は 1 項目につき複数の規則を当てるため、
 * 先頭だけを残す形にすると「なぜ通らないか」の残りが黙って落ちます。いくつ見せるかは
 * 表示側の判断です。
 */
export type FieldErrors<TField extends string = string> = Readonly<
  Partial<Record<TField, readonly string[]>>
>;

/**
 * Server Action が画面へ返す結果。
 *
 * @remarks
 * Server Action ごとに戻り値の形を発明しないための共通の器です。入力検証が返す項目エラーも、
 * 結果の通知手段の選択も、この形を入力に取ります。
 *
 * `useActionState` の境界を越えてシリアライズされるため、素の値だけで構成します。`Error` も
 * `Date` も往復しません。
 *
 * @typeParam T 成功時に画面へ返す値
 * @typeParam TField 項目エラーのキーになり得る項目名
 */
export type ActionState<T, TField extends string = string> =
  | { readonly status: "idle" }
  | { readonly status: "success"; readonly value: T }
  | {
      readonly status: "error";
      /** フォーム全体に対する文言。どの項目にも紐づかない失敗を表す。無ければ null。 */
      readonly formError: string | null;
      /** 項目ごとの文言。どの項目にも紐づかない失敗では省略される。 */
      readonly fieldErrors?: FieldErrors<TField>;
      /**
       * 何が起きたかの分類。
       *
       * @remarks
       * **文言と別に持ちます。**画面が失敗の種類で出し分ける（衝突なら読み込み直す導線を添える、
       * など）とき、文言そのものを合図にすると、文言へ動的な要素を足した瞬間に出し分けが黙って
       * 壊れます。「何が起きたか」は機械向け、「何を言うか」は人間向けで、変更の理由が違います。
       */
      readonly kind?: ErrorKind;
    };

/** まだ送信していない状態。`useActionState` の初期値に渡す。 */
export function idleActionState<T, TField extends string = string>(): ActionState<T, TField> {
  return { status: "idle" };
}

/** 成功した状態。 */
export function succeededActionState<T, TField extends string = string>(
  value: T,
): ActionState<T, TField> {
  return { status: "success", value };
}

/** 失敗した状態。フォーム全体の文言・項目ごとの文言・分類は、いずれも省略できる。 */
export function failedActionState<T, TField extends string = string>(
  options: { formError?: string | null; fieldErrors?: FieldErrors<TField>; kind?: ErrorKind } = {},
): ActionState<T, TField> {
  return {
    status: "error",
    formError: options.formError ?? null,
    fieldErrors: options.fieldErrors,
    kind: options.kind,
  };
}

/**
 * 投げられたエラーを失敗の状態へ写す。
 *
 * @remarks
 * 文言は `errors` カタログが分類ごとに持つものを使い、ここでは書きません。Server Action の
 * 数だけ同じ失敗に別の文言が付くのを避けるためです。
 *
 * 分類の付いていないエラーは `internal` として扱います。文言を付けずに返すと、画面には
 * 「失敗したが理由の表示は無い」状態が出ます。原因の詳細は外へ出せませんが、失敗したことは
 * 伝わらなければなりません。
 */
export function actionStateFromError<T, TField extends string = string>(
  error: unknown,
): ActionState<T, TField> {
  const kind = findAppError(error)?.kind ?? ErrorKind.INTERNAL;
  const meta = resolveErrorMeta(error) ?? getDefaultErrorMeta(ErrorKind.INTERNAL);

  return failedActionState({ formError: meta.message, kind });
}
