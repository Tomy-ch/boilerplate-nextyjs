import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { ROOT_DIR } from "../lib/runtime";
import {
  dropOrphanedScriptSteps,
  MissingScriptStepError,
  ORPHANED_SCRIPT_STEPS,
} from "./package-scripts";

const PACKAGE_JSON = readFileSync(path.join(ROOT_DIR, "package.json"), "utf8");

describe("ORPHANED_SCRIPT_STEPS", () => {
  // ----- 正常系 -----
  it("宣言した段が実際の package.json に在る", () => {
    for (const { step } of ORPHANED_SCRIPT_STEPS) {
      expect(PACKAGE_JSON).toContain(step);
    }
  });

  it("実際の宣言から落とすと、呼び先の綴りが残らない", () => {
    const dropped = dropOrphanedScriptSteps(PACKAGE_JSON, ORPHANED_SCRIPT_STEPS);

    for (const { step } of ORPHANED_SCRIPT_STEPS) {
      expect(dropped).not.toContain(step);
    }
  });
});

describe("dropOrphanedScriptSteps", () => {
  // ----- 正常系 -----
  it("段を、その前の && ごと落とす", () => {
    const text = '"lint:md": "a && b && c"';

    expect(dropOrphanedScriptSteps(text, [{ script: "lint:md", step: "c" }])).toBe(
      '"lint:md": "a && b"',
    );
  });

  it("先頭の段は、後ろの && ごと落とす", () => {
    const text = '"lint:md": "a && b"';

    expect(dropOrphanedScriptSteps(text, [{ script: "lint:md", step: "a" }])).toBe(
      '"lint:md": "b"',
    );
  });

  it("段が 1 つだけなら、値を空にする", () => {
    const text = '"lint:md": "a"';

    expect(dropOrphanedScriptSteps(text, [{ script: "lint:md", step: "a" }])).toBe('"lint:md": ""');
  });

  // ----- 異常系 -----
  it("宣言した段が無ければ投げる", () => {
    expect(() => dropOrphanedScriptSteps("{}", [{ script: "lint:md", step: "x" }])).toThrow(
      MissingScriptStepError,
    );
  });
});
