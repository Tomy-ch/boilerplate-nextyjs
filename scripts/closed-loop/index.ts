#!/usr/bin/env node

// 打刻された開発の窓の、段の区間と所見を報告する入口。
//
//   closed-loop            すべての窓を報告する
//
// 打刻は `.agents/closed-loop/marks.sh` が刻み、置き場は追跡外の `tmp/closed-loop/marks/` である
// （[0160](../../docs/adr/0160-agent-environment-loop.md) 決定 4）。ここは読むだけで、何も刻まない。
//
// **決定的な集計だけを行い、モデルを使わない**（同 決定 2）。区間・回数・順序は数えるものであって
// 解釈するものではなく、この層の数は監査できる。「何が難しかったか」は別の段の仕事である。
import fs from "node:fs";
import path from "node:path";

import { errorMessage } from "../lib/error-message.js";
import { MARK_ORDER, type WindowMarks } from "./phases.js";
import { reportAll } from "./report.js";

/** 打刻の置き場（リポジトリルート相対）。 */
const MARKS_DIR = "tmp/closed-loop/marks";

const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..");

/**
 * 1 つの窓のディレクトリを読む。
 *
 * @remarks
 * 読むのは `MARK_ORDER` に在る名前だけです。知らない名前を拾うと、打ち間違いが打刻として
 * 集計に混ざります —— 名前の集合が閉じているのは刻む側と同じ理由です。
 */
function readWindow(id: string): WindowMarks {
  const dir = path.join(REPO_ROOT, MARKS_DIR, id);
  const marks: Record<string, readonly number[]> = {};

  for (const name of MARK_ORDER) {
    const file = path.join(dir, name);

    if (!fs.existsSync(file)) {
      continue;
    }

    const epochs = fs
      .readFileSync(file, "utf8")
      .split("\n")
      .map((line) => Number.parseInt(line.trim(), 10))
      .filter((value) => Number.isFinite(value));

    if (epochs.length > 0) {
      marks[name] = epochs;
    }
  }

  return { id, marks };
}

/** 窓を古い順に並べる。id は `w<epoch>-<suffix>` なので、その epoch で並ぶ。 */
function listWindows(): readonly WindowMarks[] {
  const root = path.join(REPO_ROOT, MARKS_DIR);

  if (!fs.existsSync(root)) {
    return [];
  }

  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .map(readWindow);
}

function main(): void {
  for (const line of reportAll(listWindows())) {
    console.log(line);
  }
}

/* istanbul ignore next -- CLI entry。起動経路は make closed-loop-report が実地で通す。 */
try {
  main();
} catch (error) {
  console.error(`❌ ${errorMessage(error)}`);
  process.exit(1);
}
