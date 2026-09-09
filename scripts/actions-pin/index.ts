#!/usr/bin/env node

// GitHub Actions の `uses:` 参照を不変の commit SHA へ固定するツール。
//
//   resolve : 対象ファイルを走査し tag を SHA へ解決してロックファイルを書き出す（唯一ネットワークに出る）
//   apply   : ロックファイルを SSOT に `uses:` を `@<sha> # <tag>` へ書き換える
//   check   : apply と同じ判定を書き換えなしで行い、ずれがあれば非ゼロ終了する（CI / hook 用）
//
// resolve は不変を宣言した tag の解決先が変わった時点で fail-closed に落ちる。この設計の根拠は
// [README](../README.md) から辿る。
//
// 版の SSOT は `uses:` 行末尾のコメント tag であり、`@` 側の SHA ではない。固定済みの行も
// コメント tag から再解決されるため resolve は冪等。ローカル参照（`uses: ./...`）は対象外。
import { readFileSync } from "node:fs";
import path from "node:path";
import { quarantine } from "../lib/pin-quarantine.js";
import { applyPins } from "./apply-check.js";
import { LOCK_FILE, readLock, readLockOrEmpty, writeLock } from "./lockfile.js";
import { classifyMoves, type MovedRef, refAgeDays, resolveSHA } from "./resolve.js";
import {
  type ActionRef,
  collectRefs,
  targetFiles,
  unparsedUsesLines,
  unsupportedTagLines,
} from "./uses-reference.js";

const USAGE = "usage: actions-pin <resolve|apply|check> [--min-age-days=N]";
const MIN_AGE_PATTERN = /^--min-age-days=(\d+)$/;
const ALLOW_MOVED_ENV = "ACTIONS_PIN_ALLOW_MOVED";
const UNPARSED_MESSAGE =
  "解釈できない記法の uses: があります（1 行 1 ステップのブロック記法へ直してください）";
const UNSUPPORTED_TAG_MESSAGE =
  "版に使えない文字を含む uses: があります（英数と . _ - + / だけで書いてください）";

// resolve の引数。allowMoved は解決先の移動を承認するロックファイルのキー集合。
type ResolveOptions = {
  minAgeDays: number;
  allowMoved: Set<string>;
};

async function runResolve(root: string, files: string[], options: ResolveOptions): Promise<void> {
  const refs = collectRefs(files);
  assertAllUsesParsed(root, files);
  assertAllTagsSupported(root, files);
  assertAllowMovedReferenced(refs, options.allowMoved);
  const existing = readLockOrEmpty(path.join(root, LOCK_FILE));

  const candidates = await allOrAggregate(
    [...refs].map(async ([key, ref]) => ({
      key,
      ref,
      sha: await withKey(key, () => resolveSHA(ref.repo, ref.tag)),
    })),
  );
  candidates.sort((a, b) => a.key.localeCompare(b.key));

  const moves = classifyMoves(
    existing,
    candidates.map(({ key, ref, sha }) => ({ key, tag: ref.tag, sha })),
    options.allowMoved,
  );
  if (moves.repointed.length > 0) failRepointed(moves.repointed);

  const resolved = await allOrAggregate(
    candidates.map(async ({ key, ref, sha }) => {
      const ageOf = () => refAgeDays(ref.repo, ref.tag, sha);
      const result = await withKey(key, () =>
        quarantine(ageOf, key, sha, options.minAgeDays, existing),
      );
      return { key, ...result };
    }),
  );

  const lock = new Map<string, string>();
  for (const entry of resolved) {
    if (entry.use === null) continue;
    lock.set(entry.key, entry.use);
    console.log(`  ${entry.key} -> ${entry.use}`);
  }
  for (const entry of resolved) {
    if (entry.note) console.log(`  ⚠️ ${entry.note}`);
  }
  // 移動の検知は検疫前の候補で行うため、検疫が既存ピンを維持した分は採用されていない。
  // ロックファイルへ実際に書いた値と一致する移動だけが前進である。
  reportAcceptedMoves(moves.accepted.filter((move) => lock.get(move.key) === move.to));
  reportRedundantApprovals(options.allowMoved, moves.accepted);

  writeLock(path.join(root, LOCK_FILE), lock);
  console.log(`✅ ${LOCK_FILE} に ${lock.size} 件を書き出しました`);
}

