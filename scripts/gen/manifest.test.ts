import { describe, expect, it } from "vitest";
import { parse } from "yaml";

import { componentManifestEntry, isRecorded, recordComponent } from "./manifest";

const ADDED_AT = "2026-09-07T00:00:00.000Z";

const MANIFEST = `# 台帳の説明。
schemaVersion: 1
components:
  # この行の判断の経緯。
  action-bar:
    kind: original
    layer: patterns
    as: container
    directory: src/components/patterns/action-bar
    addedAt: 2026-08-12T14:30:00.000Z
`;

describe("componentManifestEntry", () => {
  // ----- 正常系 -----
  it("上流を持たない行を、層と見出しから導いた directory で組む", () => {
    expect(
      componentManifestEntry("report-detail", { layer: "design-system", as: "status" }, ADDED_AT),
    ).toEqual({
      kind: "original",
      layer: "design-system",
      as: "status",
      directory: "src/components/design-system/status/report-detail",
      addedAt: ADDED_AT,
    });
  });

  it("design-system 以外の層では見出しを directory に含めない", () => {
    expect(
      componentManifestEntry("report-detail", { layer: "patterns", as: "container" }, ADDED_AT)
        .directory,
    ).toBe("src/components/patterns/report-detail");
  });
});

describe("isRecorded", () => {
  // ----- 正常系 -----
  it("同じ key の行が在れば真を返す", () => {
    expect(isRecorded(MANIFEST, "action-bar")).toBe(true);
  });

  it("行が無ければ偽を返す", () => {
    expect(isRecorded(MANIFEST, "report-detail")).toBe(false);
  });
});

describe("recordComponent", () => {
  const entry = componentManifestEntry(
    "report-detail",
    { layer: "design-system", as: "status" },
    ADDED_AT,
  );

  // ----- 正常系 -----
  it("既存の行とコメントを残したまま、末尾へ 1 行足す", () => {
    const recorded = recordComponent(MANIFEST, "report-detail", entry);

    expect(recorded).toContain("# 台帳の説明。");
    expect(recorded).toContain("# この行の判断の経緯。");
    expect(parse(recorded)).toEqual({
      schemaVersion: 1,
      components: {
        "action-bar": {
          kind: "original",
          layer: "patterns",
          as: "container",
          directory: "src/components/patterns/action-bar",
          addedAt: "2026-08-12T14:30:00.000Z",
        },
        "report-detail": entry,
      },
    });
    expect(recorded.indexOf("action-bar:")).toBeLessThan(recorded.indexOf("report-detail:"));
  });

  it("空の台帳が flow 形式でも、足した行を block 形式で書く", () => {
    const recorded = recordComponent("schemaVersion: 1\ncomponents: {}\n", "report-detail", entry);

    expect(recorded).toContain("\n  report-detail:\n    kind: original\n");
  });
});
