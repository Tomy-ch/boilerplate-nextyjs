import {
  CATALOG_HEADING_TITLE,
  type CatalogHeading,
  type ComponentLayer,
  componentDirectoryOf,
} from "../../src/components/scripts/check-shadcn";
import type { LayerContract } from "./layer-contract";
import { toPascalCase } from "./naming";

/**
 * 生成する雛形の計画を、書き出す前に 1 つの値として組み立てる。
 *
 * @remarks
 * 計画を先に確定させてから書くのは、途中で導出に失敗したときにファイルを half-written で
 * 残さないためです。ここは純粋関数で、ファイルシステムに触りません。
 */

/** 生成できる雛形の種類。 */
const GENERATION_KINDS = ["feature", "component", "adapter"] as const;

export type GenerationKind = (typeof GENERATION_KINDS)[number];

/** 書き出す 1 ファイル。 */
export type GeneratedFile = {
  /** リポジトリルート相対のパス。 */
  readonly path: string;
  readonly content: string;
};

/** component を置く層と、目録の見出し。`shadcn-manifest.yaml` の `layer` / `as` と同じ語彙。 */
export type ComponentPlacement = {
  readonly layer: ComponentLayer;
  readonly as: CatalogHeading;
};

/** 計画の入力。種類ごとに、雛形の導出に要るものだけを持つ。 */
export type GenerationInput =
  | {
      readonly kind: "feature";
      /** kebab-case の名前。 */
      readonly name: string;
      /** 生成先の層が `architecture.ts` で import を許されている層。 */
      readonly importsAllowed: readonly string[];
      /** 生成先の層 README が宣言する契約。 */
      readonly contract: LayerContract;
    }
  | {
      readonly kind: "component";
      readonly name: string;
      readonly placement: ComponentPlacement;
      /** `component-template.md` の全文。README はこの写しとして出す。 */
      readonly readmeTemplate: string;
    }
  | {
      readonly kind: "adapter";
      readonly name: string;
    };

/** 引数が生成できる種類かを判定する。 */
export function isGenerationKind(value: string): value is GenerationKind {
  return (GENERATION_KINDS as readonly string[]).includes(value);
}

/** 層 README の frontmatter を組み立てる。 */
function frontmatter(importsAllowed: readonly string[], contract: LayerContract): string {
  return [
    "---",
    `imports-allowed: [${importsAllowed.join(", ")}]`,
    `forbidden: [${contract.forbidden.join(", ")}]`,
    `test-requirement: ${contract.testRequirement}`,
    "---",
  ].join("\n");
}

/**
 * 生成先から、リポジトリの根までさかのぼる段数を組む。
 *
 * @remarks
 * 書き出す文字列の中の相対パスは、書き出す先を基準に組みます。段数を書き固めると、
 * 生成先の深さが変わったときにリンクが解決しません。
 */
function toRoot(directory: string): string {
  return "../".repeat(directory.split("/").length);
}

/** feature の README。層の必須節をすべて持つ。 */
function featureReadme(
  name: string,
  importsAllowed: readonly string[],
  contract: LayerContract,
  directory: string,
): string {
  return `${frontmatter(importsAllowed, contract)}

# ${name}

<!-- TODO: この feature が何のために在るかを 1 文で書いてください。 -->

## 受け入れるもの

<!-- TODO: ここが引き受ける関心を列挙してください。 -->

## 受け入れないもの

- ${contract.forbidden.join(" / ")}

## 構成

<!-- TODO: 公開する要素と、その責務を列挙してください。 -->

## 運用

- import してよい層は \`${importsAllowed.join(" / ")}\` です（\`architecture.ts\` が正）。
- テスト責務は \`${contract.testRequirement}\` です（[0090](${toRoot(directory)}docs/adr/0090-testing-strategy.md)）。
`;
}

/** テンプレートが component 名を受け取る placeholder。 */
const COMPONENT_NAME_PLACEHOLDER = "{{ComponentName}}";

/**
 * component の README。`component-template.md` の写しに、component 名だけを入れて出す。
 *
 * @remarks
 * 節の構成はテンプレートが正で、ここでは持ちません。名前以外の placeholder は、実装に合わせて
 * 具体化する人へそのまま渡します。
 */
function componentReadme(template: string, symbol: string): string {
  return template.replaceAll(COMPONENT_NAME_PLACEHOLDER, symbol);
}

/** React component の雛形。1 つの export に 1 つの describe が対応する形で出す。 */
function componentSource(symbol: string, label: string): string {
  return `type ${symbol}Props = {
  /** 見出しに表示する文言。 */
  readonly title: string;
};

/**
 * ${label}。
 *
 * @remarks
 * TODO: 受け入れる関心と、受け入れない関心を README と揃えてから実装してください。
 */
export function ${symbol}({ title }: ${symbol}Props) {
  return (
    <section aria-label={title}>
      <h2>{title}</h2>
    </section>
  );
}
`;
}

