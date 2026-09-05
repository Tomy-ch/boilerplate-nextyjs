#!/usr/bin/env node

// リリース運用の入口。
//
//   branch <hotfix|release> <patch|minor|major>  次の版のブランチを切り、既定ブランチへ据える
//   tag <patch|minor|major>                      production HEAD へタグを打ち、Release を作る
//
// 何をどの順で走らせるかは [branch.ts](branch.ts) / [tag.ts](tag.ts) が持ち、ここは走らせる
// ことと終了コードだけを担う（取り消せない操作を手順として組む理由は [steps.ts](steps.ts)）。
//
// 途中で 1 つでも失敗したらそこで止まる。押せなかったブランチを既定に据える、本文を取れない
// まま Release を作る、といった半端な状態を残さないため。
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";

import { type BumpType, bumpVersion, isBumpType, normalizeVersion } from "../semver/bump.js";
import { selectLatestVersion } from "../semver/latest.js";
import {
  branchCreationBlocker,
  isReleaseBranchPrefix,
  NO_LATEST_TAG_STEPS,
  planReleaseBranch,
} from "./branch.js";
import { FETCH_TAGS_STEPS, type ReleaseCommand, type ReleaseStep } from "./steps.js";
import { NO_RELEASE_TAG_STEPS, planReleaseTag } from "./tag.js";

function main(argv: readonly string[]): void {
  const [command, ...rest] = argv;

  switch (command) {
    case "branch":
      createBranch(rest[0], rest[1]);
      break;
    case "tag":
      createTag(rest[0]);
      break;
    default:
      fail(
        "使い方: release <branch <hotfix|release> <patch|minor|major> | tag <patch|minor|major>>",
      );
  }
}

function createBranch(prefix: string | undefined, type: string | undefined): void {
  if (prefix === undefined || !isReleaseBranchPrefix(prefix)) {
    fail("ブランチの種別は hotfix | release のいずれかです。");
  }

  const bump = requireBumpType(type);

  perform(FETCH_TAGS_STEPS);

  const latest = selectLatestVersion(listTags());

  if (latest === null) {
    abort(NO_LATEST_TAG_STEPS);
  }

  const plan = planReleaseBranch({ latest, next: nextVersion(latest, bump), prefix });

  perform(plan.notices);

  const blocker = branchCreationBlocker({
    branchName: plan.branchName,
    branchExists: succeeds(plan.existenceProbe),
    workTreeStatus: capture("git", ["status", "--porcelain"]),
  });

  if (blocker !== null) {
    abort(blocker);
  }

  perform(plan.steps);
}

function createTag(type: string | undefined): void {
  const bump = requireBumpType(type);

  // 取り込みだけを先に済ませる。名乗りは production の同期と併せて plan が出すので、ここは黙って走る。
  run("git", ["fetch", "--tags", "origin"]);

  const latest = selectLatestVersion(listTags());

  if (latest === null) {
    abort(NO_RELEASE_TAG_STEPS);
  }

  const plan = planReleaseTag({ latest, next: nextVersion(latest, bump) });

  perform(plan.preparation);

  if (!existsSync(plan.notesPath)) {
    abort(plan.missingNotes);
  }

  perform(plan.steps);
}

function requireBumpType(type: string | undefined): BumpType {
  if (type === undefined || !isBumpType(type)) {
    fail("進め方は patch | minor | major のいずれかです。");
  }

  return type;
}

function nextVersion(latest: string, type: BumpType): string {
  const normalized = normalizeVersion(latest);

  if (normalized === null) {
    fail(`リリースタグとして読めません: ${latest}`);
  }

  return bumpVersion(normalized, type);
}

function listTags(): string[] {
  return capture("git", ["tag"]).split("\n");
}

function perform(steps: readonly ReleaseStep[]): void {
  for (const step of steps) {
    if (step.kind === "log") {
      console.log(step.message);
    } else {
      run(step.command, step.args);
    }
  }
}

/** 止める。出す行を出し切ってからシェルへ 1 を返す。 */
function abort(steps: readonly ReleaseStep[]): never {
  perform(steps);
  process.exit(1);
}

function run(command: string, args: readonly string[]): void {
  execFileSync(command, [...args], { stdio: "inherit" });
}

/** 成否だけを見る問い合わせ。出力は読まない。 */
function succeeds(probe: ReleaseCommand): boolean {
  try {
    execFileSync(probe.command, [...probe.args], { stdio: "ignore" });

    return true;
  } catch {
    return false;
  }
}

function capture(command: string, args: readonly string[]): string {
  return execFileSync(command, [...args], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
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
