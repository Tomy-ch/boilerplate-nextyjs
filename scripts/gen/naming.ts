/**
 * 生成対象の名前を命名規約へ照らす。
 *
 * @remarks
 * ファイル名は kebab-case、識別子は PascalCase という対応が決まっているため、利用者から
 * 受け取るのは kebab-case の 1 つだけにし、識別子はここで導出します。両方を受け取ると、
 * 綴りが食い違った雛形を作れてしまいます。
 */

/** kebab-case として受け付ける形。先頭は英小文字、以降は英小数字とハイフン 1 個ずつ。 */
const KEBAB_CASE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

/**
 * 名前が kebab-case でなければ、理由を述べた文言を返す。
 *
 * @returns 規約を満たすなら `null`。満たさないなら利用者へ見せる 1 行。
 */
export function validateName(name: string): string | null {
  if (name === "") {
    return "名前が空です。kebab-case で指定してください（例: report-detail）。";
  }

  if (!KEBAB_CASE.test(name)) {
    return `名前 "${name}" は kebab-case ではありません。英小文字で始め、区切りはハイフン 1 つにしてください（例: report-detail）。`;
  }

  return null;
}

/**
 * kebab-case の名前を PascalCase の識別子へ変換する。
 *
 * @example
 * `report-detail` → `ReportDetail`
 */
export function toPascalCase(name: string): string {
  return name
    .split("-")
    .map((segment) => `${segment.charAt(0).toUpperCase()}${segment.slice(1)}`)
    .join("");
}
