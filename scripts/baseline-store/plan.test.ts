import { describe, expect, it } from "vitest";

import {
  formatPrunePlan,
  isNotFound,
  isSnapshotRef,
  needsPrune,
  parseDefaultBranch,
  planPrune,
  type SnapshotRef,
  selectLiveBranches,
  selectRetainedTags,
  snapshotRefName,
} from "./plan";
import { PRUNE_THRESHOLDS, RETAINED_TAG_COUNT } from "./retention";

const ref = (name: string, sha: string): SnapshotRef => ({ name, sha });

describe("snapshotRefName", () => {
  // ----- 正常系 -----
  it("ブランチ名をそのまま接頭辞の下へ置く", () => {
    expect(snapshotRefName("feature/159-vrt")).toBe("snapshot/feature/159-vrt");
  });

  // ----- 異常系 -----
  it.each([
    ["空文字", ""],
    ["先頭のスラッシュ", "/develop"],
    ["末尾のスラッシュ", "develop/"],
    ["先頭のハイフン", "-develop"],
    [".lock 終わり", "develop.lock"],
    ["連続したスラッシュ", "feature//x"],
    ["連続したドット", "feature/..x"],
    ["リビジョン指定子", "feature/@{1}"],
    ["空白", "feature/a b"],
    ["ワイルドカード", "feature/a*"],
    ["制御文字", "feature/a\u0001"],
  ])("ref 名に使えない %s を拒む", (_label, branch) => {
    expect(() => snapshotRefName(branch)).toThrow(/ref 名に使えない/);
  });
});

describe("isSnapshotRef", () => {
  // ----- 正常系 -----
  it("接頭辞の下にある ref を撮影と見なす", () => {
    expect(isSnapshotRef("snapshot/develop")).toBe(true);
  });

  // ----- 異常系 -----
  it("接頭辞だけの ref は撮影と見なさない", () => {
    expect(isSnapshotRef("snapshot/")).toBe(false);
  });

  it("接頭辞を持たない ref は撮影と見なさない", () => {
    expect(isSnapshotRef("main")).toBe(false);
  });
});

describe("selectLiveBranches", () => {
  // ----- 正常系 -----
  it("常設ブランチとリリース系の先端を選ぶ", () => {
    expect(
      selectLiveBranches(["production", "develop", "release/v0.5.0", "hotfix/v0.4.1"]),
    ).toEqual(["production", "develop", "release/v0.5.0", "hotfix/v0.4.1"]);
  });

  // ----- 異常系 -----
  it("作業ブランチは選ばない", () => {
    expect(selectLiveBranches(["feature/159-vrt", "bugfix/1-x"])).toEqual([]);
  });

  it("* を区切りを跨いで広げない", () => {
    expect(selectLiveBranches(["release/v0.5.0/old"])).toEqual([]);
  });

  it("常設ブランチ名を接頭辞に持つだけのブランチを選ばない", () => {
    expect(selectLiveBranches(["develop-2"])).toEqual([]);
  });
});

describe("selectRetainedTags", () => {
  // ----- 正常系 -----
  it("新しい順の先頭から保持する本数だけを取る", () => {
    const tags = Array.from({ length: RETAINED_TAG_COUNT + 5 }, (_, i) => `v0.0.${i}`);

    expect(selectRetainedTags(tags)).toEqual(tags.slice(0, RETAINED_TAG_COUNT));
  });

  // ----- 異常系 -----
  it("本数に満たなければ全数を取る", () => {
    expect(selectRetainedTags(["v0.0.1"])).toEqual(["v0.0.1"]);
  });
});

describe("parseDefaultBranch", () => {
  // ----- 正常系 -----
  it("symref 行から既定ブランチを取り出す", () => {
    const output = "ref: refs/heads/main\tHEAD\n0123456789abcdef\tHEAD\n";

    expect(parseDefaultBranch(output)).toBe("main");
  });

  it("区切りを含むブランチ名も取り出す", () => {
    expect(parseDefaultBranch("ref: refs/heads/trunk/v2\tHEAD\n")).toBe("trunk/v2");
  });

  // ----- 異常系 -----
  it("symref 行が無ければ拒む", () => {
    expect(() => parseDefaultBranch("0123456789abcdef\tHEAD\n")).toThrow(
      /既定ブランチを解決できません/,
    );
  });
});

describe("isNotFound", () => {
  // ----- 正常系 -----
  it("gh が出した 404 の診断文を 404 と見なす", () => {
    expect(isNotFound("gh: No commit found for the ref v0.4.0 (HTTP 404)\n")).toBe(true);
  });

  // ----- 異常系 -----
  it("404 以外の応答を 404 と見なさない", () => {
    expect(isNotFound("gh: Bad credentials (HTTP 401)\n")).toBe(false);
  });

  it("stderr を持たない失敗を 404 と見なさない", () => {
    expect(isNotFound("")).toBe(false);
  });
});

describe("planPrune", () => {
  // ----- 正常系 -----
  it("生きた ref から指されていない撮影を消す対象にする", () => {
    const plan = planPrune(
      [ref("snapshot/develop", "aaa"), ref("snapshot/feature/old", "bbb")],
      new Set(["aaa"]),
    );

    expect(plan.keep.map((r) => r.name)).toEqual(["snapshot/develop"]);
    expect(plan.remove.map((r) => r.name)).toEqual(["snapshot/feature/old"]);
  });

  // ----- 異常系 -----
  it("既定ブランチは指されていなくても残す", () => {
    const plan = planPrune([ref("main", "root")], new Set());

    expect(plan.remove).toEqual([]);
    expect(plan.keep.map((r) => r.name)).toEqual(["main"]);
  });

  it("撮影以外の ref は判らないものとして残す", () => {
    const plan = planPrune([ref("experiment", "ccc")], new Set());

    expect(plan.remove).toEqual([]);
    expect(plan.keep.map((r) => r.name)).toEqual(["experiment"]);
  });
});

describe("needsPrune", () => {
  const empty = { keep: [], remove: [] };

  // ----- 正常系 -----
  it("どちらの閾値にも届かなければ促さない", () => {
    expect(needsPrune(empty, PRUNE_THRESHOLDS.repositoryMiB - 1)).toBe(false);
  });

  // ----- 異常系 -----
  it("消せる ref が閾値に達したら促す", () => {
    const remove = Array.from({ length: PRUNE_THRESHOLDS.removableRefs }, (_, i) =>
      ref(`snapshot/x${i}`, `sha${i}`),
    );

    expect(needsPrune({ keep: [], remove }, 0)).toBe(true);
  });

  it("総量が閾値に達したら促す", () => {
    expect(needsPrune(empty, PRUNE_THRESHOLDS.repositoryMiB)).toBe(true);
  });
});

describe("formatPrunePlan", () => {
  // ----- 正常系 -----
  it("消す対象を ref 名と短縮 sha で並べる", () => {
    const plan = planPrune([ref("snapshot/feature/old", "0123456789abcdef")], new Set());

    expect(formatPrunePlan(plan, 120)).toContain("- snapshot/feature/old (0123456)");
  });

  // ----- 異常系 -----
  it("消す対象が無ければ一覧を出さない", () => {
    const report = formatPrunePlan({ keep: [ref("main", "root")], remove: [] }, 10);

    expect(report).not.toContain("消す対象:");
    expect(report).toContain("消せる ref: 0 本");
  });
});
