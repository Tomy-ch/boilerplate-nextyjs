#!/usr/bin/env node

// 実装タスクの issue が必須項目を持っているかを見る入口。判定は required-fields.ts が持つ。
//
//   pnpm exec tsx scripts/issue-field-lint            開いている実装タスクを見る
//   pnpm exec tsx scripts/issue-field-lint --all      閉じたものも含めて見る
import { execFileSync } from "node:child_process";

import { type IssueBody, missingRequiredFields } from "./required-fields.js";

function listIssues(requested: string): readonly IssueBody[] {
  const raw = execFileSync(
    "gh",
    ["issue", "list", "--state", requested, "--limit", "200", "--json", "number,title,body"],
    { encoding: "utf8" },
  );

  return (JSON.parse(raw) as { number: number; title: string; body: string | null }[]).map(
    (issue) => ({ number: issue.number, title: issue.title, body: issue.body ?? "" }),
  );
}

const issueState = process.argv.includes("--all") ? "all" : "open";
const missing = missingRequiredFields(listIssues(issueState));

if (missing.length === 0) {
  console.log("✓ issue-field-lint: 実装タスクの必須項目はすべて埋まっています");
  process.exit(0);
}

console.error(`✗ issue-field-lint: ${missing.length} 件の欠け\n`);
for (const entry of missing) {
  console.error(`  #${entry.number} ${entry.title} —— 「${entry.field}」が無い`);
}
console.error(
  "\nテンプレートの必須項目は Web フォームしか縛りません。--body-file で起票するときは自分で書いてください。",
);
process.exit(1);
