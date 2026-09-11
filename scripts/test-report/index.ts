// テスト実行系の JSON レポート（Vitest / Playwright）から、失敗だけの報告本文を書き出す入口。
//
// 組み立ては [format.ts](format.ts) が持つ。ここが担うのは読み書きと終了コードだけである。
//
//   pnpm exec tsx scripts/test-report <report.json> <tail.log> <出力先>
//
// **読めなかったら黙って空にしない。** JSON が無い・壊れている・形が違うのは「失敗が無い」ではなく「何が起きたか
// 分からない」であり、そのまま緑の報告へ倒すと壊れた瞬間から永久に通る
// （[README](../README.md)）。理由を本文に書いて、末尾のログを添える。
import fs from "node:fs";
import path from "node:path";

import { codeBlock, formatReport, type Summary, summarise } from "./format";

/** 触ってよい場所。作業ツリーと、実行系が中間物を置く場所に限る。 */
const ALLOWED_ROOTS = [process.cwd(), "/tmp", "/private/tmp"] as const;

/** 書き出し先としてだけ許す、ファイルでない綴り。 */
const ALLOWED_SINKS = ["/dev/stdout", "/dev/stderr", "/dev/null"] as const;

/**
 * 引数で渡された道を、触ってよい場所の内側に限る。
 *
 * @remarks
 * ここは CI の recipe からも手元からも呼ばれ、**引数をそのまま `fs` へ渡していた**。呼ぶ側を
 * 間違えれば作業ツリーの外を読み書きできてしまうので、入口で閉じる。区切りまで見るので、
 * `/tmp` の隣（`/tmpfoo`）は内側にならない。
 */
function resolveInside(candidate: string, sinks: readonly string[] = []): string {
  const resolved = path.resolve(candidate);
  if (sinks.includes(resolved)) return resolved;

  const inside = ALLOWED_ROOTS.some(
    (root) =>
      resolved === path.resolve(root) || resolved.startsWith(`${path.resolve(root)}${path.sep}`),
  );
  if (!inside) {
    process.stderr.write(`触ってよい場所の外を指しています: ${candidate}\n`);
    process.exit(2);
  }

  return resolved;
}

const [, , reportArg, tailArg, outputArg] = process.argv;

if (!reportArg || !tailArg || !outputArg) {
  process.stderr.write("使い方: tsx scripts/test-report <report.json> <tail.log> <出力先>\n");
  process.exit(2);
}

const reportPath = resolveInside(reportArg);
const tailPath = resolveInside(tailArg);
const outputPath = resolveInside(outputArg, ALLOWED_SINKS);

const tailLog = ((): string => {
  try {
    return fs.readFileSync(tailPath, "utf8");
  } catch {
    return "(末尾のログを読めませんでした)";
  }
})();

const body = ((): string => {
  let raw: string;
  try {
    raw = fs.readFileSync(reportPath, "utf8");
  } catch {
    return [
      `**JSON レポート（\`${reportPath}\`）がありません。**`,
      "失敗が無かったのか、レポートを書く前に落ちたのかを、この報告からは決められません。",
      "末尾のログを添えます。",
      "",
      ...codeBlock(tailLog.trim()),
    ].join("\n");
  }

  let summary: Summary | undefined;
  try {
    summary = summarise(raw);
  } catch {
    return [
      "**JSON レポートを読めませんでした（形が期待と違います）。**",
      "失敗が無かったのか、レポートの形が変わったのかを、この報告からは決められません。",
      "末尾のログを添えます。",
      "",
      ...codeBlock(tailLog.trim()),
    ].join("\n");
  }

  if (!summary) {
    return [
      "**JSON レポートの形を見分けられませんでした**（Vitest でも Playwright でもない）。",
      "失敗が無かったのか、別の実行系が書いたのかを、この報告からは決められません。",
      "末尾のログを添えます。",
      "",
      ...codeBlock(tailLog.trim()),
    ].join("\n");
  }

  return formatReport(summary, tailLog);
})();

fs.writeFileSync(outputPath, `${body}\n`);
