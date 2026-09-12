import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { parseDeclaration } from "../../egress/declaration";
import { dropOrphanedEndpoints } from "../lib/egress-declaration";
import { ORPHANED_WORKFLOWS } from "./egress";
import { EGRESS_DECLARATION_FILE } from "./manifest";

describe("ORPHANED_WORKFLOWS", () => {
  // ----- 正常系 -----
  it("剥がしが消す workflow の名前を並べる", () => {
    expect(ORPHANED_WORKFLOWS).toContain("strip-verify");
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
