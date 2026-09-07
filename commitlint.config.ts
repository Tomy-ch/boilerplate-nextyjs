import { RuleConfigSeverity, type UserConfig } from "@commitlint/types";

// コミット規約の prefix 11 種を commit-msg hook で機械強制する。
// Feat / CI のように大文字構成が混在するため type-case は課さない。
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
