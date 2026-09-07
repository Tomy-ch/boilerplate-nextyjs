#!/usr/bin/env node

// mise.toml の pin が供給網の冷却期間を満たすかを検査する入口。何を見て何で落ちるかは
// [README](./README.md) が持つ。
//
//   pnpm exec tsx scripts/tools-cooldown check --release-days N --registry-days N
//       TOOLS_COOLDOWN_BASE の時点から動いた pin だけを見る（PR のゲート）
//   pnpm exec tsx scripts/tools-cooldown audit --release-days N --registry-days N
//       全 pin を見る（週次の棚卸し）
//
// base は引数ではなく環境 TOOLS_COOLDOWN_BASE から受ける。ブランチ名はシェルのメタ文字を含みうる
// ので、呼ぶ側の make が recipe 行へ展開しない（.makefiles/README.md）。
//
// 終了コード: 違反があれば 1、公開日時を引けなかった pin があれば 2（検査が成立していない）。
// 窓の対象外の pin は棚卸しに載るだけで、どちらにも数えない。
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

import { parseOptions } from "../lib/cli-options.js";
import { errorMessage } from "../lib/error-message.js";
import { MISE_FILE, type MisePin, pinId, readPins } from "../lib/mise-pins.js";
import { type FetchJson, publishedAt, type Route, routeOf } from "./published.js";
import { addedPins, type Judgement, judgePin, type Lookup, parseWindows } from "./rules.js";

const USAGE = "usage: tools-cooldown <check|audit> --release-days N --registry-days N";

/** 検査が成立していない状態。違反（1）と分けるのは、0 件を「違反なし」へ寄せないため。 */
const BROKEN = 2;

const FETCH_TIMEOUT_MS = 30_000;

/** 同時に投げる問い合わせの上限。GitHub API の枠を 1 回の実行で使い切らない。 */
const FETCH_CONCURRENCY = 4;

const MARK: Record<Judgement["verdict"], string> = {
  clear: "✅",
  exempt: "⚠️",
  excluded: "➖",
  violation: "❌",
  unresolved: "❌",
};

/** 判定する pin と、その backend の扱い。 */
type Subject = {
  readonly pin: MisePin;
  readonly route: Route;
};

/** JSON を返す HTTP GET。GitHub API には、あれば token を添える（未認証の枠は 1 回の実行に足りない）。 */
const fetchJson: FetchJson = async (url) => {
  const headers = new Headers({ Accept: "application/json" });
  const token = process.env["GITHUB_TOKEN"];

  if (url.startsWith("https://api.github.com/") && token !== undefined && token !== "") {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(url, { headers, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });

  return { status: response.status, body: response.ok ? await response.json() : null };
};

function printError(message: string): void {
  console.error(`❌ ${message}`);
}

function abort(message: string, code: number): never {
  printError(message);
  process.exit(code);
}

/** base 時点の mise.toml。読めなければ検査は成立しない —— 差分が空のまま通る。 */
function basePins(base: string, root: string): readonly MisePin[] {
  let text: string;
  try {
    text = execFileSync("git", ["show", `${base}:${MISE_FILE}`], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    abort(
      `${base} の ${MISE_FILE} を読めません（base を取得できていない可能性）: ${errorMessage(error)}`,
      BROKEN,
    );
  }

  try {
    return readPins(text);
  } catch (error) {
    abort(`${base} の ${MISE_FILE} を読めません: ${errorMessage(error)}`, BROKEN);
  }
}

/** 窓を当てる経路を持つ pin だけ公開日時を引く。それ以外は引かない（null）。 */
async function lookup({ pin, route }: Subject): Promise<Lookup | null> {
  if (route.kind !== "channel") return null;

  try {
    return { kind: "published", at: await publishedAt(pin, fetchJson) };
  } catch (error) {
    return { kind: "failed", reason: errorMessage(error) };
  }
}

/** 同時数を絞って全件を引く。 */
async function lookupAll(subjects: readonly Subject[]): Promise<(Lookup | null)[]> {
  const results: (Lookup | null)[] = [];

  for (let start = 0; start < subjects.length; start += FETCH_CONCURRENCY) {
    const batch = subjects.slice(start, start + FETCH_CONCURRENCY);

    results.push(...(await Promise.all(batch.map(lookup))));
  }

  return results;
}

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);

  if (command !== "check" && command !== "audit") {
    abort(USAGE, 1);
  }

  let options: ReadonlyMap<string, string>;
  try {
    options = parseOptions(rest);
  } catch (error) {
    abort(`${errorMessage(error)}\n${USAGE}`, 1);
  }

  const windows = parseWindows(options);
  const root = process.cwd();

  let current: readonly MisePin[];
  try {
    current = readPins(readFileSync(path.join(root, MISE_FILE), "utf8"));
  } catch (error) {
    abort(
      `${MISE_FILE} を読めません（リポジトリルートで実行してください）: ${errorMessage(error)}`,
      BROKEN,
    );
  }

  let targets: readonly MisePin[] = current;

  if (command === "check") {
    const base = process.env["TOOLS_COOLDOWN_BASE"];

    if (base === undefined || base === "") {
      abort(
        "TOOLS_COOLDOWN_BASE に比較する git ref を渡してください（無いと差分を取れません）",
        BROKEN,
      );
    }

    targets = addedPins(basePins(base, root), current);

    if (targets.length === 0) {
      console.log(`✅ ${base} から動いた pin はありません`);

      return;
    }

    console.log(`— ${base} から動いた pin ${targets.length} 件を検査します`);
  } else {
    console.log(`— ${MISE_FILE} の pin ${targets.length} 件を棚卸しします`);
  }

  console.log(
    `  窓: GitHub Releases ${windows["github-release"]} 日 / レジストリ ${windows.registry} 日`,
  );

  const subjects = targets.map((pin): Subject => ({ pin, route: routeOf(pin.key) }));
  const lookups = await lookupAll(subjects);
  const now = new Date();

  const judgements = subjects.map(({ pin, route }, index) =>
    judgePin(pin, route, lookups[index] ?? null, windows, now),
  );

  for (const { pin, verdict, message } of judgements) {
    console.log(`  ${MARK[verdict]} ${pinId(pin)}: ${message}`);
  }

  const count = (verdict: Judgement["verdict"]): number =>
    judgements.filter((judgement) => judgement.verdict === verdict).length;
  const violations = count("violation");
  const unresolved = count("unresolved");
  const excluded = count("excluded");

  if (unresolved > 0) {
    abort(`${unresolved} 件の pin の公開日時を引けず、検査が成立していません`, BROKEN);
  }

  if (violations > 0) {
    abort(`${violations} 件の pin が冷却期間を満たしていません`, 1);
  }

  console.log(
    excluded > 0
      ? `✅ 窓の対象の pin が冷却期間を満たしています（言語ランタイム ${excluded} 件は対象外）`
      : "✅ 全 pin が冷却期間を満たしています",
  );
}

main().catch((error: unknown) => {
  abort(`tools-cooldown: ${errorMessage(error)}`, BROKEN);
});
