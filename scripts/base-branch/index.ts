#!/usr/bin/env node

// フィーチャーブランチの分岐元を解決する入口。
//
//   base-branch    origin の最新のリリースライン(`release/vX.Y.Z`)のブランチ名を 1 行で出す
//
// 読むのは origin の実状態(`git ls-remote`)だけで、ローカルの参照は読まない(理由は
// [README](README.md))。何を最新と数えるかは [resolve.ts](resolve.ts) が持つ。
//
// stdout に出すのはブランチ名 1 行だけで、案内はすべて stderr へ出す。`$(make -s base-branch)`
// でそのまま受けられるようにするため。
import { execFileSync } from "node:child_process";

import { errorMessage } from "../lib/error-message.js";
import { selectLatestReleaseLine, unexpectedArguments } from "./resolve.js";

/** 実状態を問い合わせるリモート。 */
const REMOTE = "origin";

/** リリースラインだけを引く参照の glob。 */
const RELEASE_REFS = "refs/heads/release/*";

/** git 1 回あたりの上限。ネットワーク越しなので余裕を持たせる。 */
const TIMEOUT_MS = 60_000;

function main(argv: readonly string[]): void {
  const usage = unexpectedArguments(argv);

  if (usage !== null) {
    fail(usage);
  }

  console.log(selectLatestReleaseLine(listReleaseRefs()));
}

/**
 * origin のリリースラインの参照一覧。
 *
 * git の失敗理由(認証・名前解決)は stderr へそのまま流す。握り潰すと「リリースラインが無い」と
 * 見分けが付かない。
 */
function listReleaseRefs(): string {
  return execFileSync("git", ["ls-remote", "--heads", REMOTE, RELEASE_REFS], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
    timeout: TIMEOUT_MS,
  });
}

function fail(message: string): never {
  console.error(`❌ ${message}`);
  process.exit(1);
}

try {
  main(process.argv.slice(2));
} catch (error) {
  fail(errorMessage(error));
}
