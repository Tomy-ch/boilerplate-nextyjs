import { spawnSync } from "node:child_process";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

import { chromium } from "@playwright/test";
import { TEST_SESSION_ISSUED_STATUS, TEST_SESSION_PATH } from "../../e2e/lib/dev-session";
import {
  listScreenRoutes,
  resolveScreens,
  SCREEN_MANIFEST_FILE,
  SCREENS,
  selectScreens,
} from "../../e2e/lib/screens";
import { CONSENT_CHOICE, CONSENT_COOKIE_NAME, toConsentCookieValue } from "../../src/model/consent";
import { errorMessage } from "../lib/error-message";
import { decideGate } from "../lib/input-hash";
import { numstatArgs, parseNumstat } from "../lib/numstat";
import { type BrowserCookie, putCookies, startBrowser } from "./browser";
import {
  type Budget,
  hasFailure,
  judge,
  type Measurement,
  type MetricValues,
  missingScreens,
  parseBudget,
} from "./budget";
import { buildChromeFlags, buildLighthouseArgs } from "./command";
import { collectMeasureInputs, measureInputsHash } from "./measure-inputs";
import { aggregate, readMetrics } from "./metrics";
import { planScreens, planTargets, type Target } from "./plan";
import { renderFloor, renderReport } from "./report";
import { parseCookiePairs } from "./session";
import { expectedTotal, isShardFile, parseShard, shardFileName } from "./shard";
import { decideTrigger } from "./trigger";

/**
 * 画面ごとの Core Web Vitals を測り、予算と照らす。
 *
 * 使い方:
 *
 *   `tsx scripts/lighthouse`                     画面を測り、予算と照らす（`make lighthouse`）
 *   `tsx scripts/lighthouse merge`               分割した台の結果を束ね、予算と照らす
 *   `tsx scripts/lighthouse trigger <base ref>`  その差分を PR で測るべきかを GitHub の出力へ書く
 *   `tsx scripts/lighthouse inputs`               数値を決める入力のハッシュ
 *   `tsx scripts/lighthouse gate <記録した値のファイル...>`  測定を省いてよいか（skip / run）
 *
 * 分割して測るときは `LIGHTHOUSE_SHARD=<i>/<n>` を渡す。台は結果を置き場へ書くだけで判定せず、
 * `merge` が全台ぶんを読んでから予算と照らす。**判定を台へ配れない**のは、予算の緩和が宣言
 * されている画面が居るかどうかを、全画面を見た側でしか答えられないためである。
 *
 *
 * アプリもブラウザもホストで動く。撮影（`vrt` / `e2e`）と違ってコンテナを使わない理由は
 * `.makefiles/testing/lighthouse.mk` にある。
 */

const BUDGET_FILE = "performance-budget.yaml";

/** LHR の置き場。落ちた画面を後から開くために残す。追跡はしない。 */
const OUTPUT_DIR = "tmp/lighthouse";

/**
 * Lighthouse の CLI。
 *
 * @remarks
 * **Node の API ではなく子プロセスとして呼びます。** Lighthouse は計測用の関数を文字列へ落として
 * ページの中で評価しますが、この scripts は tsx（esbuild）を通って読み込まれ、esbuild は関数名を
 * 保つための補助関数を本文へ差し込みます。差し込まれた呼び出しはページの中に存在せず、最初の
 * 計測で `__name is not defined` として落ちます。子プロセスなら素の node が読むので変換が挟まり
 * ません。
 */
const LIGHTHOUSE_CLI = createRequire(import.meta.url).resolve("lighthouse/cli/index.js");

/**
 * 同意を選び終えたことをブラウザへ伝える cookie。
 *
 * @remarks
 * **選び終えた状態から測ります。** この面は選ぶまで画面を覆うので、置かずに測ると、どの画面の
 * 数値も面が乗った状態のものになります。拒否の側で選ぶのは、同意すると計測 id が配られ、
 * 測っている画面と関係のない `Set-Cookie` が応答に載るためです。
 *
 * **要求ヘッダでは届きません。** 面を出すかどうかを決めるのはブラウザ側で `document.cookie` を
 * 読む層であり、Lighthouse に足させられるのは要求ヘッダだけだからです。だからブラウザを自分で
 * 立ち上げ、CDP で本物の cookie を置きます（[`browser.ts`](browser.ts)）。
 *
 * `e2e/lib/test.ts` が同じ前提を置いています。**両方に要ります** —— あちらは Playwright の
 * context へ置くもので、経路が別です。
 */
