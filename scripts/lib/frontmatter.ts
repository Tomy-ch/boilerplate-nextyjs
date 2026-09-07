import { parse } from "yaml";

import { errorMessage } from "./error-message";

/**
 * Markdown 冒頭の frontmatter。
 *
 * @remarks
 * 読み手が複数ある（層の境界宣言・層別責務の宣言）ため、取り出しをここ 1 箇所に置く。2 通りの
 * 読み方が並ぶと、片方だけが YAML の書式（引用符・コメント・改行後の値）に追従できなくなり、
 * 追従できない側の検査だけが黙って壊れる。
 */
const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---(\r?\n|$)/;

/**
 * 冒頭の frontmatter ブロックを、YAML の本文として取り出す。
 *
 * @returns frontmatter が無ければ null
 */
export function extractFrontmatter(source: string): string | null {
  const matched = FRONTMATTER_PATTERN.exec(source);

  return matched === null ? null : matched[1];
}

/** 宣言の対応表として読める形か。 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * 冒頭の frontmatter を読み、宣言の対応表として返す。
 *
 * @remarks
 * **無いことと壊れていることを分ける。** frontmatter が無い、または本文が空(YAML の `null`)なら
 * 宣言を 1 つも持たないので `null` を返す。YAML として解けない、または対応表の形をしていない
 * frontmatter は投げる —— 宣言が無いものとして素通しすると、書いたつもりの宣言が効かないまま
 * 検査が緑になり、検査していないことと違反が無いことが見分けられなくなる。
 *
 * @param source - Markdown の本文
 * @param origin - 文書の名前。失敗の文言に載せ、どの文書が壊れているかを読めるようにする
 * @returns frontmatter が無い、または本文が空なら null
 * @throws Error frontmatter が YAML として解けない、または対応表として読めないとき
 */
export function parseFrontmatter(source: string, origin: string): Record<string, unknown> | null {
  const block = extractFrontmatter(source);

  if (block === null) {
    return null;
  }

  let parsed: unknown;

  try {
    parsed = parse(block);
  } catch (error) {
    throw new Error(`${origin}: frontmatter が YAML として解けません: ${errorMessage(error)}`, {
      cause: error,
    });
  }

  if (parsed === null || parsed === undefined) {
    return null;
  }

  if (!isRecord(parsed)) {
    throw new Error(`${origin}: frontmatter が宣言の対応表(キーと値の組)になっていません`);
  }

  return parsed;
}
