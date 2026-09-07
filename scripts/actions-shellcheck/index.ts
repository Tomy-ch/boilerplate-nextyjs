#!/usr/bin/env node

// composite action（`.github/actions/**/action.yaml`）の `run:` シェルを shellcheck で検査する。
//
// actionlint は `.github/workflows` しか走査せず、action 定義を直接渡すと workflow として
// 解釈して構文エラーで落ちるため、composite action の中のシェルはどのゲートにも掛からない。
// この穴を埋めるのが本ツールの責務で、workflow 側の `run:` は引き続き actionlint が受け持つ。
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseActionFile, targetFiles } from "./composite-step.js";
import { assertShellcheckAvailable, checkStep, shebangFor } from "./shellcheck.js";

function main(): void {
  assertShellcheckAvailable();

  const root = process.cwd();
  const files = targetFiles(root);
  const parsed = files.map((file) =>
    parseActionFile(file, readFileSync(path.join(root, file), "utf8")),
  );
  // 抽出が壊れて「検査していないのに緑」になる状態を、件数の突き合わせでファイルごとに
  // 落とす。合計で見ると 1 ファイルの抽出失敗が他ファイルの成功に隠れる。
  for (const action of parsed) {
    if (action.steps.length !== action.expectedSteps) {
      fail(
        `${action.file}: run ステップの抽出数が合いません（期待 ${action.expectedSteps} / 抽出 ${action.steps.length}）`,
      );
    }
  }
  const steps = parsed.flatMap((action) => action.steps);

  const skipped: string[] = [];
  const findings: string[] = [];
  let checked = 0;

  for (const step of steps) {
    const shebang = shebangFor(step.shell);
    if (!shebang) {
      // 件数だけを出すと「検査したつもり」になるため、位置と方言を添えて個別に出す。
      skipped.push(
        `  ⏭️ ${step.file}:${step.firstLine}: shell="${step.shell}" は shellcheck の対象外のため検査しません`,
      );
      continue;
    }
    checked++;
    findings.push(...checkStep(step, shebang));
  }

  for (const line of skipped) console.log(line);
  for (const line of findings) console.error(line);

  if (findings.length > 0) {
    console.error(
      `❌ composite action の run に ${findings.length} 件の指摘があります（検査 ${checked} ステップ）`,
    );
    process.exit(1);
  }
  console.log(
    `✅ composite action ${files.length} ファイルの run を ${checked} ステップ検査しました（対象外 shell: ${skipped.length} ステップ）`,
  );
}

function fail(message: string): never {
  console.error(`❌ ${message}`);
  process.exit(1);
}

try {
  main();
} catch (e) {
  fail(e instanceof Error ? e.message : String(e));
}
