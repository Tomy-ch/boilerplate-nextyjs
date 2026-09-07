import { describe, expect, it } from "vitest";

import type { LayerContract } from "./layer-contract";
import { type GenerationInput, isGenerationKind, planGeneration } from "./plan";

const contract: LayerContract = {
  forbidden: ["features", "business-logic"],
  testRequirement: "feature",
};

const README_TEMPLATE = `# {{ComponentName}}

## 用途

{{この component を使う利用者上の目的を書く}}

## 役割と公開 component

| Component | 役割 |
| --- | --- |
| \`{{ComponentName}}\` | {{公開 API の役割を書く}} |

## 利用ケース

## 責務境界

## Storybook とテスト
`;

const FEATURE: GenerationInput = {
  kind: "feature",
  name: "report-detail",
  importsAllowed: ["model", "components"],
  contract,
};

const ADAPTER: GenerationInput = { kind: "adapter", name: "report-detail" };

function componentInput(
  placement: Extract<GenerationInput, { kind: "component" }>["placement"] = {
    layer: "design-system",
    as: "status",
  },
): GenerationInput {
  return { kind: "component", name: "report-detail", placement, readmeTemplate: README_TEMPLATE };
}

describe("isGenerationKind", () => {
  // ----- 正常系 -----
  it("生成できる 3 種類を受け付ける", () => {
    expect(isGenerationKind("feature")).toBe(true);
    expect(isGenerationKind("component")).toBe(true);
    expect(isGenerationKind("adapter")).toBe(true);
  });

  // ----- 異常系 -----
  it("一覧に無い語を拒む", () => {
    expect(isGenerationKind("store")).toBe(false);
  });
});

describe("planGeneration", () => {
  // ----- 正常系 -----
  it("feature を features 配下へ README・実装・テストの 3 ファイルで計画する", () => {
    expect(planGeneration(FEATURE).map((file) => file.path)).toEqual([
      "src/features/report-detail/README.md",
      "src/features/report-detail/report-detail.tsx",
      "src/features/report-detail/report-detail.test.tsx",
    ]);
  });

  it("component を README・実装・story・テストの 4 ファイルで計画する", () => {
    expect(planGeneration(componentInput()).map((file) => file.path)).toEqual([
      "src/components/design-system/status/report-detail/README.md",
      "src/components/design-system/status/report-detail/report-detail.tsx",
      "src/components/design-system/status/report-detail/report-detail.stories.tsx",
      "src/components/design-system/status/report-detail/report-detail.test.tsx",
    ]);
  });

  it("design-system 以外の層の component は、見出しの中間ディレクトリを持たない", () => {
    const files = planGeneration(componentInput({ layer: "patterns", as: "container" }));

    expect(files[0].path).toBe("src/components/patterns/report-detail/README.md");
  });

  it("adapter を server 配下へ実装とテストの 2 ファイルで計画する", () => {
    expect(planGeneration(ADAPTER).map((file) => file.path)).toEqual([
      "src/adapters/server/report-detail/report-detail.ts",
      "src/adapters/server/report-detail/report-detail.test.ts",
    ]);
  });

  it("feature の README の frontmatter へ層の契約をそのまま引き継ぐ", () => {
    const readme = planGeneration(FEATURE)[0].content;

    expect(readme).toContain("imports-allowed: [model, components]");
    expect(readme).toContain("forbidden: [features, business-logic]");
    expect(readme).toContain("test-requirement: feature");
  });

  it("feature の README が指す ADR への相対パスを、生成先の深さから組む", () => {
    const [readme] = planGeneration(FEATURE);

    expect(readme.path).toBe("src/features/report-detail/README.md");
    expect(readme.content).toContain("(../../../docs/adr/0090-testing-strategy.md)");
  });

  it("component の README はテンプレートの写しで、component 名だけを PascalCase で入れる", () => {
    const readme = planGeneration(componentInput())[0].content;

    expect(readme).toBe(README_TEMPLATE.replaceAll("{{ComponentName}}", "ReportDetail"));
    expect(readme).not.toContain("{{ComponentName}}");
    expect(readme).toContain("{{この component を使う利用者上の目的を書く}}");
  });

  it("component の README は frontmatter を持たない", () => {
    expect(planGeneration(componentInput())[0].content.startsWith("# ")).toBe(true);
  });

  it("component の story の title を、見出しの表示名と PascalCase の識別子で組む", () => {
    const story = planGeneration(componentInput({ layer: "patterns", as: "rich-text" }))[2];

    expect(story.path).toBe("src/components/patterns/report-detail/report-detail.stories.tsx");
    expect(story.content).toContain('title: "Rich Text/ReportDetail"');
    expect(story.content).toContain('import { ReportDetail } from "./report-detail"');
  });

  it("component の story に component の説明の置き場と既定の story を入れる", () => {
    const story = planGeneration(componentInput())[2].content;

    expect(story).toContain("parameters: {\n    docs: {\n      description: {\n        component:");
    expect(story).toContain("export const Default: Story = {};");
  });

  it("実装とテストの describe に PascalCase の識別子を使う", () => {
    const files = planGeneration(FEATURE);

    expect(files[1].content).toContain("export function ReportDetail(");
    expect(files[2].content).toContain('describe("ReportDetail"');
  });

  it("生成するテストへ観点の区切りを入れる", () => {
    expect(planGeneration(FEATURE)[2].content).toContain("// ----- 正常系 -----");
  });

  it("adapter の実装へ server-only の宣言を入れる", () => {
    expect(planGeneration(ADAPTER)[0].content).toContain('import "server-only"');
  });
});
