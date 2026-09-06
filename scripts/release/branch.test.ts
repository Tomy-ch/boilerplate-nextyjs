import { describe, expect, it } from "vitest";

import { branchCreationBlocker, isReleaseBranchPrefix, planReleaseBranch } from "./branch";

describe("isReleaseBranchPrefix", () => {
  // ----- 正常系 -----
  it("hotfix / release をブランチの種別として受け入れる", () => {
    expect(isReleaseBranchPrefix("hotfix")).toBe(true);
    expect(isReleaseBranchPrefix("release")).toBe(true);
  });

  // ----- 異常系 -----
  it("種別でない指定を拒否する", () => {
    expect(isReleaseBranchPrefix("feature")).toBe(false);
    expect(isReleaseBranchPrefix("")).toBe(false);
  });
});

describe("planReleaseBranch", () => {
  // ----- 正常系 -----
  it("種別と次の版からブランチ名を組み立てる", () => {
    expect(
      planReleaseBranch({ latest: "v1.2.3", next: "v1.2.4", prefix: "hotfix" }).branchName,
    ).toBe("hotfix/v1.2.4");
    expect(
      planReleaseBranch({ latest: "v1.2.3", next: "v1.3.0", prefix: "release" }).branchName,
    ).toBe("release/v1.3.0");
  });

  it("基準の版と次の版を名乗る", () => {
    const plan = planReleaseBranch({ latest: "v1.2.3", next: "v1.3.0", prefix: "release" });

    expect(plan.notices).toEqual([
      { kind: "log", message: "🔖 タグから最新リリースバージョンを取得: 【 v1.2.3 】" },
      { kind: "log", message: "➡️ 次のリリースバージョンを作成: 【 v1.3.0 】" },
      { kind: "log", message: "🌱 ブランチを作成: production → 【 release/v1.3.0 】" },
    ]);
  });

  it("既存かどうかを origin へ問い合わせる", () => {
    const plan = planReleaseBranch({ latest: "v1.2.3", next: "v1.3.0", prefix: "release" });

    expect(plan.existenceProbe).toEqual({
      command: "git",
      args: ["ls-remote", "--exit-code", "--heads", "origin", "release/v1.3.0"],
    });
  });

  it("production から切り、依存を揃えて版を焼き込んでから押し、押し終えてから既定ブランチを張り替える", () => {
    const plan = planReleaseBranch({ latest: "v1.2.3", next: "v1.3.0", prefix: "release" });

    expect(plan.steps).toEqual([
      { kind: "run", command: "git", args: ["fetch", "origin", "production"] },
      {
        kind: "run",
        command: "git",
        args: ["switch", "-c", "release/v1.3.0", "origin/production"],
      },
      {
        kind: "run",
        command: "pnpm",
        args: ["install", "--frozen-lockfile", "--ignore-scripts"],
      },
      { kind: "run", command: "make", args: ["version-stamp-commit", "REF=release/v1.3.0"] },
      {
        kind: "run",
        command: "git",
        args: ["push", "--no-verify", "origin", "release/v1.3.0"],
      },
      { kind: "log", message: "⚙️ GitHub上のデフォルトブランチを release/v1.3.0 に設定します。" },
      { kind: "run", command: "gh", args: ["repo", "edit", "--default-branch", "release/v1.3.0"] },
      {
        kind: "log",
        message: "✅ デフォルトブランチを release/v1.3.0 に切り替えて、プッシュしました。",
      },
    ]);
  });
});

describe("branchCreationBlocker", () => {
  // ----- 正常系 -----
  it("ブランチが無く作業ツリーが綺麗なら止めない", () => {
    expect(
      branchCreationBlocker({
        branchName: "release/v1.3.0",
        branchExists: false,
        workTreeStatus: "\n",
      }),
    ).toBeNull();
  });

  // ----- 異常系 -----
  it("同名のブランチが既に在れば止める", () => {
    expect(
      branchCreationBlocker({
        branchName: "release/v1.3.0",
        branchExists: true,
        workTreeStatus: "",
      }),
    ).toEqual([
      {
        kind: "log",
        message: "❌ ブランチ【 release/v1.3.0 】は既に存在します。処理を中止します。",
      },
    ]);
  });

  it("同名のブランチが在り作業ツリーも汚れていれば、存在の方を理由に出す", () => {
    expect(
      branchCreationBlocker({
        branchName: "release/v0.7.0",
        branchExists: true,
        workTreeStatus: " M src/app/page.tsx\n",
      }),
    ).toEqual([
      {
        kind: "log",
        message: "❌ ブランチ【 release/v0.7.0 】は既に存在します。処理を中止します。",
      },
    ]);
  });

  it("作業ツリーに未コミットの変更があれば、内訳を出して止める", () => {
    expect(
      branchCreationBlocker({
        branchName: "release/v1.3.0",
        branchExists: false,
        workTreeStatus: " M src/app/page.tsx\n",
      }),
    ).toEqual([
      {
        kind: "log",
        message:
          "❌ 作業ツリーに未コミットの変更があります。変更をコミットまたは退避してから再実行してください。",
      },
      { kind: "run", command: "git", args: ["status", "--short"] },
    ]);
  });

  it("汚れが基準画像の指し先だけなら、合わせ直す手を案内する", () => {
    expect(
      branchCreationBlocker({
        branchName: "release/v1.3.0",
        branchExists: false,
        workTreeStatus: "M  baseline/images\n",
      }),
    ).toEqual([
      {
        kind: "log",
        message:
          "❌ baseline/images の実体が、いま居るブランチの指す版とずれています。" +
          "git submodule update --init baseline/images で合わせてから再実行してください。",
      },
    ]);
  });

  it("指し先のずれに他の変更が混じっていれば、commit か退避を案内する", () => {
    expect(
      branchCreationBlocker({
        branchName: "release/v1.3.0",
        branchExists: false,
        workTreeStatus: "M  baseline/images\n M src/app/page.tsx\n",
      }),
    ).toEqual([
      {
        kind: "log",
        message:
          "❌ 作業ツリーに未コミットの変更があります。変更をコミットまたは退避してから再実行してください。",
      },
      { kind: "run", command: "git", args: ["status", "--short"] },
    ]);
  });
});
