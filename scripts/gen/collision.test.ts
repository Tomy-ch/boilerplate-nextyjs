import { describe, expect, it } from "vitest";

import { collisionsOf } from "./collision";
import type { LayerContract } from "./layer-contract";
import { type GenerationInput, planGeneration } from "./plan";

const contract: LayerContract = { forbidden: ["features"], testRequirement: "feature" };

function featureInput(readme: Extract<GenerationInput, { kind: "feature" }>["readme"]) {
  return {
    kind: "feature",
    name: "report-detail",
    placement: { screen: "list" },
    importsAllowed: ["model"],
    contract,
    readme,
  } as const satisfies GenerationInput;
}

const FIRST_SCREEN = featureInput({ kind: "create", template: "# <feature 名>\n" });
const SECOND_SCREEN = featureInput({ kind: "keep" });
const ADAPTER: GenerationInput = { kind: "adapter", name: "report-detail" };

/** 挙げたパスだけが在る作業ツリー。 */
function treeWith(...paths: readonly string[]): (path: string) => boolean {
  return (path) => paths.includes(path);
}

describe("collisionsOf", () => {
  // ----- 正常系 -----
  it("feature が無ければ、README ごと書き出してよい", () => {
    expect(collisionsOf(FIRST_SCREEN, planGeneration(FIRST_SCREEN), treeWith())).toEqual([]);
  });

  it("README が既に在る feature へ別の画面を足すのは衝突にならない", () => {
    const tree = treeWith(
      "src/features/report-detail/README.md",
      "src/features/report-detail/detail",
      "src/features/report-detail/detail/view.tsx",
    );

    expect(collisionsOf(SECOND_SCREEN, planGeneration(SECOND_SCREEN), tree)).toEqual([]);
  });

  // ----- 異常系 -----
  it("同じ画面を再実行すると、画面ディレクトリを挙げて止める", () => {
    const tree = treeWith(
      "src/features/report-detail/README.md",
      "src/features/report-detail/list",
      "src/features/report-detail/list/view.tsx",
    );

    expect(collisionsOf(SECOND_SCREEN, planGeneration(SECOND_SCREEN), tree)).toEqual([
      "src/features/report-detail/list/",
    ]);
  });

  it("画面ディレクトリは、生成物と同名のファイルが無くても在るだけで止める", () => {
    const tree = treeWith("src/features/report-detail/list");

    expect(collisionsOf(FIRST_SCREEN, planGeneration(FIRST_SCREEN), tree)).toEqual([
      "src/features/report-detail/list/",
    ]);
  });

  it("feature 以外は、生成物と同じパスが在れば止める", () => {
    const files = planGeneration(ADAPTER);
    const testPath = "src/adapters/server/report-detail/report-detail.test.ts";

    expect(files.map((file) => file.path)).toContain(testPath);
    expect(collisionsOf(ADAPTER, files, treeWith(testPath))).toEqual([testPath]);
  });
});
