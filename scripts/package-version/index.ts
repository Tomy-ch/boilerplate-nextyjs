#!/usr/bin/env node

// `package.json` の version をリリースブランチ名へ合わせる入口。
//
//   package-version stamp    ブランチ名の版を書き込む
//   package-version commit   書き込み、変わったときだけコミットする（リリース手順が使う）
//   package-version check    ブランチ名の版と一致するかを見る（書き込まない）
//
// ブランチ名は環境変数で受け取る（`PACKAGE_VERSION_REF` → `GITHUB_REF_NAME` → 現在のブランチ）。
// **引数では受け取らない** —— 引数にすると make の変数展開を経由するため（理由は
// [.makefiles/README.md](../../.makefiles/README.md) の「版の焼き込み関連」）。
// 何を書くか・何を落とすかは [version.ts](version.ts) が持つ。
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  isStampMode,
  planStamp,
  reportPlan,
  selectRef,
  stampCommitMessage,
  stampEffects,
} from "./version.js";

const MANIFEST = "package.json";

function main(argv: readonly string[]): void {
  const [mode] = argv;

  if (mode === undefined || !isStampMode(mode)) {
    fail("使い方: package-version <stamp|commit|check>");
  }

  const ref =
    selectRef([process.env.PACKAGE_VERSION_REF, process.env.GITHUB_REF_NAME]) ?? currentBranch();
  const manifest = path.join(process.cwd(), MANIFEST);
  const plan = planStamp(ref, () => readFileSync(manifest, "utf8"));

  const effects = stampEffects(mode);

  if (plan.kind === "write" && effects.write) {
    writeFileSync(manifest, plan.content);

    if (effects.commit) {
      record(plan.to);
    }
  }

  const report = reportPlan(plan, mode);

  if (report.failed) {
    console.error(report.message);
    process.exit(1);
  }

  console.log(report.message);
}

/** 焼き込んだ 1 行をコミットへ落とす。書き換えが起きたときだけ呼ばれる。 */
function record(version: string): void {
  git(["add", MANIFEST]);
  // フックは通さない。載るのはブランチ名から機械的に導いた 1 行で、pre-commit が回す検査は
  // 派生元の production が既に通している。同じ規則で導き直す突合は CI が持つ。
  git(["commit", "--no-verify", "-m", stampCommitMessage(version)]);
}

/** ref の指定がどこにも無いときに読む、手元の現在ブランチ。 */
function currentBranch(): string {
  return execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { encoding: "utf8" }).trim();
}

function git(args: readonly string[]): void {
  execFileSync("git", [...args], { stdio: "inherit" });
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
