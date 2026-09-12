import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { parseDeclaration } from "../../egress/declaration";
import { dropOrphanedEndpoints, ORPHANED_WORKFLOWS } from "./egress";
import { EGRESS_DECLARATION_FILE } from "./manifest";

const DECLARATION = [
  "baseline:",
  "  - github.com:443",
  "workflows:",
  "  vrt:",
  "    - mcr.microsoft.com:443",
  "  strip-verify:",
  "    - fonts.googleapis.com:443",
  "audit:",
  "  sonarcloud: 宛先を実測できていない",
  "",
].join("\n");

describe("ORPHANED_WORKFLOWS", () => {
  // ----- 正常系 -----
  it("剥がしが消す workflow の名前を並べる", () => {
    expect(ORPHANED_WORKFLOWS).toContain("strip-verify");
    expect(ORPHANED_WORKFLOWS).toContain("sonarcloud");
    expect(ORPHANED_WORKFLOWS).toContain("dependency-review");
  });

  it("実際の宣言を剥がすと、孤児が 1 つも残らない", () => {
    const stripped = dropOrphanedEndpoints(
      readFileSync(EGRESS_DECLARATION_FILE, "utf8"),
      ORPHANED_WORKFLOWS,
    );
    const declaration = parseDeclaration(stripped);
    const keys = [...Object.keys(declaration.workflows), ...Object.keys(declaration.audit)];

    expect(keys.filter((key) => ORPHANED_WORKFLOWS.includes(key))).toEqual([]);
  });
});

describe("dropOrphanedEndpoints", () => {
  // ----- 正常系 -----
  it("固有分の塊を、続きの行ごと落とす", () => {
    const out = dropOrphanedEndpoints(DECLARATION, ["strip-verify"]);

    expect(out).not.toContain("strip-verify");
    expect(out).not.toContain("fonts.googleapis.com");
  });

  it("監査のままの宣言も落とす", () => {
    expect(dropOrphanedEndpoints(DECLARATION, ["sonarcloud"])).not.toContain("sonarcloud");
  });

  it("残す塊には手を付けない", () => {
    const out = dropOrphanedEndpoints(DECLARATION, ["strip-verify"]);

    expect(out).toContain("  vrt:\n    - mcr.microsoft.com:443");
    expect(out).toContain("baseline:\n  - github.com:443");
  });

  it("落とした後も宣言として読める", () => {
    const declaration = parseDeclaration(dropOrphanedEndpoints(DECLARATION, ORPHANED_WORKFLOWS));

    expect(Object.keys(declaration.workflows)).toEqual(["vrt"]);
    expect(declaration.audit).toEqual({});
  });

  it("塊の途中に空行があっても最後まで落とす", () => {
    const spaced =
      "workflows:\n  vrt:\n    - a.example:443\n\n    - b.example:443\n  lint:\n    - c.example:443\n";
    const out = dropOrphanedEndpoints(spaced, ["vrt"]);

    expect(out).not.toContain("a.example");
    expect(out).not.toContain("b.example");
    expect(out).toContain("c.example");
  });

  // ----- 異常系 -----
  it("落とす相手が居なければ元のまま返す", () => {
    expect(dropOrphanedEndpoints(DECLARATION, ["不在"])).toBe(DECLARATION);
  });

  it("名前が部分的に一致するだけの塊は落とさない", () => {
    const similar = "workflows:\n  vrt-guard:\n    - a.example:443\n";

    expect(dropOrphanedEndpoints(similar, ["vrt"])).toBe(similar);
  });
});