function consentCookie(host: string): BrowserCookie {
  return {
    domain: host,
    name: CONSENT_COOKIE_NAME,
    path: "/",
    value: toConsentCookieValue(CONSENT_CHOICE.denied),
  };
}

/**
 * 役割を持つ画面のための session cookie を発行する。
 *
 * @returns ブラウザへ置く cookie。同意ぶんは呼び出し側が足す。
 */
async function issueSessionCookies(
  baseUrl: string,
  role: string,
  host: string,
): Promise<BrowserCookie[]> {
  const response = await fetch(new URL(TEST_SESSION_PATH, baseUrl), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ role }),
  });

  if (response.status !== TEST_SESSION_ISSUED_STATUS) {
    throw new Error(
      `${TEST_SESSION_PATH} が session を発行しませんでした（${response.status}）。` +
        "この口が開くのは APP_ENV が local / ci のときだけです。",
    );
  }

  const cookies = response.headers.getSetCookie();

  if (cookies.length === 0) {
    throw new Error(`${TEST_SESSION_PATH} が cookie を返しませんでした`);
  }

  return parseCookiePairs(cookies).map(([name, value]) => ({
    domain: host,
    name,
    path: "/",
    value,
  }));
}

/**
 * 画面を 1 回測り、LHR を置き場へ書き出して指標を返す。落ちたら 1 度だけ引き直す。
 *
 * @param cookies - 開く前にブラウザへ置く cookie。
 */
async function runOnce(
  target: Target,
  run: number,
  cookies: readonly BrowserCookie[],
): Promise<MetricValues> {
  try {
    return await runOnceStrict(target, run, cookies);
  } catch (cause) {
    console.error(`↻ ${target.name} の ${run} 回目を引き直します（${errorMessage(cause)}）`);

    return await runOnceStrict(target, run, cookies);
  }
}

/**
 * 引き直さずに 1 回だけ測る。
 *
 * @remarks
 * **ブラウザはこちらで立ち上げ、Lighthouse には繋ぎ先だけを渡します。** CLI へ渡せるのは要求
 * ヘッダの追加までで、cookie 置き場へは触れないためです（[`browser.ts`](browser.ts)）。銘柄も版も
 * ここでは選びません —— 版は lockfile の `@playwright/test` が決め、実体を入れるのは
 * `make lighthouse` の手前の段です。
 *
 * ブラウザ側がトレースの起点を取りこぼすこと（`NO_NAVSTART`）が一定の確率であり、これは
 * 測っている木とは無関係に起きます。**1 度だけ引き直すのは、続けて 2 度落ちるなら木の側の
 * 問題だから**です。無制限に引き直すと、常に落ちる変更が待ち時間だけ伸ばして緑になりません。
 */
async function runOnceStrict(
  target: Target,
  run: number,
  cookies: readonly BrowserCookie[],
): Promise<MetricValues> {
  const output = join(OUTPUT_DIR, `${target.name}-${run}.json`);
  const browser = await startBrowser(
    chromium.executablePath(),
    buildChromeFlags({ CI: process.env["CI"] }),
  );

  let result: ReturnType<typeof spawnSync>;

  try {
    await putCookies(browser.wsUrl, cookies);
    result = spawnSync(
      process.execPath,
      buildLighthouseArgs(LIGHTHOUSE_CLI, target, output, browser.port),
      { stdio: "inherit" },
    );
  } finally {
    browser.close();
  }

  // 起動そのものに失敗した場合、`status` は null で理由は `error` にしか入りません。終了コード
  // だけを見ると「終了コード null」だけが残り、ブラウザを起動できなかったのか計測が落ちたのかを
  // 見分けられません。
  if (result.error !== undefined) {
    throw new Error(`${target.url} の計測を起動できませんでした`, { cause: result.error });
  }

  if (result.status !== 0) {
    throw new Error(`${target.url} の計測が失敗しました（終了コード ${String(result.status)}）`);
  }

  return readMetrics(JSON.parse(readFileSync(output, "utf8")));
}

