#!/usr/bin/env node

// 抑止の撤回条件を週に一度見る入口。運用と、見る機構が要る理由は ADR 0110 §3.4 が持つ。
//
//   pnpm exec tsx scripts/suppression-expiry            期限を過ぎた宣言があれば 1 で落ちる
//   pnpm exec tsx scripts/suppression-expiry --report <path>   issue の本文を書き出す

import fs from "node:fs";

import { parseOptions } from "../lib/cli-options.js";
import { renderDigest, renderExpired, renderIssueBody } from "./report.js";
import { expiredSuppressions } from "./rules.js";
import { COMMENT_BORNE_SOURCES, scanSuppressions } from "./scan.js";

/**
 * 判定の基準日。
 *
 * @remarks
 * **抑止の条件は日本時間で書かれている**（`# 2026-08-02 20:34 JST 以降に削除する` のように）ので、
 * 暦日も日本時間で取る。時刻まで持ち込まないのは、実行が CI のどの時間帯かで結果を揺らさない
 * ためで、暦をどこに合わせるかとは別の話である。
 */
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo" }).format(new Date());

const options = parseOptions(process.argv.slice(2));
const suppressions = scanSuppressions();
const expired = expiredSuppressions(suppressions, today);
const reportPath = options.get("report");

if (reportPath !== undefined) {
  fs.writeFileSync(
    reportPath,
    renderIssueBody({
      expired,
      suppressions,
      commentBorneSources: COMMENT_BORNE_SOURCES,
      ...(process.env.RUN_URL === undefined ? {} : { runUrl: process.env.RUN_URL }),
    }),
  );
}

console.log(`— 抑止 ${suppressions.length} 件（基準日 ${today}）`);
console.log(renderDigest(suppressions));

if (expired.length === 0) {
  console.log("\n✓ suppression-expiry: 撤回条件を満たした宣言はありません");
  process.exit(0);
}

console.error(`\n✗ suppression-expiry: ${expired.length} 件が撤回条件を満たしています\n`);
console.error(renderExpired(expired));
console.error(
  "\n条件を満たした宣言は撤去してください。まだなら、条件そのものを書き直してください。",
);
process.exit(1);
