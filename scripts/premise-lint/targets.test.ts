import { describe, expect, it } from "vitest";

import { EXCLUDED_PATHS, isScanned, SCANNED_PATHS } from "./targets";

describe("SCANNED_PATHS", () => {
  // ----- 正常系 -----
  it("残る側の文書を並べている", () => {
    expect(SCANNED_PATHS).toContain("docs/adr");
    expect(SCANNED_PATHS).toContain("docs/rules.md");
    expect(SCANNED_PATHS).toContain("src");
  });

  // ----- 異常系 -----
  it("捨てられる側を走査の対象にしない", () => {
    expect(SCANNED_PATHS).not.toContain("docs/get-started");
    expect(SCANNED_PATHS).not.toContain("README.md");
  });
});

describe("EXCLUDED_PATHS", () => {
  // ----- 正常系 -----
  it("除外に理由を持たせている", () => {
    for (const reason of Object.values(EXCLUDED_PATHS)) {
      expect(reason).not.toBe("");
    }
  });
});

describe("isScanned", () => {
  // ----- 正常系 -----
  it("残る文書を対象にする", () => {
    expect(isScanned("docs/adr/0011-no-docker.md")).toBe(true);
    expect(isScanned("docs/rules.md")).toBe(true);
    expect(isScanned("src/features/README.md")).toBe(true);
  });

  // ----- 異常系 -----
  it("Markdown でないものを対象にしない", () => {
    expect(isScanned("docs/adr/0011-no-docker.ts")).toBe(false);
  });

  it("除外したパスを対象にしない", () => {
    expect(isScanned("docs/adr/BACKLOG.md")).toBe(false);
    expect(isScanned("docs/plan/v1-implementation-plan.md")).toBe(false);
    expect(isScanned("docs/get-started/setup-repository.md")).toBe(false);
  });

  it("走査対象に入っていないパスを対象にしない", () => {
    expect(isScanned("README.md")).toBe(false);
    expect(isScanned(".github/README.md")).toBe(false);
  });
});