/**
 * 画面 1 つを繰り返し測り、中央値を返す。
 *
 * @remarks
 * **並べません。** 測っているのは CPU 律速の値なので、同じ機械で並べた時点で互いの CPU を
 * 奪い合い、予算と照らす意味が消えます。
 */
async function measure(
  target: Target,
  runs: number,
  cookies: readonly BrowserCookie[],
): Promise<Measurement> {
  const values: MetricValues[] = [];

  for (let run = 1; run <= runs; run += 1) {
    values.push(await runOnce(target, run, cookies));
  }

  return { name: target.name, values: aggregate(values) };
}

/**
 * 差分を判定し、GitHub Actions の出力へ書く。
 *
 * @remarks
 * `kind` が `force` なら計測へ進み、`skip` なら保護ブランチの計測に任せます。判定そのものは
 * [`trigger.ts`](trigger.ts) が持ちます。
 */
function trigger(baseRef: string): void {
  const numstat = spawnSync("git", numstatArgs([`${baseRef}...HEAD`]), {
    encoding: "utf8",
  });

  if (numstat.status !== 0) {
    throw new Error(`${baseRef} との差分を取れませんでした。base を fetch していますか。`);
  }

  const decision = decideTrigger(parseNumstat(numstat.stdout));
  const output = process.env["GITHUB_OUTPUT"];

  if (output === undefined) {
    throw new Error("GITHUB_OUTPUT がありません。この副命令は CI から呼ばれます。");
  }

  appendFileSync(
    output,
    [
      `kind=${decision.kind}`,
      `detail=${decision.kind === "force" ? decision.reasons.join(" / ") : ""}`,
      "",
    ].join("\n"),
  );

  console.error(`🔎 ${decision.kind}`);
}

/**
 * 測り終えた結果を、予算と照らして報告する。
 *
 * @remarks
 * **全画面を測った側でしか呼べません。** 在るべき画面が居るかどうかの検査は、測った集合が
 * 全体であることを前提にしています。分割した 1 台がこれを呼ぶと、他の台が持つ画面がすべて
 * 「宣言されているのに居ない」として上がります。
 */
function judgeAll(measurements: readonly Measurement[], budget: Budget): void {
  // 絞った実行では見ない。在るべき画面の集合が絞った側に縮み、対象外の緩和がすべて
  // 「居ない画面への宣言」として上がる（`selectScreens` が撮影側について言うのと同じ）。
  const missing = process.env["E2E_ONLY"] ? [] : missingScreens(measurements, budget);

  if (missing.length > 0) {
    console.error(
      `❌ ${BUDGET_FILE} が緩和を持つ画面が居ません: ${missing.join(", ")}\n` +
        "画面の名前を変えたなら宣言も直してください。",
    );
    process.exitCode = 1;

    return;
  }

  const verdicts = judge(measurements, budget);

  console.log(
    renderReport(verdicts, budget.runs.count, renderFloor(measurements, budget.floor.screen)),
  );

  if (hasFailure(verdicts)) {
    console.error("\n❌ Core Web Vitals が予算を超えました。");
    process.exitCode = 1;

    return;
  }

  console.log("\n✅ 全ての画面が予算に収まっています。");
}

/**
 * 分割した台の結果を束ね、予算と照らす。
 *
 * @remarks
 * 台数は結果の綴りから読み、束ねる側では宣言しません（[`shard.ts`](shard.ts)）。足りないまま
 * 束ねると、測らなかった画面が「緩和が宣言されているのに居ない画面」として現れ、原因を
 * 取り違えます。
 */
function merge(): void {
  const budget = parseBudget(readFileSync(BUDGET_FILE, "utf8"));
  const names = readdirSync(OUTPUT_DIR);

  expectedTotal(names);

  const measurements = names
    .filter(isShardFile)
    .flatMap((name) => JSON.parse(readFileSync(join(OUTPUT_DIR, name), "utf8")) as Measurement[]);

  judgeAll(measurements, budget);
}

