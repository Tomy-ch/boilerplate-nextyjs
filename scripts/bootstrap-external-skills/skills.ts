import os from "node:os";
import path from "node:path";

/** 置き場の解決に使う環境変数。 */
export type ClaudeEnv = Readonly<Record<string, string | undefined>>;

/** 導入する外部スキル 1 件。 */
export type ExternalSkill = {
  /** PATH から起動するコマンド名。 */
  command: string;
  args: readonly string[];
  /** 導入後に実体が居るべき場所。ここを見て着地を検証する。 */
  landing: string;
  /** 出力に出す表示名。 */
  label: string;
};

/**
 * 設定の置き場。
 *
 * @remarks
 * 着地検証はインストーラと同じ優先順位で解決しないと、導入は成功しているのに検証だけが
 * `~/.claude` を見て失敗します。
 */
export function claudeConfigDir(env: ClaudeEnv = process.env): string {
  return env["CLAUDE_CONFIG_DIR"] || path.join(os.homedir(), ".claude");
}

/**
 * 導入する外部スキル。増やす場合はここに足す。
 *
 * @remarks
 * Claude Code だけを対象にするのは、本リポジトリが `.codex/` などの他アシスタント用の器を
 * 持たず、着地検証ができないためです。器を用意したら platform を足します。
 *
 * 引数は `install --platform claude` から動かしません。graphify の `install` 系統は綴り次第で
 * リポジトリの `CLAUDE.md` / `AGENTS.md` / `.cursor/` / `.gemini/` / git hook を書き換えます
 * (`--project` を足す、`--platform` を cursor / gemini にする、`<name> install` を使う)。
 * AGENTS.md が保護対象と定めているファイル群であり、`.claude/settings.json` の deny は
 * `install` 系統を丸ごと塞いでいます。この経路だけが例外で、スクリプトの外から叩かせません。
 */
export function externalSkills(env: ClaudeEnv = process.env): ExternalSkill[] {
  return [
    {
      command: "graphify",
      args: ["install", "--platform", "claude"],
      landing: path.join(claudeConfigDir(env), "skills", "graphify", "SKILL.md"),
      label: "graphify (Claude Code)",
    },
  ];
}
