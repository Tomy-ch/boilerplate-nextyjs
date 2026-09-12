/**
 * SonarCloud の応答から値を取り出す。
 *
 * @remarks
 * 相手は外の service で、こちらの想定どおりの形が返る保証はありません。**読めない形をここで
 * 例外にせず、呼び出し側が渡した既定値へ倒します** —— 応答の形が変わったことが「解析が失敗した」
 * として現れると、原因の在り処がずれます。止める判断（解析が FAILED で終わった、ゲートが
 * 落ちた）は、既定値を受け取った側が持ちます。
 */

/**
 * その値を record と見て、名前の付いた 1 段を取り出す。
 *
 * @returns record でなければ `undefined`。
 */
export function fieldOf(value: unknown, name: string): unknown {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  return (value as Record<string, unknown>)[name];
}

/**
 * 文字列として読む。数値も綴りへ直して受ける。
 *
 * @remarks
 * 数値を弾かないのは、ここが読むのが**人へ見せる綴り**（閾値・実測値・状態の名前）だからです。
 * 型で弾くと、値は届いているのに既定値が出ます。
 */
export function textOf(value: unknown, fallback: string): string {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number") {
    return String(value);
  }

  return fallback;
}

/** 数値として読む。数値でなければ既定値。 */
export function numberOf(value: unknown, fallback: number): number {
  return typeof value === "number" ? value : fallback;
}

/**
 * 配列として読む。配列でなければ空。
 *
 * @remarks
 * **空へ倒したことは、受け取る側から「0 件だった」と見分けが付きません。** 件数がそのまま
 * 報告になる場所（所見の一覧）でこれを使ってよいのは、取得そのものの失敗を手前で落として
 * あるからです。
 */
export function itemsOf(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}
