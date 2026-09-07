import { readFileSync } from "node:fs";
import { resolve } from "node:path";

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

const FEATURE_README_TEMPLATE = `---
imports-allowed: [model, components, adapters]
forbidden: [features]
test-requirement: feature
---

# <feature 名>

<!-- 必須節。
required-sections:
  - 受け入れるもの
  - Route と契約
-->

## 受け入れるもの

## Route と契約

| Route | 仕様書 | 認証 |
| --- | --- | --- |
| \`<例: /items>\` | \`<link>\` | \`<不要>\` |
`;

/** 実物のテンプレート。生成器が読む入力そのもの。 */
const REAL_FEATURE_README_TEMPLATE = readFileSync(
  resolve(import.meta.dirname, "..", "..", "docs", "templates", "feature-readme.md"),
  "utf8",
);

function featureInput({
  name = "report-detail",
  screen = "list",
  readmeTemplate = FEATURE_README_TEMPLATE,
}: { name?: string; screen?: string; readmeTemplate?: string } = {}): GenerationInput {
  return {
    kind: "feature",
    name,
    placement: { screen },
    importsAllowed: ["model", "components"],
    contract,
    readmeTemplate,
  };
}

const ADAPTER: GenerationInput = { kind: "adapter", name: "report-detail" };

function componentInput(
  placement: Extract<GenerationInput, { kind: "component" }>["placement"] = {
    layer: "design-system",
    as: "status",
  },
): GenerationInput {
  return { kind: "component", name: "report-detail", placement, readmeTemplate: README_TEMPLATE };
}