// 不変を宣言した tag の解決先が変わった件を報告して落ちる。ロックファイルは書かない
// （承認済みの移動も他のエントリも一切書かない）。
// 旧新の SHA を並べるのは、上流へ付け替えを報告するときにこの 2 値が要るため。
function failRepointed(repointed: MovedRef[]): never {
  printError(
    `不変を宣言した tag の解決先が変わりました（付け替えの疑い。${LOCK_FILE} は更新していません）:`,
  );
  for (const move of repointed) {
    console.error(`   ${move.key}: ${move.from} -> ${move.to}`);
  }
  // 承認コマンドにキーを埋め込まない。
  console.error(`   意図した更新なら上記のキーを ${ALLOW_MOVED_ENV} へ並べて再実行してください:`);
  console.error(`   make actions-pin-resolve ${ALLOW_MOVED_ENV}="<キー> [<キー>...]"`);
  process.exit(1);
}

// 採用した移動を並べる。moving tag の前進と明示承認の結果はどちらも正常だが、CI が実行する
// 内容が変わった事実は残す。
function reportAcceptedMoves(accepted: MovedRef[]): void {
  if (accepted.length === 0) return;
  console.log(`  ℹ️ tag の解決先が前進しました（${accepted.length} 件）:`);
  for (const move of accepted) {
    console.log(`     ${move.key}: ${move.from} -> ${move.to}`);
  }
}

// 移動していないキーへの承認を知らせる。承認は 1 回の付け替えに対して与えるものなので、
// 残したままにすると次の付け替えを黙って通す。
function reportRedundantApprovals(allowMoved: Set<string>, accepted: MovedRef[]): void {
  const moved = new Set(accepted.map((move) => move.key));
  const redundant = [...allowMoved].filter((key) => !moved.has(key)).sort();
  if (redundant.length === 0) return;
  console.log(
    `  ℹ️ 解決先が変わっていないため承認は不要でした（外してください）: ${redundant.join(", ")}`,
  );
}

// どの uses: からも参照されないキーへの承認を弾く。綴りを誤った承認は空振りしたまま成功に
// 見えるため、本来止めたかった付け替えがそのまま通る。
function assertAllowMovedReferenced(refs: Map<string, ActionRef>, allowMoved: Set<string>): void {
  const unknown = [...allowMoved].filter((key) => !refs.has(key)).sort();
  if (unknown.length > 0) {
    fail(`どの uses: からも参照されないキーが承認に含まれています: ${unknown.join(", ")}`);
  }
}

// 全件を走らせ切ってから、失敗をまとめて 1 つの例外にする。1 件目で打ち切ると、残りが成功
// したのか未実行なのかが出力から読めず、直しては再実行を繰り返すことになる。
async function allOrAggregate<T>(tasks: readonly Promise<T>[]): Promise<T[]> {
  const settled = await Promise.allSettled(tasks);
  const values: T[] = [];
  const reasons: string[] = [];
  for (const result of settled) {
    if (result.status === "fulfilled") values.push(result.value);
    else reasons.push(errorMessage(result.reason));
  }
  if (reasons.length > 0) {
    throw new Error(["解決に失敗した参照があります:", ...reasons.toSorted()].join("\n   "));
  }

  return values;
}

// 失敗したキーを例外に添える。どの参照で落ちたかが分からないと、tag の綴り誤りとネットワーク
// 断を切り分けられない。
async function withKey<T>(key: string, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (e) {
    throw new Error(`${key}: ${errorMessage(e)}`);
  }
}

