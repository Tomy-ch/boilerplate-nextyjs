#!/usr/bin/env node

// SAST が読むルール集合を、固定した commit から取り出して置く。
//
// `make sast` はこれを先に呼び、`--config tmp/opengrep-rules` を読む。レジストリ（semgrep.dev）
// は引かない —— 理由は manifest.ts が持つ。
//
// 2 つの mode を持つ。既定は取得と照合で、`--resolve` は commit を上げた人がロックファイルを
// 書き直すためのもの。`actions-pin` の resolve / check と同じ形で、**digest を人が写す工程を
// 作らない**。
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { readLock, writeLock } from "../lib/pin-lockfile.js";
import { ruleSetDigest } from "./digest.js";
import { pinKey, readPin } from "./lock.js";
import { RULES_DIR, RULES_LOCK_FILE, RULES_LOCK_FORMAT, RULES_REPO } from "./manifest.js";
import { selectRuleMembers } from "./selection.js";

function printUsage(): void {
  console.log(
    [
      "使い方: pnpm exec tsx scripts/opengrep-rules [--resolve [--commit <sha>]]",
      "",
      `  ${RULES_LOCK_FILE} が固定する commit から SAST のルールを ${RULES_DIR} へ取り出す。`,
      "  取り出した集合の digest をロックファイルと照合し、違えば何も置かずに落ちる。",
      "",
      "  --resolve         取り出した digest をロックファイルへ書き直す",
      "  --commit <sha>    --resolve と併せて、固定する commit を差し替える",
    ].join("\n"),
  );
}

function main(): void {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    printUsage();
    return;
  }
  const resolving = args.includes("--resolve");

  const root = process.cwd();
  const lockFile = path.join(root, RULES_LOCK_FILE);
  const target = path.join(root, RULES_DIR);

  const commit = commitArgument(args) ?? readPin(readLock(lockFile, RULES_LOCK_FORMAT)).commit;
  const pinned = resolving ? null : readPin(readLock(lockFile, RULES_LOCK_FORMAT)).digest;

  // 既に固定どおりのものが置いてあれば何もしない。CI は毎回取りに行くが、手元で `make sast` を
  // 繰り返すときに毎回 1 MB を落とさせない。
  if (pinned !== null && fs.existsSync(target) && digestOf(target) === pinned) {
    console.log(`✅ ${RULES_DIR} は ${RULES_REPO}@${commit.slice(0, 7)} で固定済みです`);
    return;
  }

  // 追跡しない置き場なので、複製したてのツリーには存在しない。CI は毎回そこから始まる。
  const scratch = path.join(root, "tmp");
  fs.mkdirSync(scratch, { recursive: true });

  const work = fs.mkdtempSync(path.join(scratch, "opengrep-rules-"));
  try {
    const archive = path.join(work, "rules.tar.gz");
    download(archive, commit);

    const members = selectRuleMembers(listMembers(archive));
    if (members.length === 0) {
      throw new Error(
        `${RULES_REPO}@${commit} から取り出すルールが 1 件もありません（置き場の構成が変わった可能性があります）`,
      );
    }

    const staged = path.join(work, "rules");
    fs.mkdirSync(staged, { recursive: true });
    extract(archive, staged, members, work);

    const digest = digestOf(staged);
    if (pinned === null) {
      writeLock(lockFile, new Map([[pinKey(commit), digest]]), RULES_LOCK_FORMAT);
      console.log(`✅ ルール ${members.length} 件を ${RULES_LOCK_FILE} へ固定しました`);
      console.log(`   ${pinKey(commit)} = ${digest}`);
      return;
    }
    // 固定した中身と違うものを置かない。**置いてから照合すると、落ちた後のツリーに
    // 照合できなかったルールが残り、次の実行が「固定済み」と読む。**
    if (digest !== pinned) {
      throw new Error(
        [
          `取り出したルールが ${RULES_LOCK_FILE} の固定と一致しません（${RULES_REPO}@${commit}）`,
          `  宣言: ${pinned}`,
          `  実際: ${digest}`,
          "  commit を上げたなら --resolve で固定し直してください。",
        ].join("\n"),
      );
    }

    fs.rmSync(target, { recursive: true, force: true });
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.renameSync(staged, target);
    console.log(`✅ ルール ${members.length} 件を ${RULES_DIR} へ置きました`);
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

function commitArgument(args: readonly string[]): string | null {
  const at = args.indexOf("--commit");
  if (at === -1) return null;
  const value = args[at + 1];
  if (value === undefined || !/^[0-9a-f]{40}$/.test(value)) {
    throw new Error("--commit には 40 桁の小文字 16 進を渡します");
  }
  return value;
}

function download(archive: string, commit: string): void {
  // --fail-with-body: 404 の本文をアーカイブとして保存しない。
  execFileSync(
    "curl",
    [
      "--fail-with-body",
      "-sSL",
      "--retry",
      "5",
      "--retry-all-errors",
      "-o",
      archive,
      `https://codeload.github.com/${RULES_REPO}/tar.gz/${commit}`,
    ],
    { stdio: ["ignore", "ignore", "inherit"] },
  );
}

function listMembers(archive: string): string[] {
  return execFileSync("tar", ["-tzf", archive], { encoding: "utf8" })
    .split("\n")
    .filter((line) => line !== "");
}

// 選んだメンバーだけを名指しで取り出す。`--files-from` は GNU tar と bsdtar の双方が持つので、
// ランナー（GNU）と macOS（bsd）で書き分けずに済む。
function extract(archive: string, into: string, members: readonly string[], work: string): void {
  const list = path.join(work, "members.txt");
  fs.writeFileSync(list, `${members.join("\n")}\n`);
  execFileSync("tar", ["-xzf", archive, "-C", into, "--strip-components=1", "-T", list], {
    stdio: ["ignore", "ignore", "inherit"],
  });
}

function digestOf(dir: string): string {
  return ruleSetDigest(
    walk(dir).map((absolute) => ({
      path: path.relative(dir, absolute).split(path.sep).join("/"),
      content: fs.readFileSync(absolute, "utf8"),
    })),
  );
}

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(absolute) : [absolute];
  });
}

try {
  main();
} catch (e) {
  console.error(`❌ ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
}
