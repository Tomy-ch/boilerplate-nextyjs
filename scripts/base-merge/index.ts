#!/usr/bin/env node

// ベースブランチをいまのブランチへ取り込む入口。
//
//   base-merge [--base=<ref>] [--dry-run]
//
// ベースは PR の `baseRefName` が最も強く、無いときだけ origin の実状態から最新の
// リリースラインを解く([base-branch](../base-branch/README.md) と同じ判定を共有する)。
// `refs/remotes/origin/HEAD` と `gh repo view --json defaultBranchRef` は読まない —— どちらも
// 前のリリースラインを黙って答える。
//
// **rebase はしない。**[0150](../../docs/adr/0150-git-workflow.md) の規約であることに加えて、
// 追記専用のファイルでは同じ内容が別のハッシュで再着地し、2 つの独立した追加として読める。
//
// 衝突が残ったときは終了コード 1 で、未解決のパスを stdout へ並べる。作業ツリーは MERGING の
// まま残す —— 解決は `resolve-merge` の仕事で、この道具は取り込みと報告までを持つ。
import { execFileSync } from "node:child_process";

import { selectLatestReleaseLine } from "../base-branch/resolve.js";
import { errorMessage } from "../lib/error-message.js";
import {
  baseOverride,
  conflictedPaths,
  invalidArguments,
  isDryRun,
  refuseDirtyTree,
  refuseProtectedBranch,
} from "./resolve.js";

/** 実状態を問い合わせるリモート。 */
const REMOTE = "origin";

/** リリースラインだけを引く参照の glob。 */
const RELEASE_REFS = "refs/heads/release/*";

/** git 1 回あたりの上限。ネットワーク越しなので余裕を持たせる。 */
const TIMEOUT_MS = 60_000;

function main(argv: readonly string[]): void {
  const usage = invalidArguments(argv);

  if (usage !== null) {
    fail(usage);
  }

  const guard =
    refuseProtectedBranch(git(["rev-parse", "--abbrev-ref", "HEAD"])) ??
    refuseDirtyTree(git(["status", "--porcelain"]));

  if (guard !== null) {
    fail(guard);
  }

  const base = baseOverride(argv) ?? resolveBase();

  console.error(`ベース: ${base}`);

  if (isDryRun(argv)) {
    console.error("--dry-run のため取り込みは行いません");

    return;
  }

  git(["fetch", REMOTE, base]);
  reportMerge(base, mergeInto(`${REMOTE}/${base}`));
}

/**
 * PR のベース。PR が無ければ origin の最新のリリースライン。
 *
 * @remarks
 * PR がある枝でそのベース以外を取り込むと、追いつかせるつもりが行き先の付け替えになります。
 */
function resolveBase(): string {
  const fromPullRequest = tryCommand("gh", [
    "pr",
    "view",
    "--json",
    "baseRefName",
    "-q",
    ".baseRefName",
  ]);

  if (fromPullRequest !== null && fromPullRequest.trim() !== "") {
    return fromPullRequest.trim();
  }

  return selectLatestReleaseLine(git(["ls-remote", "--heads", REMOTE, RELEASE_REFS]));
}

/** マージを試み、衝突が残ったかを返す。 */
function mergeInto(ref: string): boolean {
  return tryCommand("git", ["merge", "--no-edit", ref]) === null;
}

/** マージの結果を報告する。衝突が残っていれば終了コード 1。 */
function reportMerge(base: string, conflicted: boolean): void {
  if (!conflicted) {
    console.error(`✅ ${base} を取り込みました`);

    return;
  }

  const paths = conflictedPaths(git(["diff", "--name-only", "--diff-filter=U"]));

  console.error(`⚠️ 未解決のパスが ${paths.length} 件あります（作業ツリーは MERGING のままです）`);

  for (const path of paths) {
    console.log(path);
  }

  process.exit(1);
}

/** git を実行して stdout を返す。失敗は例外にする。 */
function git(args: readonly string[]): string {
  return execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
    timeout: TIMEOUT_MS,
  });
}

/**
 * 失敗を例外にせず null で返す実行。
 *
 * @remarks
 * `gh pr view` は PR が無いときに、`git merge` は衝突したときに、どちらも異常ではない理由で
 * 非ゼロで終わります。ここで例外にすると、その 2 つが本当の失敗と区別できません。
 */
function tryCommand(command: string, args: readonly string[]): string | null {
  try {
    return execFileSync(command, args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: TIMEOUT_MS,
    });
  } catch {
    return null;
  }
}

function fail(message: string): never {
  console.error(`❌ ${message}`);
  process.exit(1);
}

/* istanbul ignore next -- CLI entry。起動経路は make base-merge が実地で通す。 */
try {
  main(process.argv.slice(2));
} catch (error) {
  fail(errorMessage(error));
}
