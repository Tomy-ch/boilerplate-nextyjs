// 宣言を SSOT にした harden-runner の書き換え。apply と check は同じ判定関数を dryRun で
// 共用し、「検査は通るのに適用結果が違う」乖離が構造的に起きないようにする（actions-pin と同形）。
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { type Declaration, endpointsFor } from "./declaration.js";

const FILE_MODE = 0o644;

/** 走査する範囲。harden-runner が立つのは job の冒頭だけなので composite action は含まない。 */
export const WORKFLOW_DIR = ".github/workflows";

const HARDEN = /^(\s*)uses: step-security\/harden-runner@/;

export type RewriteResult = {
  readonly out: string;
  /** 想定した形をしていなかった行番号（1 始まり）。 */
  readonly malformed: number[];
};

/**
 * 1 ファイルの harden-runner を宣言どおりに書き換える。
 *
 * @param endpoints - 許す宛先。`null` なら監査のまま残す
 *
 * @remarks
 * 想定する形は次の 3 行 + 任意の許可リストです。**この形から外れていたら書き換えず、
 * 行番号を返します** —— 部分的に合う塊へ機械的に当てると、`with:` の他の入力を消しかねません。
 *
 * ```yaml
 * uses: step-security/harden-runner@<sha> # <tag>
 * with:
 *   egress-policy: <audit|block>
 * ```
 */
export function rewriteHarden(data: string, endpoints: readonly string[] | null): RewriteResult {
  const lines = data.split("\n");
  const out: string[] = [];
  const malformed: number[] = [];
  // 書き換えた塊の末尾。ここまでは読み飛ばす。
  let consumed = -1;

  for (const [at, line] of lines.entries()) {
    if (at <= consumed) continue;

    if (!HARDEN.test(line)) {
      out.push(line);
      continue;
    }

    const indent = indentOf(line);

    if (!isExpectedShape(lines, at, indent)) {
      malformed.push(at + 1);
      out.push(line);
      continue;
    }

    out.push(line, ...policyBlock(indent, endpoints));
    consumed = endOfStep(lines, at, indent);
  }

  return { out: out.join("\n"), malformed };
}

function indentOf(line: string): string {
  return line.slice(0, line.length - line.trimStart().length);
}

/** 書き換えてよい形か。`with:` と `egress-policy:` がこの順で続くことだけを見る。 */
function isExpectedShape(lines: readonly string[], at: number, indent: string): boolean {
  return (
    lines[at + 1] === `${indent}with:` &&
    (lines[at + 2]?.startsWith(`${indent}  egress-policy:`) ?? false)
  );
}

/** 書き出す `with:` の中身。 */
function policyBlock(indent: string, endpoints: readonly string[] | null): string[] {
  if (endpoints === null) return [`${indent}with:`, `${indent}  egress-policy: audit`];

  return [
    `${indent}with:`,
    `${indent}  egress-policy: block`,
    `${indent}  allowed-endpoints: >`,
    ...endpoints.map((endpoint) => `${indent}    ${endpoint}`),
  ];
}

/** 読み飛ばす末尾。書き換えた 3 行と、既にあった許可リストの続き。 */
function endOfStep(lines: readonly string[], at: number, indent: string): number {
  let last = at + 2;

  if (lines[last + 1]?.startsWith(`${indent}  allowed-endpoints:`)) {
    last += 1;
    while (lines[last + 1]?.startsWith(`${indent}    `)) last += 1;
  }

  return last;
}

export type EgressReport = {
  /** 宣言どおりに固定されていないファイル（リポジトリ相対）。dryRun のときだけ埋まる。 */
  readonly drifted: string[];
  /** 書き換えたファイル（リポジトリ相対）。dryRun のときは空。 */
  readonly updated: string[];
  /** 想定した形の外にあった位置（`<相対パス>:<行番号>`）。 */
  readonly malformed: string[];
  /** 監査のまま残した workflow の名前。 */
  readonly audited: string[];
};

/** `.github/workflows` の定義ファイル名（拡張子を除く）を並べる。 */
export function workflowNames(root: string): string[] {
  return readdirSync(join(root, WORKFLOW_DIR))
    .filter((entry) => entry.endsWith(".yaml"))
    .map((entry) => basename(entry, ".yaml"))
    .sort((a, b) => a.localeCompare(b));
}

/**
 * 全 workflow を宣言と突き合わせる。
 *
 * @param dryRun - `true` なら書かずに差分だけを報告する
 */
export function runEgress(root: string, declaration: Declaration, dryRun: boolean): EgressReport {
  const drifted: string[] = [];
  const updated: string[] = [];
  const malformed: string[] = [];
  const audited: string[] = [];

  for (const name of workflowNames(root)) {
    const relative = `${WORKFLOW_DIR}/${name}.yaml`;
    const file = join(root, relative);
    const data = readFileSync(file, "utf8");
    const endpoints = endpointsFor(declaration, name);

    if (endpoints === null) audited.push(name);

    const result = rewriteHarden(data, endpoints);

    for (const at of result.malformed) malformed.push(`${relative}:${at}`);

    if (result.out === data) continue;

    if (dryRun) {
      drifted.push(relative);
      continue;
    }

    writeFileSync(file, result.out, { mode: FILE_MODE });
    updated.push(relative);
  }

  return { drifted, updated, malformed, audited };
}
