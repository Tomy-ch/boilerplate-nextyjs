#!/usr/bin/env node

// GitHub のラベルを操作する入口。
//
//   create      宣言のうち実在しないラベルだけを作る
//   delete-all  リポジトリのラベルをすべて消す
//
// 宣言の解釈と差分は labels.ts が持ち、ここは gh との遣り取りと終了コードだけを担う。
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { diffLabels, LABELS_PATH, parseLabelSpecs } from "./labels.js";

/** 一度に読むラベルの上限。gh の既定は 30 件で、宣言の全数に届かない。 */
const LIST_LIMIT = 1000;

function main(argv: readonly string[]): void {
  const [command] = argv;

  switch (command) {
    case "create":
      create();
      break;
    case "delete-all":
      deleteAll();
      break;
    default:
      fail("使い方: github-settings <create | delete-all>");
  }
}

function create(): void {
  console.log("🏷 ラベルを作成します...");

  const desired = parseLabelSpecs(readFileSync(LABELS_PATH, "utf8"));
  const { toCreate, alreadyPresent } = diffLabels(listLabelNames(), desired);

  for (const name of alreadyPresent) {
    console.log(`⚠️ ${name} already exists`);
  }

  for (const { name, description, color } of toCreate) {
    console.log(`🔸 create label: ${name}`);
    gh(["label", "create", name, "--description", description, "--color", color]);
  }
}

function deleteAll(): void {
  console.log("🗑 既存のラベルを削除します...");

  for (const name of listLabelNames()) {
    console.log(`🔸 delete label: ${name}`);
    gh(["label", "delete", name, "--yes"]);
  }
}

function listLabelNames(): string[] {
  const listed: { name: string }[] = JSON.parse(
    gh(["label", "list", "--limit", String(LIST_LIMIT), "--json", "name"]),
  );

  return listed.map((label) => label.name);
}

function gh(args: readonly string[]): string {
  return execFileSync("gh", [...args], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

function fail(message: string): never {
  console.error(`❌ ${message}`);
  process.exit(1);
}

try {
  main(process.argv.slice(2));
} catch (e) {
  fail(e instanceof Error ? e.message : String(e));
}
