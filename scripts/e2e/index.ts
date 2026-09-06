#!/usr/bin/env node

// 画面単位の検証を挟む道具の入口。
//
//   comment <full.log> <report.json>  PR へ残す案内を組み立てて標準出力へ書く
//   names   <report.json>   基準画像と食い違った画面の名前（カンマ区切り）
//   orphans <report.json>   撮影対象を失った基準画像の相対パス（1 行 1 件）
//   missing <report.json>   基準画像を持たない画面の名前（1 行 1 件）
//   clear-screens           全数撮り直しの前に、画面の基準画像を置き場から消す
//   trigger <base ref>      その差分を PR で回すべきかを GitHub の出力へ書く
//   serve-partner <host> <port>  宣言した別 origin の文書だけを返すサーバを、止められるまで立てる
//
// story 単位の側（`scripts/vrt`）と語彙を揃える。撮り直す範囲は報告した集合と同じ出所から取る
// —— 報告に出ていない差分を撮り直しの対象に入れないため（`vrt/README.md`）。
import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync, readFileSync, rmSync } from "node:fs";

import { SCREEN_AREA, STORE_PATH } from "../../baseline/lib/store.js";
import { SCREEN_BASELINE_TAG } from "../../e2e/lib/screen-baselines.js";
import { baselinelessTargets, orphanedBaselines } from "../lib/baseline-gap.js";
import { formatOutputLines } from "../lib/github-output.js";
import { numstatArgs, parseNumstat } from "../lib/numstat.js";
import { classifyFailure, composeNotes } from "./comment.js";
import { servePartnerOrigin } from "./partner-origin.js";
import { collectFailedScreens, formatScreenNames } from "./report.js";
import { decideTrigger } from "./trigger.js";

const USAGE =
  "usage: e2e <comment <full.log> <report.json>|names|orphans|missing <report.json>|clear-screens|trigger <base ref>|serve-partner <host> <port>>";

function main(): void {
  const [command, file, port] = process.argv.slice(2);

  if (command === "comment") {
    if (!file || !port) fail(USAGE);
    writeComment(file, port);

    return;
  }

  if (command === "clear-screens") {
    clearScreens();

    return;
  }

  if (command === "trigger") {
    if (!file) fail(USAGE);
    trigger(file);

    return;
  }

  if (command === "serve-partner") {
    if (!file || !port) fail(USAGE);
    // 止めるのは起動側（`make` の trap）。ここは待ち受けたことを報せるだけでよい。
    void servePartnerOrigin(file, Number(port)).then(() => {
      console.log(`🤝 別 origin の文書を ${file}:${port} で返します。`);
    });

    return;
  }

  if (!file || !["names", "orphans", "missing"].includes(command)) fail(USAGE);

  try {
    const json = readFileSync(file, "utf8");
    console.log(pick(command, json));
  } catch (e) {
    fail(`レポートを読めません: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/** 読み取りの口を、命令ごとに選ぶ。 */
function pick(command: string, json: string): string {
  if (command === "names") return formatScreenNames(collectFailedScreens(json));
  if (command === "orphans") return orphanedBaselines(json, SCREEN_BASELINE_TAG).join("\n");

  return baselinelessTargets(json, SCREEN_BASELINE_TAG).join("\n");
}

/**
 * 差分を判定し、GitHub Actions の出力へ書く。
 *
 * @remarks
 * `kind` が `force` ならラベルが無くても回し、`skip` なら保護ブランチの実行に任せます。判定
 * そのものは [`trigger.ts`](trigger.ts) が持ちます。
 */
function trigger(baseRef: string): void {
  const numstat = spawnSync("git", numstatArgs([`${baseRef}...HEAD`]), { encoding: "utf8" });

  if (numstat.status !== 0) {
    fail(`${baseRef} との差分を取れませんでした。base を fetch していますか。`);
  }

  const decision = decideTrigger(parseNumstat(numstat.stdout));
  const output = process.env["GITHUB_OUTPUT"];

  if (output === undefined) {
    fail("GITHUB_OUTPUT がありません。この副命令は CI から呼ばれます。");
  }

  appendFileSync(
    output,
    formatOutputLines([
      `kind=${decision.kind}`,
      `detail=${decision.kind === "force" ? decision.reasons.join(" / ") : ""}`,
    ]),
  );

  console.error(`🔎 ${decision.kind}`);
}

// 落ちた画面の名前は、報告が読めなければ空にする。案内そのものは出したいので、ここで落とさない
// —— 手元で開く節が消えるだけで、種別ごとの案内は残る。
function writeComment(logFile: string, reportFile: string): void {
  process.stdout.write(
    composeNotes({
      kinds: classifyFailure(readFileSync(logFile, "utf8")),
      screenNames: readScreenNames(reportFile),
      headRef: process.env["HEAD_REF"] ?? "",
      runId: process.env["RUN_ID"] ?? "",
    }),
  );
}

function readScreenNames(reportFile: string): string {
  try {
    return formatScreenNames(collectFailedScreens(readFileSync(reportFile, "utf8")));
  } catch {
    return "";
  }
}

// 撮り直しは stale なファイルを消さない（`baseline/lib/store.ts`）。画面を改名・削除すると旧名の
// 画像が残り、対応の検査が孤児として落とす。全数のときだけ先に区画ごと消す。
function clearScreens(): void {
  if (!existsSync(`${STORE_PATH}/.git`)) {
    fail(
      `${STORE_PATH} が取り込まれていません。git submodule update --init ${STORE_PATH} を実行してください。`,
    );
  }

  rmSync(`${STORE_PATH}/${SCREEN_AREA}`, { force: true, recursive: true });
  console.log("🧹 画面の区画を消しました。撮り直しが書き直します。");
}

function fail(message: string): never {
  console.error(`❌ ${message}`);
  process.exit(1);
}

main();