/**
 * component の story。`title` の先頭は目録の見出しで、`pnpm check:ui` が台帳の `as` と突き合わせる。
 *
 * @remarks
 * 部品自身が表現する状態へ canvas から届く story を揃えるのは実装する人の仕事です。ここは
 * 既定の 1 本と、説明を書く場所だけを出します。
 */
function componentStory(symbol: string, importPath: string, as: CatalogHeading): string {
  return `import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { ${symbol} } from "${importPath}";

const meta = {
  title: "${CATALOG_HEADING_TITLE[as]}/${symbol}",
  component: ${symbol},
  parameters: {
    docs: {
      description: {
        component:
          "TODO: この部品が何のためにあるかと、隣の似た部品との使い分けを書いてください。",
      },
    },
  },
  args: { title: "見出し" },
} satisfies Meta<typeof ${symbol}>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 既定の見え方。TODO: 部品が表現する状態ごとに story を足してください。 */
export const Default: Story = {};
`;
}

/** component の雛形に対応するテスト。骨格だけを出し、観点の詰めは scaffold-test へ渡す。 */
function componentTest(symbol: string, importPath: string): string {
  return `// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

import { ${symbol} } from "${importPath}";

describe("${symbol}", () => {
  // ----- 正常系 -----
  it("渡した文言を見出しと領域名に表示する", () => {
    render(<${symbol} title="見出し" />);

    expect(screen.getByRole("region", { name: "見出し" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "見出し" })).toBeVisible();
  });

  it("アクセシビリティ違反を持たない", async () => {
    const { container } = render(<${symbol} title="見出し" />);

    expect((await axe(container)).violations).toEqual([]);
  });
});
`;
}

/** adapter の雛形。外部接続の境界に置く 1 関数と、その正規化の口。 */
function adapterSource(symbol: string): string {
  return `import "server-only";

/**
 * TODO: 呼び出す契約と、返す正規化済みの型を書いてください。
 *
 * @remarks
 * 生成型（\`src/adapters/gen/\`）を上位層へ渡さないこと。この関数の戻り値は正規化済みの型に
 * 限り、生の status とエラーは errors カーネルの分類へ 1 度だけ写します。
 */
export function ${symbol}(input: { readonly keyword: string }): string {
  return input.keyword.trim();
}
`;
}

/** adapter の雛形に対応するテスト。 */
function adapterTest(symbol: string, importPath: string): string {
  return `import { describe, expect, it } from "vitest";

import { ${symbol} } from "${importPath}";

describe("${symbol}", () => {
  // ----- 正常系 -----
  it("前後の空白を落とした検索語を返す", () => {
    expect(${symbol}({ keyword: "  検索語  " })).toBe("検索語");
  });
});
`;
}

/**
 * 入力から、書き出すファイル一式を組み立てる。
 *
 * @remarks
 * 返す順序は書き出す順序です。README を先頭に置くのは、途中で失敗しても「何を作ろうとしたか」が
 * 残るようにするためです。
 */
export function planGeneration(input: GenerationInput): readonly GeneratedFile[] {
  const symbol = toPascalCase(input.name);
  const importPath = `./${input.name}`;

  if (input.kind === "adapter") {
    const directory = `src/adapters/server/${input.name}`;

    return [
      { path: `${directory}/${input.name}.ts`, content: adapterSource(symbol) },
      { path: `${directory}/${input.name}.test.ts`, content: adapterTest(symbol, importPath) },
    ];
  }

  if (input.kind === "component") {
    const { layer, as } = input.placement;
    const directory = componentDirectoryOf(layer, as, input.name);

    return [
      { path: `${directory}/README.md`, content: componentReadme(input.readmeTemplate, symbol) },
      {
        path: `${directory}/${input.name}.tsx`,
        content: componentSource(symbol, `${input.name} の表示部品`),
      },
      {
        path: `${directory}/${input.name}.stories.tsx`,
        content: componentStory(symbol, importPath, as),
      },
      { path: `${directory}/${input.name}.test.tsx`, content: componentTest(symbol, importPath) },
    ];
  }

  const directory = `src/features/${input.name}`;

  return [
    {
      path: `${directory}/README.md`,
      content: featureReadme(input.name, input.importsAllowed, input.contract, directory),
    },
    {
      path: `${directory}/${input.name}.tsx`,
      content: componentSource(symbol, `${input.name} の画面スライス`),
    },
    { path: `${directory}/${input.name}.test.tsx`, content: componentTest(symbol, importPath) },
  ];
}
