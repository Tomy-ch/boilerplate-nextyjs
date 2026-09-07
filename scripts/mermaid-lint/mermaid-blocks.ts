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

  // 閉じフェンスまでの行（開いたまま終わるときは末尾まで）は本文であって、次の開きを探す対象では
  // ない。
  let consumedThrough = -1;

  for (const [i, line] of lines.entries()) {
    if (i <= consumedThrough) {
      continue;
    }

    const [, , marker] = FENCE_PATTERN.exec(line) ?? [];

    if (marker === undefined) {
      continue;
    }

    const closing = new RegExp(
      `^\\s*${marker.startsWith("`") ? "`" : "~"}{${marker.length},}\\s*$`,
    );
    const rest = lines.slice(i + 1);
    const closingAt = rest.findIndex((candidate) => closing.test(candidate));
    const body = closingAt === -1 ? rest : rest.slice(0, closingAt);

    blocks.push({ startLine: i + 1, code: body.join("\n") });
    consumedThrough = closingAt === -1 ? lines.length : i + 1 + closingAt;
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
