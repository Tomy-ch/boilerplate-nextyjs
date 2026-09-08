import { describe, expect, it } from "vitest";

import { toRepoSlug } from "./remote";

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
