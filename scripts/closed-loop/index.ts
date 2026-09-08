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
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { errorMessage } from "../lib/error-message.js";
import { MARK_ORDER, type WindowMarks } from "./phases.js";
import { reportAll, reportTranscript } from "./report.js";
import { countTranscript, countUnparsable, neverInvoked, toProjectSlug } from "./transcript.js";

/** 打刻の置き場（リポジトリルート相対）。 */
const MARKS_DIR = "tmp/closed-loop/marks";

/** 宣言されたスキルの置き場（リポジトリルート相対）。 */
const SKILLS_DIR = ".claude/skills";

const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..");

/**
 * 1 つの窓のディレクトリを読む。
 *
 * @remarks
 * 読むのは `MARK_ORDER` に在る名前だけです。知らない名前を拾うと、打ち間違いが打刻として
 * 集計に混ざります —— 名前の集合が閉じているのは刻む側と同じ理由です。
 */
function readWindow(root: string, id: string): WindowMarks {
  const dir = path.join(root, MARKS_DIR, id);
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

/**
 * このリポジトリの作業ツリー。
 *
 * @remarks
 * 打刻も記録も**作業ツリーごとに割れます** —— 打刻は追跡外の `tmp/` に置かれ、記録の置き場は
 * セッションを開いたディレクトリから導かれるためです。窓を数え落とさないために全部を読みますが、
 * **どれがこのリポジトリのものかを決めるのは git です**（[0160](../../docs/adr/0160-agent-environment-loop.md)
 * 決定 5）。名前の似たディレクトリを拾うと、範囲の境界が推測になります。
 *
 * git が答えられなければ、いま居る作業ツリーだけを見ます。
 */
function workingTreeRoots(): readonly string[] {
  try {
    return execFileSync("git", ["worktree", "list", "--porcelain"], {
      cwd: REPO_ROOT,
      encoding: "utf8",
    })
      .split("\n")
      .filter((line) => line.startsWith("worktree "))
      .map((line) => line.slice("worktree ".length));
  } catch {
    return [REPO_ROOT];
  }
}

/** 窓を古い順に並べる。id は `w<epoch>-<suffix>` なので、その epoch で並ぶ。 */
function listWindows(roots: readonly string[]): readonly WindowMarks[] {
  return roots
    .flatMap((root) => {
      const dir = path.join(root, MARKS_DIR);

      if (!fs.existsSync(dir)) {
        return [];
      }

      return fs
        .readdirSync(dir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => readWindow(root, entry.name));
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * セッションの記録の置き場。作業ツリー 1 つにつき 1 つ。
 *
 * @remarks
 * 置き場を決めているのはツールで、リポジトリの外にあります。**範囲はこのリポジトリのぶんだけ** ——
 * ツールは 1 人の全プロジェクトぶんを同じ親の下に並べるので、`workingTreeRoots` が挙げた
 * ディレクトリより外へ出ません（[0160](../../docs/adr/0160-agent-environment-loop.md) 決定 5）。
 */
function transcriptDirs(roots: readonly string[]): readonly string[] {
  const parent = path.join(os.homedir(), ".claude", "projects");

  return roots
    .map((root) => path.join(parent, toProjectSlug(root)))
    .filter((dir) => fs.existsSync(dir));
}

/** 記録の全行。置き場が無ければ空。 */
function readTranscripts(dirs: readonly string[]): readonly string[] {
  return dirs.flatMap((dir) =>
    fs
      .readdirSync(dir)
      .filter((name) => name.endsWith(".jsonl"))
      .flatMap((name) => fs.readFileSync(path.join(dir, name), "utf8").split("\n")),
  );
}

/** 宣言されているスキルの名前。 */
function declaredSkills(): readonly string[] {
  const dir = path.join(REPO_ROOT, SKILLS_DIR);

  if (!fs.existsSync(dir)) {
    return [];
  }

  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function main(): void {
  const roots = workingTreeRoots();

  for (const line of reportAll(listWindows(roots))) {
    console.log(line);
  }

  const dirs = transcriptDirs(roots);
  const lines = readTranscripts(dirs);
  const counts = countTranscript(lines);
  const declared = declaredSkills();

  for (const line of reportTranscript(counts, {
    files: lines.length,
    places: dirs.length,
    unparsable: countUnparsable(lines),
    declared,
    never: neverInvoked(declared, counts),
  })) {
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
