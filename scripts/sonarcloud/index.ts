#!/usr/bin/env node

// SonarCloud の走査の前後を繋ぐ入口。
//
//   task      scanner が残した report-task.txt を読み、後段が使う値を GitHub の出力へ書く
//   wait      解析が終わるのを待ち、その解析の id を出力へ書く
//   gate      品質ゲートを取り、判定を出力へ、落ちた条件を Markdown へ書く
//   issues    未解決の所見を取り、応答をそのまま置く
//   sarif     所見を SARIF へ直す
//   summary   ゲートと所見から PR へ貼る本文を組み、件数を出力へ書く
//
// 判定は隣のモジュールが持ち、ここは読み書き・待ち・終了コードだけを担う。走査そのものは
// vendor の action が行い、この入口は呼ばれない。
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";

import { errorMessage } from "../lib/error-message.js";
import { formatOutputLines } from "../lib/github-output.js";
import { nextPollOutcome, type PollOutcome, readCeTask } from "./analysis.js";
import { ceTaskUrl, issuesSearchUrl, qualityGateUrl } from "./endpoints.js";
import { readGateStatus, renderFailingConditions } from "./quality-gate.js";
import { toSarif } from "./sarif.js";
import { countResults, renderSummary } from "./summary.js";
import { parseTaskReport } from "./task-report.js";

const USAGE = "usage: sonarcloud <task|wait|gate|issues|sarif|summary>";

/** scanner が queue へ積んだ解析の在り処。 */
const TASK_FILE = ".scannerwork/report-task.txt";

/** 走査の成果物。artifact として報告の job へ渡るため、綴りは workflow と揃える。 */
const GATE_JSON = "sonar-quality-gate.json";
const GATE_MARKDOWN = "sonar-quality-gate.md";
const ISSUES_JSON = "sonar-issues.json";
const SARIF_FILE = "sonarcloud.sarif";
const SUMMARY_FILE = "sonarcloud-summary.md";

// 待つのは問い合わせの**あいだ**なので、間隔の数は回数より 1 つ少ない。上限を割り切れる形に
// するため、回数は間隔の数 + 1 を置く。
const POLL_ATTEMPTS = 61;
const POLL_INTERVAL_MS = 10_000;
const MS_PER_MINUTE = 60_000;

/** 待ちの上限（分）。文言に書く数字を宣言から導き、片方だけが古びないようにする。 */
const POLL_LIMIT_MINUTES = ((POLL_ATTEMPTS - 1) * POLL_INTERVAL_MS) / MS_PER_MINUTE;

const NETWORK_TIMEOUT_MS = 30_000;

async function main(): Promise<void> {
  const command = process.argv[2];

  switch (command) {
    case "task":
      readTaskReport();

      return;
    case "wait":
      await waitForAnalysis();

      return;
    case "gate":
      await readQualityGate();

      return;
    case "issues":
      await fetchIssues();

      return;
    case "sarif":
      convertIssues();

      return;
    case "summary":
      summarize();

      return;
    default:
      console.error(USAGE);
      process.exit(1);
  }
}

/** 積んだ解析の在り処を、後段の step が読める形へ写す。 */
function readTaskReport(): void {
  if (!existsSync(TASK_FILE)) {
    fail(`${TASK_FILE} was not produced, so the analysis cannot be read back`);
  }

  const entries = parseTaskReport(readFileSync(TASK_FILE, "utf8"));

  writeOutput(entries.map(({ key, value }) => `${key}=${value}`));
}

/** 解析が終わるまで待ち、終わり方に応じて進むか落とす。 */
async function waitForAnalysis(): Promise<void> {
  const url = ceTaskUrl(required("SERVER_URL"), required("CE_TASK_ID"));
  const outcome = await poll(url, required("SONAR_TOKEN"), POLL_ATTEMPTS);

  if (outcome.kind === "failed") {
    fail(`the SonarCloud analysis finished as ${outcome.status}`);
  }

  if (outcome.kind === "pending") {
    fail(`the SonarCloud analysis did not complete within ${POLL_LIMIT_MINUTES} minutes`);
  }

  writeOutput([`analysisId=${outcome.analysisId}`]);
}

/**
 * 決着が付くまで問い合わせを繰り返す。
 *
 * @param remaining - 残りの問い合わせ回数。尽きたら `pending` のまま返す
 */
