#!/usr/bin/env node

// 先送りにした検査を、この PR で回しておくべきかを知らせる入口。
//
//   nudge <base ref> <line> <body file>   何を言うかを決め、コメント本文をファイルへ書く
//
// **これはゲートではない。** 判定の中身は recommend.ts（構造）と volume.ts（量）が持つ。
import { spawnSync } from "node:child_process";
import { appendFileSync, writeFileSync } from "node:fs";

import { numstatArgs, parseNumstat } from "../lib/numstat.js";
import { parseLabels } from "./labels.js";
import { decideNudge, renderNudge } from "./nudge.js";

const USAGE = "usage: deferred-checks nudge <base ref> <line> <body file>";

function main(): void {
  const [command, baseRef, line, bodyFile] = process.argv.slice(2);

  if (command !== "nudge" || !baseRef || !line || !bodyFile) fail(USAGE);

  const alertAt = Number.parseInt(line, 10);
  if (!Number.isFinite(alertAt) || alertAt <= 0) fail(`知らせる線が読めません: ${line}`);

  nudge(baseRef, alertAt, bodyFile);
}

/**
 * 差分を読み、コメントを組んで GitHub Actions の出力へ書く。
 *
 * @remarks
 * `...` ではなく 2 コミットを比較します。merge base は共有した履歴を要し、浅い checkout は
 * それを持ちません。差は「分岐後に base 側で入った変更も数える」ことで、知らせる側へ倒れます。
 */
function nudge(baseRef: string, alertAt: number, bodyFile: string): void {
  const numstat = spawnSync("git", numstatArgs([baseRef, "HEAD"]), { encoding: "utf8" });

  if (numstat.status !== 0) {
    throw new Error(`${baseRef} との差分を取れませんでした。base を fetch していますか。`);
  }

  const comment = renderNudge(
    decideNudge(parseNumstat(numstat.stdout), parseLabels(process.env["PR_LABELS"]), alertAt),
  );
  const output = process.env["GITHUB_OUTPUT"];

  if (output === undefined) {
    throw new Error("GITHUB_OUTPUT がありません。この副命令は CI から呼ばれます。");
  }

  if (comment !== undefined) writeFileSync(bodyFile, comment.body);

  appendFileSync(
    output,
    [`comment=${comment !== undefined}`, `title=${comment?.title ?? ""}`, ""].join("\n"),
  );

  console.error(comment === undefined ? "🔎 言うことなし" : `🔎 ${comment.title}`);
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

main();
