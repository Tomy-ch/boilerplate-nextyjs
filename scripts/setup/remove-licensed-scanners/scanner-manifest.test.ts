import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { ROOT_DIR } from "../lib/runtime";
import { SCANNER_DOMAINS } from "./scanner-manifest";

const exists = (relativePath: string): boolean => fs.existsSync(path.join(ROOT_DIR, relativePath));

describe("SCANNER_DOMAINS", () => {
  // ----- 正常系 -----
  it("資格情報を要する 3 つの製品を並べる", () => {
    expect(SCANNER_DOMAINS.map((domain) => domain.key)).toEqual([
      "sonarcloud",
      "codeql",
      "dependency-review",
    ]);
  });

  it("宣言したパスがすべて実在する", () => {
    const missing = SCANNER_DOMAINS.flatMap((domain) => domain.paths).filter(
      (target) => !exists(target),
    );

    expect(missing).toEqual([]);
  });

  it("在否の目印を、自分の削除対象の中から採る", () => {
    for (const domain of SCANNER_DOMAINS) {
      expect(domain.paths).toContain(domain.presenceMarker);
    }
  });

  it("コミット件名が prefix を持つ", () => {
    for (const domain of SCANNER_DOMAINS) {
      expect(domain.commitSubject).toMatch(/^[A-Z][a-z]+: /);
    }
  });

  it("宛先の宣言が実在する workflow のキーを指す", () => {
    const declaration = fs.readFileSync(path.join(ROOT_DIR, ".github/egress.yaml"), "utf8");

    for (const domain of SCANNER_DOMAINS) {
      for (const job of domain.egressJobs) {
        expect(declaration).toContain(`  ${job}:`);
      }
    }
  });

  // ----- 異常系 -----
  it("名前を探す文書が空でない", () => {
    for (const domain of SCANNER_DOMAINS) {
      expect(domain.docMentions.length).toBeGreaterThan(0);
      expect(domain.mentionPatterns.length).toBeGreaterThan(0);
    }
  });
});
