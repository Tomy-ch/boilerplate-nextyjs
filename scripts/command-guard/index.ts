#!/usr/bin/env node
// 塞いだコマンドが、宣言の前方一致では届かない位置に現れたときに止める入口。
//
// 判定は [judge.ts](judge.ts) が持つ。ここが担うのは標準入力の受け取りと終了コードだけである。
//
// **`tsx` を経由しない。** これは Bash の呼び出しごとに走るので、起動が丸ごと待ち時間になる。実測で
// `pnpm exec tsx` は 1.04s、Node の型ストリップは 0.08s だった（[0159](../../docs/adr/0159-script-structure.md)
// の「hook から呼ばれ、常に即答することが要件のもの」）。呼び出し側は `node scripts/command-guard` で綴る。
//
// **判定できないときは通す。** `node_modules` が無い・設定が読めない・ペイロードが壊れている、の
// いずれも「塞ぐ対象が分からない」であって「塞ぐ対象が無い」ではない。ここで止めると、環境が整う前の
// あらゆる Bash が止まる。前方一致の宣言は `permissions.deny` 側が引き続き効いているので、素通しには
// ならない。
import fs from "node:fs";
import path from "node:path";

import { deriveLiterals, judge } from "./judge.ts";

/** Claude Code がフックへ渡すリポジトリルート。直に呼ばれたときは cwd へ落ちる。 */
const PROJECT_DIR_ENV = "CLAUDE_PROJECT_DIR";

const SETTINGS = path.join(
  process.env[PROJECT_DIR_ENV] ?? process.cwd(),
  ".claude",
  "settings.json",
);

/** `permissions.deny` を読む。読めなければ空にして通す。 */
function readDenyEntries(): readonly string[] {
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(SETTINGS, "utf8"));
    const entries = (parsed as { permissions?: { deny?: unknown } })?.permissions?.deny;
    return Array.isArray(entries)
      ? entries.filter((entry): entry is string => typeof entry === "string")
      : [];
  } catch {
    return [];
  }
}

/** PreToolUse のペイロードから、これから走るコマンド行を取り出す。 */
function readCommandLine(raw: string): string {
  try {
    const payload: unknown = JSON.parse(raw);
    const command = (payload as { tool_input?: { command?: unknown } })?.tool_input?.command;
    return typeof command === "string" ? command : "";
  } catch {
    return "";
  }
}

function refuse(literal: string): never {
  process.stderr.write(
    `${literal} は permissions.deny が塞いでいる操作です。宣言の前方一致が届かない位置に現れたため、ここで止めました。\n` +
      "別のインタプリタや包みへ迂回させず、必要なら利用者へ渡してください。\n",
  );
  process.exit(2);
}

const [, , mode, ...rest] = process.argv;
const literals = deriveLiterals(readDenyEntries());

if (mode === "--list") {
  for (const literal of literals) process.stdout.write(`${literal}\n`);
} else if (mode === "--hook") {
  let raw = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => {
    raw += chunk;
  });
  process.stdin.on("end", () => {
    const commandLine = readCommandLine(raw);
    if (!commandLine) process.exit(0);

    const hit = judge(commandLine, literals);
    if (hit) refuse(hit);
    process.exit(0);
  });
} else if (rest.length > 0 || mode) {
  const hit = judge([mode, ...rest].join(" "), literals);
  process.stdout.write(hit ? `拒否: ${hit}\n` : "通過\n");
  process.exit(hit ? 1 : 0);
} else {
  process.stderr.write(
    "使い方: node scripts/command-guard <command>... | --hook | --list\n" +
      "塞ぐ対象は .claude/settings.json の permissions.deny が持つ。ここは持たない。\n",
  );
  process.exit(2);
}
