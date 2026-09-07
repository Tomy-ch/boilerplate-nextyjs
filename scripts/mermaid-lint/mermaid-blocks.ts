import { errorMessage } from "../lib/error-message.js";

/** Markdown 中の mermaid フェンス 1 つ分。 */
export type MermaidBlock = {
  /** フェンス開始行（1 始まり）。 */
  startLine: number;
  /** フェンスの中身。 */
  code: string;
};

const FENCE_PATTERN = /^(\s*)(`{3,}|~{3,})\s*mermaid\s*$/;

/**
 * Markdown から ```mermaid フェンスを開始行付きで抜き出す。
 *
 * @remarks
 * 閉じは「フェンス文字だけの行」に限ります。行末まで見ないと、内側に現れる ```mermaid を
 * 閉じと取り違えて、以降のブロックがまとめて 1 つに化けます。
 */
export function extractMermaidBlocks(content: string): MermaidBlock[] {
  const lines = content.split("\n");
  const blocks: MermaidBlock[] = [];

  for (let i = 0; i < lines.length; i++) {
    const opening = FENCE_PATTERN.exec(lines[i]);

    if (!opening) {
      continue;
    }

    const marker = opening[2];
    const closing = new RegExp(
      `^\\s*${marker.startsWith("`") ? "`" : "~"}{${marker.length},}\\s*$`,
    );
    const body: string[] = [];
    let j = i + 1;

    for (; j < lines.length; j++) {
      if (closing.test(lines[j])) {
        break;
      }

      body.push(lines[j]);
    }

    blocks.push({ startLine: i + 1, code: body.join("\n") });
    i = j;
  }

  return blocks;
}

/**
 * 依存を解決できなかったことによる失敗か。
 *
 * @remarks
 * mermaid 図の文法問題と環境未整備は、利用者が取る対処が違います。区別できないと
 * 「図を直す」方向で時間を使わせます。
 */
export function isDependencyMissing(error: unknown): boolean {
  if (error === null || error === undefined) {
    return false;
  }

  return (
    (error as NodeJS.ErrnoException).code === "ERR_MODULE_NOT_FOUND" ||
    /cannot find (package|module)/i.test(errorMessage(error))
  );
}
