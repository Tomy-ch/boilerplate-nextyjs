/**
 * SKILL / agent 定義の frontmatter と見出しの読み取り。
 *
 * @remarks
 * 読み取り済みの本文から構造を取り出すところだけを持ちます。ファイルの実在確認と報告は
 * 入口が担います。
 */

/** frontmatter と本文の切り分け結果。 */
export type Frontmatter = {
  lines: string[];
  /** 閉じの `---` がある行（1 始まり）。 */
  endLine: number;
};

/** 本文中の見出し 1 件。 */
export type Heading = {
  level: number;
  text: string;
  lineNo: number;
};
// 行を走査しつつコードフェンス（``` / ~~~）の内外を判定する。
// フェンス内は例示・出力サンプルであり実在性を保証しない前提のため、検査対象から外す。
// スキル本文は Markdown を含む Markdown（```markdown の中に ```json）を書くため、閉じ判定は
// CommonMark どおり「情報文字列を持たない同種・同長以上のフェンス行」に限る。
export function* eachLineOutsideFence(
  content: string,
): Generator<{ line: string; lineNo: number }> {
  const lines = content.split("\n");
  let fence: string | null = null;
  for (const [i, line] of lines.entries()) {
    const opener = /^[ \t]*(`{3,}|~{3,})/.exec(line);
    const marker = opener?.[1];
    const info = opener === null ? undefined : line.slice(opener[0].length);
    if (fence) {
      const closes =
        marker !== undefined &&
        info !== undefined &&
        marker.startsWith(fence.charAt(0)) &&
        marker.length >= fence.length &&
        info.trim() === "";
      if (closes) fence = null;
      continue;
    }
    if (marker !== undefined) {
      fence = marker;
      continue;
    }
    yield { line, lineNo: i + 1 };
  }
}

export function splitFrontmatter(content: string): Frontmatter | null {
  const lines = content.split("\n");
  if (lines[0] !== "---") return null;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === "---") return { lines: lines.slice(1, i), endLine: i + 1 };
  }
  return null;
}

// frontmatter のトップレベルキーと値を取り出す。折り畳みスカラ（`key: >-`）は後続の
// インデント行を連結して値とする（YAML パーサを持ち込まずに済む範囲に限定した簡易解析）。
export function parseFrontmatterKeys(fmLines: string[]): Map<string, string> {
  const keys = new Map<string, string>();
  for (const [i, fmLine] of fmLines.entries()) {
    const [, key, raw] = /^([\w-]+):(.*)$/.exec(fmLine) ?? [];
    if (key === undefined || raw === undefined) continue;
    let value = raw.trim();
    if (value === ">-" || value === ">" || value === "|" || value === "|-") {
      const folded: string[] = [];
      for (const continuation of fmLines.slice(i + 1)) {
        if (continuation.trim() !== "" && !/^\s/.test(continuation)) break;
        folded.push(continuation.trim());
      }
      value = folded.join(" ").trim();
    }
    keys.set(key, value);
  }
  return keys;
}

export function extractHeadings(content: string): Heading[] {
  const headings: Heading[] = [];
  for (const { line, lineNo } of eachLineOutsideFence(content)) {
    const [, hashes, raw] = /^(#{1,6})[ \t](.*)$/.exec(line) ?? [];
    const text = raw?.trim();
    // 文言が空でも列から落とさない。落とすと、片側にだけ在る見出しで**対訳の列がずれた分だけ
    // 詰まって揃い**、本来報告すべき構造ずれが無報告になる。空であることは呼び出し側が見る。
    if (hashes !== undefined && text !== undefined) {
      headings.push({ level: hashes.length, text, lineNo });
    }
  }
  return headings;
}