async function measureAll(): Promise<void> {
  const baseUrl = process.env["E2E_BASE_URL"];

  if (baseUrl === undefined) {
    throw new Error("E2E_BASE_URL がありません。make lighthouse から呼んでください。");
  }

  const budget = parseBudget(readFileSync(BUDGET_FILE, "utf8"));

  // 絞りは撮影側と同じ入口を使う（`E2E_ONLY`）。1 枚を見たいだけの実行が全画面を回すと、
  // 手元では 16 分を払うことになり、実際には誰も回さなくなる。
  const selected = selectScreens(
    resolveScreens(listScreenRoutes(readFileSync(SCREEN_MANIFEST_FILE, "utf8")), SCREENS),
    process.env["E2E_ONLY"],
  );

  // 分割の指定が無ければ 1 台。手元の `make lighthouse` だけがこちらを通る。
  //
  // **空文字列も「指定なし」として受けます。** make は既定値を空で `export` するので、手元の
  // 実行では未定義ではなく空が届きます。`undefined` だけを見ると、割らない経路が誰も通れません。
  const spec = process.env["LIGHTHOUSE_SHARD"] || undefined;
  const shard = spec === undefined ? { index: 1, total: 1 } : parseShard(spec);
  const { screens, control } = planScreens(selected, shard, budget.floor.screen);

  mkdirSync(OUTPUT_DIR, { recursive: true });

  const host = new URL(baseUrl).hostname;
  const consent = consentCookie(host);
  const sessions = new Map<string, BrowserCookie[]>();
  const measurements: Measurement[] = [];

  for (const target of planTargets(screens, baseUrl)) {
    if (target.role !== undefined && !sessions.has(target.role)) {
      sessions.set(target.role, await issueSessionCookies(baseUrl, target.role, host));
    }

    console.error(`⏱️  ${target.name}`);

    const measurement = await measure(target, budget.runs.count, [
      consent,
      ...(target.role === undefined ? [] : (sessions.get(target.role) ?? [])),
    ]);

    measurements.push({
      ...measurement,
      ...(spec === undefined ? {} : { shard: shard.index }),
      ...(target.name === control?.name ? { control: true } : {}),
    });
  }

  // 呼ばれ方で決める。台数では決めない —— 1 台に割った実行も束ねる側を持っており、そちらが
  // 判定するのに、ここで台数を見て書き出しを飛ばすと束ねる側は何も見つけられない。
  //
  // 判定するのは束ねる側 1 箇所。台は全画面を見ているとは限らず、在るべき画面の検査に
  // 答えられない。
  if (spec !== undefined) {
    writeFileSync(join(OUTPUT_DIR, shardFileName(shard)), JSON.stringify(measurements));
    console.error(
      `📦 ${measurements.length} 画面ぶんを書き出しました（${shard.index}/${shard.total}）`,
    );

    return;
  }

  judgeAll(measurements, budget);
}

/** 記録した値。まだ無ければ `null` —— 判定できないことは「変わっていない」ではない。 */
function recordedInputsOf(file: string): string | null {
  return existsSync(file) ? readFileSync(file, "utf8") : null;
}

/** いまの木が持つ、数値を決める入力のハッシュ。 */
function currentInputsHash(): string {
  return measureInputsHash(process.cwd(), collectMeasureInputs(process.cwd()));
}

// `async` にするのは、副命令が同期に throw するため。素の関数だと `main()` が Promise を
// 返す前に例外が抜け、末尾の `catch` が付く前に Node が生のスタックを出す。読む側に届くのは
// 「何が足りないか」の 1 行であるべきで、tsx の変換経路を含んだ呼び出し履歴ではない。
async function main(): Promise<void> {
  const [command, baseRef] = process.argv.slice(2);

  if (command === "merge") {
    merge();

    return;
  }

  if (command === "trigger") {
    if (baseRef === undefined) {
      throw new Error("usage: lighthouse trigger <base ref>");
    }

    trigger(baseRef);

    return;
  }

  if (command === "inputs") {
    console.log(currentInputsHash());

    return;
  }

  if (command === "gate") {
    const files = process.argv.slice(3);

    if (files.length === 0) {
      throw new Error("usage: lighthouse gate <記録した値のファイル...>");
    }

    console.log(decideGate(files.map(recordedInputsOf), currentInputsHash()));

    return;
  }

  await measureAll();
}

// トップレベル await にしない。tsx は CJS へ落とすので変換の時点で落ちる。
main().catch((error: unknown) => {
  console.error(`❌ ${errorMessage(error)}`);
  process.exitCode = 1;
});
