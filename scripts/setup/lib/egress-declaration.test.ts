import { describe, expect, it } from "vitest";

import { parseDeclaration } from "../../egress/declaration";
import { dropOrphanedEndpoints } from "./egress-declaration";

const DECLARATION = [
  "baseline:",
  "  - github.com:443",
  "workflows:",
  "  vrt:",
  "    - mcr.microsoft.com:443",
  "  strip-verify:",
  "    - fonts.googleapis.com:443",
  "audit:",
  "  strip-verify: 宛先を実測できていない",
  "  notify: 宛先を実測できていない",
  "",
].join("\n");

describe("dropOrphanedEndpoints", () => {
  // ----- 正常系 -----
  it("固有分の塊を、続きの行ごと落とす", () => {
    const out = dropOrphanedEndpoints(DECLARATION, ["strip-verify"]);

    expect(out).not.toContain("strip-verify");
    expect(out).not.toContain("fonts.googleapis.com");
  });

  it("監査のままの宣言も落とす", () => {
    const out = dropOrphanedEndpoints(DECLARATION, ["strip-verify"]);

    expect(out).toContain("audit:\n  notify: 宛先を実測できていない");
    expect(out).not.toContain("  strip-verify: 宛先を実測できていない");
  });

  it("残す塊には手を付けない", () => {
    const out = dropOrphanedEndpoints(DECLARATION, ["strip-verify"]);

    expect(out).toContain("  vrt:\n    - mcr.microsoft.com:443");
    expect(out).toContain("baseline:\n  - github.com:443");
  });

  it("落とした後も宣言として読める", () => {
    const declaration = parseDeclaration(dropOrphanedEndpoints(DECLARATION, ["strip-verify"]));

    expect(Object.keys(declaration.workflows)).toEqual(["vrt"]);
    expect(declaration.audit).toEqual({ notify: "宛先を実測できていない" });
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
