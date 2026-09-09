import { describe, expect, it } from "vitest";

import {
  baseOverride,
  conflictedPaths,
  DIRTY_TREE_MESSAGE,
  invalidArguments,
  isDryRun,
  PROTECTED_BRANCH_MESSAGE,
  refuseDirtyTree,
  refuseProtectedBranch,
  USAGE_MESSAGE,
} from "./resolve";

describe("invalidArguments", () => {
  // ----- 正常系 -----
  it("引数なしを受け入れる", () => {
    expect(invalidArguments([])).toBeNull();
  });

  it("`--base=<ref>` と `--dry-run` を受け入れる", () => {
    expect(invalidArguments(["--base=release/v1.2.3", "--dry-run"])).toBeNull();
  });

  // ----- 異常系 -----
  it("知らない引数を使い方の 1 行にして返す", () => {
    expect(invalidArguments(["--force"])).toBe(`${USAGE_MESSAGE}: --force`);
  });

  it("知らない引数だけを並べ、解釈できたものは並べない", () => {
    expect(invalidArguments(["--dry-run", "--force", "extra"])).toBe(
      `${USAGE_MESSAGE}: --force extra`,
    );
  });
});

describe("baseOverride", () => {
  // ----- 正常系 -----
  it("`--base=<ref>` の値を返す", () => {
    expect(baseOverride(["--base=release/v1.2.3"])).toBe("release/v1.2.3");
  });

  it("前後の空白を落とす", () => {
    expect(baseOverride(["--base= release/v1.2.3 "])).toBe("release/v1.2.3");
  });

  it("複数回渡されたら最後の指定を採る", () => {
    expect(baseOverride(["--base=a", "--base=b"])).toBe("b");
  });

  // ----- 異常系 -----
  it("指定が無ければ null を返す", () => {
    expect(baseOverride(["--dry-run"])).toBeNull();
  });

  it("値が空の指定は指定と数えない", () => {
    expect(baseOverride(["--base=", "--base=   "])).toBeNull();
  });
});

describe("isDryRun", () => {
  // ----- 正常系 -----
  it("`--dry-run` が在れば true を返す", () => {
    expect(isDryRun(["--base=x", "--dry-run"])).toBe(true);
  });

  it("無ければ false を返す", () => {
    expect(isDryRun(["--base=x"])).toBe(false);
  });
});

describe("refuseProtectedBranch", () => {
  // ----- 正常系 -----
  it("フィーチャーブランチを通す", () => {
    expect(refuseProtectedBranch("feature/1234-add-login-form")).toBeNull();
  });

  it("前後の空白を落としてから見る", () => {
    expect(refuseProtectedBranch(" feature/x \n")).toBeNull();
  });

  // ----- 異常系 -----
  it.each(["production", "staging", "develop"])("保護ブランチ %s を拒む", (branch) => {
    expect(refuseProtectedBranch(branch)).toBe(`${PROTECTED_BRANCH_MESSAGE}（現在: ${branch}）`);
  });

  it.each(["release/v1.2.3", "hotfix/1234-cache"])("保護された族 %s を拒む", (branch) => {
    expect(refuseProtectedBranch(branch)).toBe(`${PROTECTED_BRANCH_MESSAGE}（現在: ${branch}）`);
  });

  it("名前が保護ブランチを接頭辞に持つだけの枝は通す", () => {
    expect(refuseProtectedBranch("feature/production-config")).toBeNull();
  });
});

describe("refuseDirtyTree", () => {
  // ----- 正常系 -----
  it("出力が空なら通す", () => {
    expect(refuseDirtyTree("")).toBeNull();
  });

  it("改行だけなら通す", () => {
    expect(refuseDirtyTree("\n\n")).toBeNull();
  });

  // ----- 異常系 -----
  it("変更が 1 行でもあれば拒む", () => {
    expect(refuseDirtyTree(" M src/app/page.tsx\n")).toBe(DIRTY_TREE_MESSAGE);
  });
});

describe("conflictedPaths", () => {
  // ----- 正常系 -----
  it("1 行 1 パスで並べる", () => {
    expect(conflictedPaths("pnpm-lock.yaml\nsrc/model/session.ts\n")).toEqual([
      "pnpm-lock.yaml",
      "src/model/session.ts",
    ]);
  });

  it("空行を落とす", () => {
    expect(conflictedPaths("\n\npnpm-lock.yaml\n\n")).toEqual(["pnpm-lock.yaml"]);
  });

  it("衝突が無ければ空にする", () => {
    expect(conflictedPaths("")).toEqual([]);
  });
});
