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
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const marker = /^\s*(`{3,}|~{3,})(.*)$/.exec(line);
    if (fence) {
      const closes =
        marker !== null &&
        marker[1][0] === fence[0] &&
        marker[1].length >= fence.length &&
        marker[2].trim() === "";
      if (closes) fence = null;
      continue;
    }
    if (marker) {
      fence = marker[1];
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
  for (let i = 0; i < fmLines.length; i++) {
    const m = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(fmLines[i]);
    if (!m) continue;
    let value = m[2].trim();
    if (value === ">-" || value === ">" || value === "|" || value === "|-") {
      const folded: string[] = [];
      for (let j = i + 1; j < fmLines.length; j++) {
        if (fmLines[j].trim() !== "" && !/^\s/.test(fmLines[j])) break;
        folded.push(fmLines[j].trim());
      }
      value = folded.join(" ").trim();
    }
    keys.set(m[1], value);
  }
  return keys;
}

export function extractHeadings(content: string): Heading[] {
  const headings: Heading[] = [];
  for (const { line, lineNo } of eachLineOutsideFence(content)) {
    const m = /^(#{1,6})\s+(.*?)\s*$/.exec(line);
    if (m) headings.push({ level: m[1].length, text: m[2], lineNo });
  }
  return headings;
}
