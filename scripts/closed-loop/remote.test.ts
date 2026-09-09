import { describe, expect, it } from "vitest";

import { issueNumberFrom, toRepoSlug } from "./remote";

describe("toRepoSlug", () => {
  // ----- 正常系 -----
  it("https の URL から送出先を導く", () => {
    expect(toRepoSlug("https://github.com/owner/repo.git")).toBe("owner/repo");
  });

  it("ssh の短い綴りから送出先を導く", () => {
    expect(toRepoSlug("git@github.com:owner/repo.git")).toBe("owner/repo");
  });

  it("ssh:// の URL から送出先を導く", () => {
    expect(toRepoSlug("ssh://git@github.com/owner/repo")).toBe("owner/repo");
  });

  it("前後の空白を落とす", () => {
    expect(toRepoSlug("  https://github.com/owner/repo\n")).toBe("owner/repo");
  });

  // ----- 異常系 -----
  it("GitHub 以外のホストを送出先にしない", () => {
    expect(toRepoSlug("https://gitlab.com/owner/repo.git")).toBeNull();
    expect(toRepoSlug("git@github.example.com:owner/repo.git")).toBeNull();
  });

  it("owner/repo の 2 段でなければ送出先にしない", () => {
    expect(toRepoSlug("https://github.com/owner")).toBeNull();
    expect(toRepoSlug("https://github.com/owner/repo/extra")).toBeNull();
  });

  it("URL として読めない綴りを送出先にしない", () => {
    expect(toRepoSlug("")).toBeNull();
    expect(toRepoSlug("not a url")).toBeNull();
  });
});

describe("issueNumberFrom", () => {
  // ----- 正常系 -----
  it("URL の末尾を issue の番号として読む", () => {
    expect(issueNumberFrom("https://github.com/o/r/issues/581")).toBe(581);
  });

  // ----- 異常系 -----
  it("番号を読めなければ、落として先へ進まず例外で止める", () => {
    // 投稿は成っているので、番号を落とすと「立ったが索引に無い」窓が残り、次の週次が
    // 同じ窓をもう一度立てる。
    expect(() => issueNumberFrom("https://github.com/o/r/issues/")).toThrow(TypeError);
    expect(() => issueNumberFrom("まったく URL でない")).toThrow("番号を読めない");
  });
});
