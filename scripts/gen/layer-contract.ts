/**
 * 生成先の層が宣言している契約を、その層の README から実行時に読む。
 *
 * @remarks
 * `imports-allowed` は `architecture.ts` から導けますが、`forbidden` と `test-requirement` は
 * 層 README にしか無く、しかも `fetch` / `business-logic` のようにカーネル名でない語を含みます。
 * ここへ写すと層の宣言が 2 箇所になるため、読み取りだけを持ちます。
 */

/** 層 README の frontmatter が宣言する、生成物へ引き継ぐ値。 */
export type LayerContract = {
  /** その層が受け付けない対象。README の語をそのまま引き継ぐ。 */
  readonly forbidden: readonly string[];
  /** その層のテスト責務（層別責務表を引く鍵）。 */
  readonly testRequirement: string;
};

/** `key: [a, b]` 形式の 1 行から値を取り出す。 */
function readListValue(frontmatter: string, key: string): string[] | null {
  const matched = new RegExp(String.raw`^${key}:\s*\[(.*)\]\s*$`, "m").exec(frontmatter)?.[1];

  if (matched === undefined) {
    return null;
  }

  return matched
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry !== "");
}

/** `key: value` 形式の 1 行から値を取り出す。 */
function readScalarValue(frontmatter: string, key: string): string | null {
  return new RegExp(String.raw`^${key}:\s*(\S+)\s*$`, "m").exec(frontmatter)?.[1] ?? null;
}

/**
 * 層 README の本文から契約を読む。
 *
 * @param readmeText 層 README の全文。frontmatter を含む。
 * @returns 読み取れた契約。frontmatter が無い / 必要な宣言が欠けている場合は `null`。
 */
export function readLayerContract(readmeText: string): LayerContract | null {
  const frontmatter = /^---\n([\s\S]*?)\n---/.exec(readmeText)?.[1];

  if (frontmatter === undefined) {
    return null;
  }

  const forbidden = readListValue(frontmatter, "forbidden");
  const testRequirement = readScalarValue(frontmatter, "test-requirement");

  if (forbidden === null || testRequirement === null) {
    return null;
  }

  return { forbidden, testRequirement };
}
