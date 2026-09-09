import { z } from "zod";

/**
 * URL の同じキーが何回現れたかを、値の意味へ直す規則。
 *
 * @remarks
 * `searchParams` は利用者が直接編集できる入力です。**同じキーが何回現れるかは、その条件が複数の
 * 値を受け取れるかで意味が変わります。** 受け取れない条件へ 2 つ届いたときにどちらかを採るのは
 * 推測であり、採り方を条件ごとに決めると、同じ URL が画面によって違う条件に見えます。
 *
 * ここが持つのは読み方だけで、何を正しい値とするかは呼び出す側のスキーマが決めます。
 */

/**
 * route segment が受け取る素の `searchParams`。
 *
 * @remarks
 * 同じキーが繰り返された条件は並びで届き、載っていないキーは `undefined` になります。値の意味は
 * 読む側が決めるので、ここが表すのは**届く形**だけです。
 */
export type RawSearchParams = Readonly<Record<string, string | readonly string[] | undefined>>;

/** 前後の空白を落とし、空なら未指定として扱う。 */
function toTrimmed(value: string): string | undefined {
  const trimmed = value.trim();

  return trimmed === "" ? undefined : trimmed;
}

/**
 * 同じキーが 1 度だけ現れる条件を読む。
 *
 * @remarks
 * **繰り返されていたら未指定として扱います**（同じキーの読み方は module 冒頭の規則が持ちます）。
 * 既定へ倒す先は、渡したスキーマの `.catch()` や `.default()` が持ちます。
 *
 * @param schema - 取り出した 1 つの値を照らすスキーマ
 */
export function singleValue<Schema extends z.ZodType>(schema: Schema) {
  return z.preprocess(
    (value) => (typeof value === "string" ? toTrimmed(value) : undefined),
    schema,
  );
}

/**
 * 同じキーの繰り返しを、条件の並びとして読む。
 *
 * @remarks
 * 複数を選べる条件は、区切り文字で連結した 1 つの値ではなく**同じキーの繰り返し**で表します。
 * 1 つだけ選ばれた条件は URL に 1 回しか現れないため、単一の文字列も 1 件の並びとして読みます。
 * 空の値は落とします。入力欄を空にして送った form は `?key=` を URL に残すためです。
 *
 * @param schema - 取り出した並びを照らすスキーマ
 */
export function repeatedValues<Schema extends z.ZodType>(schema: Schema) {
  return z.preprocess((value) => {
    const found = Array.isArray(value) ? value : [value];

    return found.flatMap((one) => (typeof one === "string" ? (toTrimmed(one) ?? []) : []));
  }, schema);
}
