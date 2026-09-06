#!/usr/bin/env node

// 抑止の撤回条件を週に一度見る入口。運用と、見る機構が要る理由は ADR 0110 §3.4 が持つ。
//
//   pnpm exec tsx scripts/suppression-expiry     期限を過ぎた宣言があれば 1 で落ちる
//
// SUPPRESSION_REPORT を環境から渡すと、その先へ issue の本文を書き出す。引数ではなく環境から
// 受けるのは、呼ぶ側の make が外から来る値を recipe 行へ展開しないためである
// （.makefiles/README.md）。

import fs from "node:fs";

import { renderDigest, renderExpired, renderIssueBody } from "./report.js";
import { expiredSuppressions } from "./rules.js";
import { COMMENT_BORNE_SOURCES, scanSuppressions } from "./scan.js";

/**
 * 判定の基準日。
 *
 * @remarks
 * **抑止の条件は日本時間の暦日で書かれている**ので、暦日も日本時間で取る。UTC で取ると、日付を
 * またぐ時間帯に走った実行だけ判定が 1 日ずれる。時刻までは持ち込まない —— 条件に時刻を書く
 * 宣言は無い（`rules.ts` の `DATE_PATTERN`）。
 */
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo" }).format(new Date());

const suppressions = scanSuppressions();
const expired = expiredSuppressions(suppressions, today);
const reportPath = process.env["SUPPRESSION_REPORT"];

if (reportPath !== undefined && reportPath !== "") {
  fs.writeFileSync(
    reportPath,
    renderIssueBody({
      expired,
      suppressions,
      commentBorneSources: COMMENT_BORNE_SOURCES,
      ...(process.env["RUN_URL"] === undefined ? {} : { runUrl: process.env["RUN_URL"] }),
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
