import { RuleConfigSeverity, type UserConfig } from "@commitlint/types";

// コミット規約の prefix 11 種を commit-msg hook で機械強制する。
// 型名は Conventional Commits と同じだが小文字へ揃えないので、type-case は課さない。
const config: UserConfig = {
  rules: {
    "type-enum": [
      RuleConfigSeverity.Error,
      "always",
      [
        "Feat",
        "Fix",
        "Refactor",
        "Perf",
        "Docs",
        "Test",
        "Build",
        "CI",
        "Chore",
        "Style",
        "Revert",
      ],
    ],
    "type-empty": [RuleConfigSeverity.Error, "never"],
    "subject-empty": [RuleConfigSeverity.Error, "never"],
    "subject-full-stop": [RuleConfigSeverity.Error, "never", "。"],
  },
};

export default config;
