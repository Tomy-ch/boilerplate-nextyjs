// テスト実行系の JSON レポート（Vitest / Playwright）から、失敗だけの報告本文を書き出す入口。
//
// 組み立ては [format.ts](format.ts) が持つ。ここが担うのは読み書きと終了コードだけである。
//
//   pnpm exec tsx scripts/test-report <report.json> <tail.log> <出力先>
//
// **読めなかったら黙って空にしない。** JSON が無い・壊れている・形が違うのは「失敗が無い」ではなく「何が起きたか
// 分からない」であり、そのまま緑の報告へ倒すと壊れた瞬間から永久に通る
// （[0157](../../docs/adr/0157-inspection-declaration-discipline.md)）。理由を本文に書いて、末尾のログを添える。
import fs from "node:fs";

import { codeBlock, formatReport, summarise } from "./format";

const [, , reportPath, tailPath, outputPath] = process.argv;

if (!reportPath || !tailPath || !outputPath) {
  process.stderr.write("使い方: tsx scripts/test-report <report.json> <tail.log> <出力先>\n");
  process.exit(2);
}

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

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [
      "**JSON レポートを読めませんでした（壊れた JSON）。**",
      "末尾のログを添えます。",
      "",
      ...codeBlock(tailLog.trim()),
    ].join("\n");
  }

  const summary = summarise(parsed);
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