async function poll(url: string, token: string, remaining: number): Promise<PollOutcome> {
  const outcome = nextPollOutcome(readCeTask(await getJson(url, token)));

  if (outcome.kind !== "pending" || remaining <= 1) {
    return outcome;
  }

  await delay(POLL_INTERVAL_MS);

  return poll(url, token, remaining - 1);
}

/**
 * ゲートの判定と、落ちた条件を書き出す。
 *
 * @remarks
 * 応答は受け取ったまま置きます。artifact として報告の job へ渡るので、こちらで整えると
 * 後から原因を辿る側が SonarCloud の答えそのものを読めなくなります。
 */
async function readQualityGate(): Promise<void> {
  const analysisId = process.env["ANALYSIS_ID"];

  if (analysisId === undefined || analysisId === "") {
    fail("the completed task carried no analysisId, so the quality gate cannot be read");
  }

  const url = qualityGateUrl(required("SERVER_URL"), analysisId);
  const body = await getText(url, required("SONAR_TOKEN"));
  const payload: unknown = JSON.parse(body);

  writeFileSync(GATE_JSON, body);
  writeFileSync(GATE_MARKDOWN, renderFailingConditions(payload));
  writeOutput([`status=${readGateStatus(payload)}`]);
}

/** 未解決の所見を取る。PR の解析なら PR へ絞る。 */
async function fetchIssues(): Promise<void> {
  const url = issuesSearchUrl(
    required("SERVER_URL"),
    required("PROJECT_KEY"),
    process.env["PR_NUMBER"],
  );

  writeFileSync(ISSUES_JSON, await getText(url, required("SONAR_TOKEN")));
}

/** 所見を code scanning が取り込める形へ直す。 */
function convertIssues(): void {
  const payload: unknown = JSON.parse(readFileSync(ISSUES_JSON, "utf8"));

  writeFileSync(SARIF_FILE, `${JSON.stringify(toSarif(payload, required("SERVER_URL")))}\n`);
}

/** PR へ貼る本文を組み、件数を後段へ渡す。 */
function summarize(): void {
  const sarif: unknown = JSON.parse(readFileSync(SARIF_FILE, "utf8"));
  const conditions = existsSync(GATE_MARKDOWN) ? readFileSync(GATE_MARKDOWN, "utf8") : "";

  writeFileSync(SUMMARY_FILE, renderSummary(sarif, process.env["GATE_STATUS"] ?? "", conditions));
  writeOutput([`count=${countResults(sarif)}`]);
}

/** JSON として読んだ応答。 */
async function getJson(url: string, token: string): Promise<unknown> {
  return JSON.parse(await getText(url, token));
}

/**
 * 応答の本文。2xx でなければ、状態と本文を挙げて落とす。
 *
 * @remarks
 * token はヘッダにだけ載せます。問い合わせの綴りは失敗のときに出るので、値を URL へ載せると
 * job のログに残ります。
 *
 * **注記ではなく例外で落とします。** 本文は外から届いたもので、注記として流すと改行の先に
 * 偽の 1 行を足せます（{@link errorMessage} が均す）。
 */
async function getText(url: string, token: string): Promise<string> {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(NETWORK_TIMEOUT_MS),
  });
  const body = await response.text();

  if (!response.ok) {
    throw new Error(`SonarCloud が ${response.status} を返しました: ${url} ${body}`);
  }

  return body;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/** この副命令が要る環境変数。無ければ、呼ばれ方そのものが違う。 */
function required(name: string): string {
  const value = process.env[name];

  if (value === undefined || value === "") {
    throw new Error(`${name} がありません。この副命令は CI から呼ばれます。`);
  }

  return value;
}

/** GitHub Actions の出力へ書く。 */
function writeOutput(lines: readonly string[]): void {
  const file = process.env["GITHUB_OUTPUT"];

  if (file === undefined) {
    throw new Error("GITHUB_OUTPUT がありません。この副命令は CI から呼ばれます。");
  }

  appendFileSync(file, formatOutputLines(lines));
}

/**
 * 注記として出したうえで落とす。
 *
 * @remarks
 * `::error::` で出すのは、ここから渡す文言が**走査の結果ではなく走査が成立しなかったこと**を
 * 指すためです。job のログを開かなくても、実行の一覧に理由が出ます。渡すのはこの入口自身が
 * 綴った定型の文言だけです（外から届いた本文を注記へ混ぜない理由は {@link getText}）。
 */
function fail(message: string): never {
  console.log(`::error::${message}`);
  process.exit(1);
}

main().catch((error: unknown) => {
  console.error(`❌ ${errorMessage(error)}`);
  process.exitCode = 1;
});
