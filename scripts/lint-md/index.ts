// Markdown の検査をまとめて通す入口。順と中身は [steps.ts](steps.ts) が持つ。
//
// `pnpm lint:md` が呼ぶ。各段は `pnpm exec` を挟まず直接起動し、落ちた段の終了コードを
// そのまま返す。

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LINT_STEPS } from "./steps.js";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const BIN_DIR = path.join(ROOT_DIR, "node_modules/.bin");

for (const { name, command } of LINT_STEPS) {
  const [executable, ...args] = command;
  const result = spawnSync(path.join(BIN_DIR, executable as string), args, {
    cwd: ROOT_DIR,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    console.error(`✘ lint:md: ${name} で落ちました`);
    process.exit(result.status ?? 1);
  }
}
