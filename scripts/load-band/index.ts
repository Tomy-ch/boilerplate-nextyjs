import { execFileSync } from "node:child_process";
import { availableParallelism, loadavg } from "node:os";
import { resolveBand } from "./band";
import { countWorktrees } from "./worktree-count";

/** ローカルゲートの帯を出力する入口。`env` は recipe が `eval` する形、`status` は人間が読む形。 */

/** 作業ツリーの数を git へ問う。答えが読めなければ `null`。 */
function askWorktreeCount(): number | null {
  try {
    return countWorktrees(
      execFileSync("git", ["worktree", "list", "--porcelain"], { encoding: "utf8" }),
    );
  } catch {
    return null;
  }
}

const worktrees = askWorktreeCount();
const cpus = availableParallelism();
// 1 分平均。値を持たない OS は 0 を返すので、届かなかったときも同じ 0 として扱う。
const [loadAverage = 0] = loadavg();

// 数えられなかったときは 1 窓として扱う。配分を絞らない側へ倒したうえで、倒した事実を根拠へ足す。
const resolution = resolveBand({ worktrees: worktrees ?? 1, cpus, loadAverage });
const reason =
  worktrees === null
    ? `${resolution.reason}（作業ツリーの数は数えられなかったため 1 窓として扱いました）`
    : resolution.reason;

const mode = process.argv[2] ?? "status";

if (mode === "env") {
  console.log(`LOAD_BAND=${resolution.band}`);
  console.log(`LOAD_CPU_SHARE=${resolution.cpuShare}`);
  console.log(`LOAD_REASON="${reason}"`);
} else if (mode === "status") {
  console.log(`帯: ${resolution.band}`);
  console.log(`1 窓あたりの CPU: ${resolution.cpuShare}`);
  console.log(`根拠: ${reason}`);
} else {
  console.error(`❌ 使い方: tsx scripts/load-band [status|env]（"${mode}" は解釈できません）`);
  process.exit(1);
}
