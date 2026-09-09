#!/usr/bin/env node

// 抑止の撤回条件を週に一度見る入口。運用と、見る機構が要る理由は [README](../README.md) から辿る。
//
//   pnpm exec tsx scripts/suppression-expiry     期限を過ぎた宣言、または様式を満たさない宣言が
//                                                あれば 1 で落ちる
//
// SUPPRESSION_REPORT を環境から渡すと、その先へ issue の本文を書き出す。引数ではなく環境から
// 受けるのは、呼ぶ側の make が外から来る値を recipe 行へ展開しないためである
// （.makefiles/README.md）。

import fs from "node:fs";

import { calendarDay } from "../lib/withdrawal-date.js";
import { renderDigest, renderExpired, renderIssueBody, renderMalformed } from "./report.js";
import { expiredSuppressions, malformedSuppressions } from "./rules.js";
import { COMMENT_BORNE_SOURCES, scanSuppressions } from "./scan.js";

const today = calendarDay(new Date());

const suppressions = scanSuppressions();
const expired = expiredSuppressions(suppressions, today);
const malformed = malformedSuppressions(suppressions);
const reportPath = process.env["SUPPRESSION_REPORT"];

if (reportPath !== undefined && reportPath !== "") {
  fs.writeFileSync(
    reportPath,
    renderIssueBody({
      expired,
      malformed,
      suppressions,
      commentBorneSources: COMMENT_BORNE_SOURCES,
      ...(process.env["RUN_URL"] === undefined ? {} : { runUrl: process.env["RUN_URL"] }),
    }),
  );
}

console.log(`— 抑止 ${suppressions.length} 件（基準日 ${today}）`);
console.log(renderDigest(suppressions));

if (expired.length > 0) {
  console.error(`\n✗ suppression-expiry: ${expired.length} 件が撤回条件を満たしています\n`);
  console.error(renderExpired(expired));
  console.error(
    "\n条件を満たした宣言は撤去してください。まだなら、条件そのものを書き直してください。",
  );
}

if (malformed.length > 0) {
  console.error(`\n✗ suppression-expiry: ${malformed.length} 件が様式を満たしていません\n`);
  console.error(renderMalformed(malformed));
  console.error(
    "\n理由と撤回条件を書き足してください。書けない宣言は置かず、値そのものを直してください。",
  );
}

if (expired.length > 0 || malformed.length > 0) {
  process.exit(1);
}

console.log("\n✓ suppression-expiry: 撤回条件を満たした宣言も、様式を欠く宣言もありません");
