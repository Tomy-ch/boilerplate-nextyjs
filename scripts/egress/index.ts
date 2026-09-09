#!/usr/bin/env node

// runner の外向き通信を、宣言どおりに固定する入口。
//
//   apply   `.github/egress.yaml` を workflow へ反映する
//   check   宣言との差分で落とす（ネットワークへは出ない）
//
// 判定の中身は apply-check.ts が持ち、宣言の読み取りは declaration.ts が持つ。
import { resolve } from "node:path";
import { runEgress, workflowNames } from "./apply-check.js";
import { DECLARATION_FILE, orphanKeys, readDeclaration } from "./declaration.js";

const USAGE = "usage: egress <apply|check>";

/**
 * 宣言が読めない・走査対象が 0 件、といった検査そのものが成立していない状態。
 *
 * @remarks
 * 違反（exit 1）と分けるのは、**0 件を「違反なし」へ寄せない**ためです。宣言を読み違えた
 * 状態が合格として通ると、この検査が守っている不変条件が黙って消えます。
 */
const BROKEN = 2;

function main(): void {
  const command = process.argv[2];

  if (command !== "apply" && command !== "check") {
    console.error(USAGE);
    process.exit(1);
  }

  const root = resolve(import.meta.dirname, "../..");
  const declaration = readDeclaration(resolve(root, DECLARATION_FILE));
  const names = workflowNames(root);

  if (names.length === 0) {
    console.error(`❌ ${DECLARATION_FILE} の走査対象が 1 件もありません。`);
    process.exit(BROKEN);
  }

  const orphans = orphanKeys(declaration, names);
  const report = runEgress(root, declaration, command === "check");

  for (const at of report.malformed) {
    console.error(`❌ ${at}: harden-runner の形が想定と違うため書き換えられません。`);
  }

  for (const key of orphans) {
    console.error(`❌ ${DECLARATION_FILE}: ${key} に対応する workflow がありません。`);
  }

  if (report.audited.length > 0) {
    console.error(`⚠️ 監査のまま: ${report.audited.join(", ")}（理由は ${DECLARATION_FILE}）`);
  }

  if (report.malformed.length > 0 || orphans.length > 0) process.exit(1);

  if (command === "apply") {
    console.error(
      report.updated.length === 0
        ? "✅ 宣言どおりに固定済みです。"
        : `✅ ${report.updated.length} ファイルを書き換えました。`,
    );

    return;
  }

  if (report.drifted.length > 0) {
    for (const file of report.drifted) {
      console.error(`❌ ${file}: 宣言と食い違っています。make egress-apply を実行してください。`);
    }
    process.exit(1);
  }

  console.error(`✅ workflow ${names.length} 件の外向き通信が宣言どおりに固定されています。`);
}

main();
