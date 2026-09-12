// 資格情報を要するスキャナを撤去する入口。製品ごとに、ファイル・宛先の宣言・action の pin を
// 始末し、1 製品 1 コミットで記録する。
//
// **撤去は選択であって剥がしではない。**CodeQL はライセンス（public は無料・private は GitHub
// Advanced Security）、SonarQube Cloud はベンダーのトークン、Dependency Review は Dependency
// graph の有効化を要する —— どれも設定の判断であってコードの判断ではないので、既定は配ることに
// あり、外すかどうかはこのリポジトリを持つ側が決める（[0110](../../../docs/adr/0110-security-operations.md)）。
//
// 3 つとも、必要なものが無ければ自分を飛ばして緑を返す。**未設定は検査の結果ではなくセットアップ
// の未了である**ため、決めるまでの間に壊れるものは無い。

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { dropOrphanedPins } from "../lib/actions-pin.js";
import { dropOrphanedEndpoints } from "../lib/egress-declaration.js";
import { listFilesRecursive, removeTarget, toRelativePath, updateFile } from "../lib/file-utils.js";
import { exitWithUsage, parseCommonFlags, ROOT_DIR } from "../lib/runtime.js";
import { SCANNER_DOMAINS, type ScannerDomain } from "./scanner-manifest.js";
import {
  findMentions,
  isPinReferenced,
  type Mention,
  removeSection,
  replaceExact,
} from "./scanner-removal.js";

const ACTIONS_PIN_LOCK_FILE = ".github/actions-pin.toml";
const EGRESS_DECLARATION_FILE = ".github/egress.yaml";
const WORKFLOWS_DIR = ".github/workflows";

function printUsage(): void {
  console.log(
    [
      "使い方: pnpm exec tsx scripts/setup/remove-licensed-scanners [--dry-run]",
      "",
      "  資格情報を要するスキャナを 3 つまとめて撤去する。撤去済みの製品には手を付けない。",
      `  対象: ${SCANNER_DOMAINS.map((domain) => domain.key).join(" / ")}`,
      "",
      "  --dry-run  実際には書き換えず、対象だけを表示する",
      "",
      "  製品ごとに別のコミットへ分ける。1 つだけ残したくなったらそのコミットを git revert する。",
    ].join("\n"),
  );
}

/** 撤去後も残る workflow の本文。pin の参照を数えるために読む。 */
function survivingWorkflowContents(removedPaths: ReadonlySet<string>): string[] {
  return listFilesRecursive(path.join(ROOT_DIR, WORKFLOWS_DIR))
    .map((filePath) => toRelativePath(filePath).split(path.sep).join("/"))
    .filter((relativePath) => !removedPaths.has(relativePath))
    .map((relativePath) => fs.readFileSync(path.join(ROOT_DIR, relativePath), "utf8"));
}

function removeDomain(domain: ScannerDomain, dryRun: boolean): void {
  const removed: string[] = [];

  for (const target of domain.paths) {
    const result = removeTarget(target, dryRun);
    if (result !== null) removed.push(result);
  }

  const surviving = survivingWorkflowContents(new Set(domain.paths));
  const orphaned = domain.pinActions.filter((action) => !isPinReferenced(action, surviving));

  if (orphaned.length > 0) {
    updateFile(ACTIONS_PIN_LOCK_FILE, (content) => dropOrphanedPins(content, orphaned), dryRun);
  }

  updateFile(
    EGRESS_DECLARATION_FILE,
    (content) => dropOrphanedEndpoints(content, domain.egressJobs),
    dryRun,
  );

  console.log(`[${domain.label}]`);
  for (const target of removed) console.log(`- 削除 ${target}`);
  for (const action of orphaned) console.log(`- pin 除去 ${action}`);
  for (const job of domain.egressJobs) console.log(`- 宛先の宣言を除去 ${job}`);
  if (domain.pinActions.length > orphaned.length) {
    const kept = domain.pinActions.filter((action) => !orphaned.includes(action));
    console.log(`- pin は残す（他の workflow が参照している）: ${kept.join(" / ")}`);
  }

  for (const { file, block } of domain.docBlocks) {
    updateFile(file, (content) => replaceExact(content, block, "", file, "塊"), dryRun);
  }

  for (const { file, fragment, replacement } of domain.docFragments) {
    updateFile(
      file,
      (content) => replaceExact(content, fragment, replacement, file, "語句"),
      dryRun,
    );
  }

  for (const { file, heading } of domain.docSections) {
    updateFile(file, (content) => removeSection(content, heading, file), dryRun);
  }

  const edited = domain.docBlocks.length + domain.docFragments.length + domain.docSections.length;

  if (edited > 0) console.log(`- 文書を書き換え ${edited} 箇所`);
}

/**
 * 撤去した製品の名前が残っている行を拾う。
 *
 * @remarks
 * **全製品を終えてから 1 度だけ走らせます。**製品ごとに拾うと、後続の製品が文書を書き換えた時点で
 * 行番号がずれ、報告が指す先に何も無くなります。
 */
function residualMentions(domains: readonly ScannerDomain[]): readonly Mention[] {
  const files = new Set(domains.flatMap((domain) => domain.docMentions));

  return [...files].flatMap((file) => {
    const absolute = path.join(ROOT_DIR, file);

    if (!fs.existsSync(absolute)) return [];

    const content = fs.readFileSync(absolute, "utf8");

    return domains.flatMap((domain) => findMentions(file, content, domain.mentionPatterns));
  });
}

function commit(domain: ScannerDomain): void {
  execFileSync(
    "git",
    [
      "add",
      "--",
      ...domain.paths,
      ACTIONS_PIN_LOCK_FILE,
      EGRESS_DECLARATION_FILE,
      ...new Set([
        ...domain.docBlocks.map((entry) => entry.file),
        ...domain.docFragments.map((entry) => entry.file),
        ...domain.docSections.map((entry) => entry.file),
      ]),
    ],
    { cwd: ROOT_DIR },
  );
  execFileSync("git", ["commit", "--no-verify", "-m", domain.commitSubject], { cwd: ROOT_DIR });
}

function run(dryRun: boolean): void {
  const removed: ScannerDomain[] = [];

  for (const domain of SCANNER_DOMAINS) {
    if (!fs.existsSync(path.join(ROOT_DIR, domain.presenceMarker))) {
      console.log(`[${domain.label}] 撤去済みのため何もしない`);
      continue;
    }

    removeDomain(domain, dryRun);
    removed.push(domain);
    if (!dryRun) commit(domain);
  }

  if (removed.length === 0) {
    console.log("撤去する製品がありません。");
    return;
  }

  const mentions = dryRun ? [] : residualMentions(removed);

  if (mentions.length > 0) {
    console.log("");
    console.log("宣言で拾い切れていない言及が、次の行に残っています:");
    const seen = new Set<string>();
    for (const mention of mentions) {
      const at = `${mention.file}:${mention.line}`;
      if (seen.has(at)) continue;
      seen.add(at);
      console.log(`- ${at}`);
    }
  }

  if (dryRun) console.log("\n--dry-run のため何も書き換えていません。");
}

const options = parseCommonFlags(process.argv.slice(2));

if (options.help) {
  printUsage();
  process.exit(0);
}

try {
  run(options.dryRun);
} catch (error) {
  exitWithUsage(error instanceof Error ? error : new Error(String(error)), printUsage);
}