function runApplyOrCheck(root: string, files: string[], dryRun: boolean): void {
  const lockPath = path.join(root, LOCK_FILE);
  let lock: Map<string, string>;
  try {
    lock = readLock(lockPath);
  } catch (e) {
    fail(
      `ロックファイルを読めません（先に make actions-pin-resolve を実行してください）: ${errorMessage(e)}`,
    );
  }

  const report = applyPins(root, files, lock, dryRun);
  let failed = false;
  if (report.missing.length > 0) {
    printError(
      `ロックファイルに未登録の参照があります（make actions-pin-resolve を実行してください）: ${report.missing.join(", ")}`,
    );
    failed = true;
  }
  if (report.orphans.length > 0) {
    printError(
      `どの uses: からも参照されないロックファイルのエントリがあります（該当行を削除するか make actions-pin-resolve を実行してください）: ${report.orphans.join(", ")}`,
    );
    failed = true;
  }
  if (report.drifted.length > 0) {
    printError(
      `未固定 / ロックファイルと不一致の参照があります（make actions-pin-resolve && make actions-pin-apply の結果をコミットしてください）: ${report.drifted.join(", ")}`,
    );
    failed = true;
  }
  if (report.unparsed.length > 0) {
    printError(`${UNPARSED_MESSAGE}: ${report.unparsed.join(", ")}`);
    failed = true;
  }
  if (report.unsupportedTags.length > 0) {
    printError(`${UNSUPPORTED_TAG_MESSAGE}: ${report.unsupportedTags.join(", ")}`);
    failed = true;
  }
  if (failed) process.exit(1);

  if (dryRun) {
    console.log("✅ 全アクションがロックファイル通りに固定されています");
    return;
  }
  for (const file of report.updated) console.log(`  updated ${file}`);
  console.log(`✅ ${report.updated.length} ファイルを固定しました`);
}

// resolve は対象ファイルを 1 行ずつ書き換えないため、解釈できない `uses:` を
// applyPins と同じ形で検出できない。ロックファイルに載らない参照を作らないよう、
// 走査前に同じ検査を掛ける。
function assertAllUsesParsed(root: string, files: string[]): void {
  const unparsed: string[] = [];
  for (const file of files) {
    const relative = path.relative(root, file);
    for (const line of unparsedUsesLines(readFileSync(file, "utf8"))) {
      unparsed.push(`${relative}:${line}`);
    }
  }
  if (unparsed.length > 0) fail(`${UNPARSED_MESSAGE}: ${unparsed.join(", ")}`);
}

// 版に使えない文字を含む参照を、ネットワークへ出る前に落とす。
function assertAllTagsSupported(root: string, files: string[]): void {
  const unsupported: string[] = [];
  for (const file of files) {
    const relative = path.relative(root, file);
    for (const line of unsupportedTagLines(readFileSync(file, "utf8"))) {
      unsupported.push(`${relative}:${line}`);
    }
  }
  if (unsupported.length > 0) fail(`${UNSUPPORTED_TAG_MESSAGE}: ${unsupported.join(", ")}`);
}

function parseMinAgeDays(args: string[]): number {
  let days = 0;
  for (const arg of args) {
    const match = MIN_AGE_PATTERN.exec(arg);
    if (!match) fail(USAGE);
    days = Number(match[1]);
  }
  return days;
}

// 承認リストはコマンドライン引数ではなく環境変数で受ける。環境変数ならシェルを一度も経由
// しない。
function readAllowMoved(): Set<string> {
  const raw = process.env[ALLOW_MOVED_ENV] ?? "";
  return new Set(raw.split(/\s+/).filter((key) => key !== ""));
}

function printError(message: string): void {
  console.error(`❌ ${message}`);
}

function fail(message: string): never {
  printError(message);
  process.exit(1);
}

function errorMessage(e: unknown): string {
  return (e instanceof Error && e.message ? e.message : String(e)).trim();
}

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);
  const root = process.cwd();
  const files = targetFiles(root);
  switch (command) {
    case "resolve":
      await runResolve(root, files, {
        minAgeDays: parseMinAgeDays(rest),
        allowMoved: readAllowMoved(),
      });
      return;
    case "apply":
      runApplyOrCheck(root, files, false);
      return;
    case "check":
      runApplyOrCheck(root, files, true);
      return;
    default:
      fail(USAGE);
  }
}

main().catch((e: unknown) => {
  printError(`actions-pin: ${errorMessage(e)}`);
  process.exit(1);
});