/** テンプレート冒頭のコメントが宣言する必須節。 */
function requiredSectionsOf(template: string): string[] {
  const declared = /required-sections:\n((?: {2}- .+\n)+)/.exec(template);

  return declared === null
    ? []
    : declared[1]
        .split("\n")
        .filter((line) => line !== "")
        .map((line) => line.replace(/^ {2}- /, ""));
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
  it("feature を README と、画面ディレクトリの view・story・page-content とそのテストで計画する", () => {
    expect(planGeneration(featureInput()).map((file) => file.path)).toEqual([
      "src/features/report-detail/README.md",
      "src/features/report-detail/list/view.tsx",
      "src/features/report-detail/list/view.stories.tsx",
      "src/features/report-detail/list/view.test.tsx",
      "src/features/report-detail/list/page-content.tsx",
      "src/features/report-detail/list/page-content.test.tsx",
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

  it("feature の README はテンプレートの写しで、feature 名だけを入れる", () => {
    const readme = planGeneration(featureInput())[0].content;

    expect(readme).toContain("# report-detail\n");
    expect(readme).not.toContain("<feature 名>");
    expect(readme).toContain("| `<例: /items>` | `<link>` | `<不要>` |");
  });

  it("feature の README の frontmatter は、テンプレートの写しではなく層の契約から組む", () => {
    const readme = planGeneration(featureInput())[0].content;

    expect(readme.startsWith("---\n")).toBe(true);
    expect(readme).toContain("imports-allowed: [model, components]\n");
    expect(readme).not.toContain("imports-allowed: [model, components, adapters]");
    expect(readme).toContain("forbidden: [features, business-logic]\n");
    expect(readme).toContain("test-requirement: feature\n---\n\n# report-detail");
    expect(readme.match(/^---$/gm)).toHaveLength(2);
  });

  it("frontmatter を持たないテンプレートにも、層の契約の frontmatter を付ける", () => {
    const readme = planGeneration(featureInput({ readmeTemplate: "# <feature 名>\n" }))[0].content;

    expect(readme).toBe(
      "---\nimports-allowed: [model, components]\nforbidden: [features, business-logic]\ntest-requirement: feature\n---\n\n# report-detail\n",
    );
  });

  it("実物のテンプレートを写すと、宣言された必須節の見出しをすべて持つ", () => {
    const sections = requiredSectionsOf(REAL_FEATURE_README_TEMPLATE);
    const readme = planGeneration(
      featureInput({ readmeTemplate: REAL_FEATURE_README_TEMPLATE }),
    )[0].content;

    expect(sections.length).toBeGreaterThan(0);

    for (const section of sections) {
      expect(readme).toContain(`\n## ${section}\n`);
    }

    expect(readme).not.toContain("<feature 名>");
  });

  it("feature の view と page-content を、画面名の識別子と置き場と一致する span 名で出す", () => {
    const [, view, , , pageContent] = planGeneration(featureInput());

    expect(view.content).toContain("export const ListView = withScreenSpan(");
    expect(view.content).toContain('"features/report-detail/list/view"');
    expect(view.content).toContain("export type ListViewProps = {");
    expect(pageContent.content).toContain("export const ListPageContent = withScreenSpan(");
    expect(pageContent.content).toContain('"features/report-detail/list/page-content"');
    expect(pageContent.content).toContain('import { ListView } from "./view"');
  });

  it("呼び出しの 1 行目が 100 桁に収まるなら、最後の引数だけを開いた形で出す", () => {
    const [, view, , , pageContent] = planGeneration(featureInput({ name: "abc-def" }));

    expect(view.content).toContain(
      [
        'export const ListView = withScreenSpan("features/abc-def/list/view", ({ title }: ListViewProps) => {',
        "  return (",
        '    <section aria-label={title}>',
        "      <h2>{title}</h2>",
        "    </section>",
        "  );",
        "});",
      ].join("\n"),
    );
    expect(pageContent.content).toContain(
      'export const ListPageContent = withScreenSpan("features/abc-def/list/page-content", async () => {\n  return <ListView title="見出し" />;\n});',
    );
  });

  it("1 行目がちょうど 100 桁なら開いた形、101 桁なら折った形で出す", () => {
    const hugged = planGeneration(featureInput({ name: "abc-def" }))[1].content;
    const broken = planGeneration(featureInput({ name: "abcd-efg" }))[1].content;

    expect(hugged).toContain(
      'export const ListView = withScreenSpan("features/abc-def/list/view", ({ title }: ListViewProps) => {\n',
    );
    expect(broken).toContain(
      'export const ListView = withScreenSpan(\n  "features/abcd-efg/list/view",\n  ({ title }: ListViewProps) => {\n',
    );
  });

  it("呼び出しの 1 行目が 100 桁を超えるなら、引数ごとに折った形で出す", () => {
    const [, view, , , pageContent] = planGeneration(featureInput({ name: "abcd-efgh-ijkl" }));

    expect(view.content).toContain(
      [
        "export const ListView = withScreenSpan(",
        '  "features/abcd-efgh-ijkl/list/view",',
        "  ({ title }: ListViewProps) => {",
        "    return (",
        "      <section aria-label={title}>",
        "        <h2>{title}</h2>",
        "      </section>",
        "    );",
        "  },",
        ");",
      ].join("\n"),
    );
    expect(pageContent.content).toContain(
      'export const ListPageContent = withScreenSpan(\n  "features/abcd-efgh-ijkl/list/page-content",\n  async () => {\n    return <ListView title="見出し" />;\n  },\n);',
    );
  });

  it("feature の view は取得を持たず、page-content が view を組み立てる", () => {
    const [, view, , , pageContent] = planGeneration(featureInput());

    expect(view.content).not.toContain("@/adapters");
    expect(pageContent.content).toContain("async () => {");
    expect(pageContent.content).toContain('<ListView title="見出し" />');
  });

  it("feature の story の title を Page/<feature>/<画面> で組み、view を指す", () => {
    const story = planGeneration(featureInput())[2];

    expect(story.path).toBe("src/features/report-detail/list/view.stories.tsx");
    expect(story.content).toContain('title: "Page/ReportDetail/List"');
    expect(story.content).toContain('import { ListView } from "./view"');
    expect(story.content).toContain("component: ListView,");
  });

  it("feature の story に読み幅の器と説明の置き場、既定の story を入れる", () => {
    const story = planGeneration(featureInput())[2].content;

    expect(story).toContain("<ContentContainer className=\"py-8\">");
    expect(story).toContain("parameters: {\n    layout: \"fullscreen\",\n    docs: {");
    expect(story).toContain("description: {\n        component:");
    expect(story).toContain("export const Default: Story = {};");
  });

  it("feature のテストの describe に、view と page-content の識別子を使う", () => {
    const [, , , viewTest, , pageContentTest] = planGeneration(featureInput());

    expect(viewTest.content).toContain('describe("ListView"');
    expect(viewTest.content).toContain('import { ListView } from "./view"');
    expect(pageContentTest.content).toContain('describe("ListPageContent"');
    expect(pageContentTest.content).toContain("render(await ListPageContent());");
  });

  it("feature の README・story・テストに同梱サンプルの語彙を入れない", () => {
    const contents = planGeneration(featureInput()).map((file) => file.content);

    for (const content of contents) {
      expect(content).not.toMatch(/商品|カート|注文|在庫|購入|決済/);
    }
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

  it("component の実装とテストの describe に PascalCase の識別子を使う", () => {
    const files = planGeneration(componentInput());

    expect(files[1].content).toContain("export function ReportDetail(");
    expect(files[3].content).toContain('describe("ReportDetail"');
  });

  it("生成するテストへ観点の区切りを入れる", () => {
    for (const file of planGeneration(featureInput())) {
      if (file.path.endsWith(".test.tsx")) {
        expect(file.content).toContain("// ----- 正常系 -----");
      }
    }
  });

  it("adapter の実装へ server-only の宣言を入れる", () => {
    expect(planGeneration(ADAPTER)[0].content).toContain('import "server-only"');
  });
});
