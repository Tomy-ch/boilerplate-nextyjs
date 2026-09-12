import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import commitlint from "../../../commitlint.config";
import { ROOT_DIR } from "../lib/runtime";
import { SCANNER_DOMAINS } from "./scanner-manifest";

const exists = (relativePath: string): boolean => fs.existsSync(path.join(ROOT_DIR, relativePath));

const read = (relativePath: string): string =>
  fs.readFileSync(path.join(ROOT_DIR, relativePath), "utf8");

describe("SCANNER_DOMAINS", () => {
  // ----- 正常系 -----
  it("資格情報を要する 3 つの製品を並べる", () => {
    expect(SCANNER_DOMAINS.map((domain) => domain.key)).toEqual([
      "sonarcloud",
      "dependency-review",
      "codeql",
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

  it("コミット件名の prefix が、commitlint の enum に在る", () => {
    const rule = commitlint.rules?.["type-enum"] as [unknown, unknown, string[]] | undefined;
    const allowed = rule?.[2] ?? [];

    expect(allowed.length).toBeGreaterThan(0);

    for (const domain of SCANNER_DOMAINS) {
      expect(allowed).toContain(domain.commitSubject.split(":")[0]);
    }
  });

  it("コミット件名が句点で終わらない", () => {
    for (const domain of SCANNER_DOMAINS) {
      expect(domain.commitSubject.endsWith("。")).toBe(false);
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

  it("宣言した塊が、現物に完全一致で在る", () => {
    for (const domain of SCANNER_DOMAINS) {
      for (const { file, block } of domain.docBlocks) {
        expect(read(file), `${file}: ${block.trim().slice(0, 50)}`).toContain(block);
      }
    }
  });

  it("宣言した語句が、現物に完全一致で在る", () => {
    for (const domain of SCANNER_DOMAINS) {
      for (const { file, fragment } of domain.docFragments) {
        expect(read(file), `${file}: ${fragment.slice(0, 50)}`).toContain(fragment);
      }
    }
  });

  it("宣言した見出しが、現物に在る", () => {
    for (const domain of SCANNER_DOMAINS) {
      for (const { file, heading } of domain.docSections) {
        expect(read(file).split("\n"), `${file}: ${heading}`).toContain(heading);
      }
    }
  });

  it("共有の散文を畳む CodeQL を最後に置く", () => {
    expect(SCANNER_DOMAINS.at(-1)?.key).toBe("codeql");
  });

  // ----- 異常系 -----
  it("名前を探す文書が空でない", () => {
    for (const domain of SCANNER_DOMAINS) {
      expect(domain.docMentions.length).toBeGreaterThan(0);
      expect(domain.mentionPatterns.length).toBeGreaterThan(0);
    }
  });
});
