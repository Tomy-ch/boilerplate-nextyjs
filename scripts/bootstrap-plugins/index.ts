#!/usr/bin/env node

// 本リポジトリが依存する Claude Code 公式プラグインを project スコープで宣言・有効化する。
// project スコープに置くことで marketplace とプラグイン有効化が `.claude/settings.json` に載り、
// このリポジトリを信頼した clone であれば個々の開発者のセットアップ無しに同じ資産が揃う。
// 冪等かつ非対話。再実行は no-op。
//
// 実行: pnpm exec tsx scripts/bootstrap-plugins
import { execFileSync } from "node:child_process";
import path from "node:path";

import { isCommandOnPath } from "../lib/command-presence.js";
import { errorMessage } from "../lib/error-message.js";
import { resolvedPluginPath, settingsDeclares } from "./plugins.js";

const MARKETPLACE = "claude-plugins-official";
const MARKETPLACE_SOURCE = "anthropics/claude-plugins-official";
const SCOPE = "project";
// 本リポジトリが依存する公式プラグイン。増やす場合はここに足す。
//
// プラグインは資産の束であって、束ごと採る宣言ではない。どれを採りどれを意図して採らないかは
// [README](../README.md) が挙げる決定が持つ。`feature-dev` は `code-explorer` のためだけに入れてあり、同梱の
// `/feature-dev` コマンドと `code-architect` / `code-reviewer` は使わない。
const PLUGINS = ["skill-creator", "feature-dev"];

function repoRoot(): string {
  try {
    return execFileSync("git", ["rev-parse", "--show-toplevel"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return process.cwd();
  }
}

function run(args: string[]): void {
  execFileSync("claude", args, { stdio: "inherit" });
}

function main(): void {
  if (!isCommandOnPath("claude")) {
    console.error("✘ bootstrap-plugins: 'claude' CLI が PATH に見つかりません");
    console.error("    対処: Claude Code CLI を導入してから再実行してください。");
    process.exit(1);
  }

  const settingsPath = path.join(repoRoot(), ".claude", "settings.json");

  // 1. 公式 marketplace を project スコープで宣言する（宣言済みなら no-op）。
  if (settingsDeclares(settingsPath, MARKETPLACE)) {
    console.log(`✔ marketplace は宣言済み (project): ${MARKETPLACE}`);
  } else {
    console.log(`→ marketplace を宣言 (project スコープ): ${MARKETPLACE_SOURCE}`);
    run(["plugin", "marketplace", "add", MARKETPLACE_SOURCE, "--scope", SCOPE]);
  }

  // 2. 各プラグインを project スコープで有効化する（有効化済みなら no-op）。
  for (const plugin of PLUGINS) {
    const ref = `${plugin}@${MARKETPLACE}`;

    if (settingsDeclares(settingsPath, ref)) {
      console.log(`✔ プラグインは有効化済み (project): ${ref}`);
    } else {
      console.log(`→ プラグインを導入 (project スコープ): ${ref}`);
      run(["plugin", "install", ref, "--scope", SCOPE]);
    }
  }

  // 3. 実体がディスク上に解決できることを確認する。
  for (const plugin of PLUGINS) {
    const resolved = resolvedPluginPath(plugin);

    if (resolved === undefined) {
      console.error(`✘ bootstrap-plugins: 導入後も ${plugin} をディスク上に解決できません`);
      process.exit(1);
    }

    console.log(`✔ 解決: ${plugin} (${resolved})`);
  }

  console.log("完了。新たに有効化したプラグインは次のセッションから読み込まれます。");
}

try {
  main();
} catch (error) {
  // `claude` サブコマンドが非 0 で終わった場合はその終了コードをそのまま伝播させる
  // (シェル版の set -e と同じ)。それ以外の想定外エラーだけを 2 に丸める。
  const status = (error as { status?: unknown }).status;

  if (typeof status === "number" && status !== 0) {
    console.error(`✘ bootstrap-plugins: claude コマンドが失敗しました (exit ${status})`);
    process.exit(status);
  }

  console.error(`✘ bootstrap-plugins: 想定外のエラー\n    ${errorMessage(error)}`);
  process.exit(2);
}
