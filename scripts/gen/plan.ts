import {
  CATALOG_HEADING_TITLE,
  type CatalogHeading,
  type ComponentLayer,
  componentDirectoryOf,
} from "../../src/components/scripts/check-shadcn";
import type { FeaturePlacement } from "./feature-placement";
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
      /** 足す画面。`features/<name>/<screen>/` を掘る。 */
      readonly placement: FeaturePlacement;
      /** 生成先の層が `architecture.ts` で import を許されている層。 */
      readonly importsAllowed: readonly string[];
      /** 生成先の層 README が宣言する契約。 */
      readonly contract: LayerContract;
      /**
       * README の扱い。feature が無ければテンプレートの写しを置き、既に在れば触らない。
       *
       * @remarks
       * 2 つ目の画面で README を書き直すと、人が育てた本文が消えます。`keep` のとき README は
       * 生成物に入りません。
       */
      readonly readme:
        | {
            readonly kind: "create";
            /** `feature-readme.md` の全文。README はこの写しとして出す。 */
            readonly template: string;
          }
        | { readonly kind: "keep" };
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

/** テンプレートが feature 名を受け取る placeholder。 */
const FEATURE_NAME_PLACEHOLDER = "<feature 名>";

/** テンプレート冒頭の frontmatter。本文とは別に扱う。 */
const TEMPLATE_FRONTMATTER = /^---\n[\s\S]*?\n---\n*/;

/**
 * feature の README。`feature-readme.md` の写しに、feature 名だけを入れて出す。
 *
 * @remarks
 * 節の構成はテンプレートが正で、ここでは持ちません。frontmatter だけはテンプレートの写しではなく、
 * `architecture.ts` と層 README から組みます —— 境界の宣言の正はそちらで、写しを持つと
 * 片方だけが動いたときに生成物が古い宣言を運びます。
 */
function featureReadme(
  input: Extract<GenerationInput, { kind: "feature" }>,
  template: string,
): string {
  const body = template.replace(TEMPLATE_FRONTMATTER, "");

  return `${frontmatter(input.importsAllowed, input.contract)}\n\n${body.replaceAll(
    FEATURE_NAME_PLACEHOLDER,
    input.name,
  )}`;
}

/** feature の置き場。README と画面ディレクトリの在り処は、計画と入口の存在判定がここを共有する。 */
export function featureLocation(
  name: string,
  screen: string,
): { readonly readme: string; readonly screenDirectory: string } {
  const directory = `src/features/${name}`;

  return { readme: `${directory}/README.md`, screenDirectory: `${directory}/${screen}` };
}

/** formatter が 1 行に許す幅。`biome.json` の `formatter.lineWidth` と同じ値。 */
const LINE_WIDTH = 100;

/**
 * `withScreenSpan` で包んだ export を、formatter が出す形で組む。
 *
 * @remarks
 * 呼び出しの 1 行目が幅に収まるなら最後の引数だけを開き、収まらなければ引数ごとに折る、という
 * formatter の規則は識別子と置き場の長さで結果が変わります。生成物を整形に掛けずに規約へ
 * 載せるため、同じ判定をここで行います。
 *
 * @param parameters - 描画関数の引数部。`({ title }: Props)` / `async ()` の形
 * @param body - 描画関数の本文。インデント無しの行の並び
 */
function screenSpanExport(
  symbol: string,
  spanName: string,
  parameters: string,
  body: readonly string[],
): string {
  const head = `export const ${symbol} = withScreenSpan(`;
  const hugged = `${head}"${spanName}", ${parameters} => {`;
  const indent = (depth: number) => body.map((line) => `${" ".repeat(depth)}${line}`).join("\n");

  if (hugged.length <= LINE_WIDTH) {
    return `${hugged}\n${indent(2)}\n});\n`;
  }

  return `${head}\n  "${spanName}",\n  ${parameters} => {\n${indent(4)}\n  },\n);\n`;
}

/**
 * 画面の表示（`view.tsx`）の雛形。
 *
 * @remarks
 * 取得を持たず、値を props で受けて組み立てるだけの形で出します。取得を `page-content` の側へ
 * 寄せておくと、画面が取る状態を取得なしで story とテストから出せます。
 */
function featureView(symbol: string, spanName: string, screen: string): string {
  return `import { withScreenSpan } from "@/observability/render-span";

/** \`${symbol}\` の props。 */
export type ${symbol}Props = {
  /** 見出しに表示する文言。 */
  readonly title: string;
};

/**
 * ${screen} の表示。
 *
 * @remarks
 * 取得を持ちません。\`page-content\` が取った値を props で受け、画面を組み立てるだけにします。
 *
 * TODO: 受け入れる関心と、受け入れない関心を README と揃えてから実装してください。
 */
${screenSpanExport(symbol, spanName, `({ title }: ${symbol}Props)`, [
  "return (",
  "  <section aria-label={title}>",
  "    <h2>{title}</h2>",
  "  </section>",
  ");",
])}`;
}

/** 画面の取得と組み立て（`page-content.tsx`）の雛形。 */
function featurePageContent(symbol: string, viewSymbol: string, spanName: string): string {
  return `import { withScreenSpan } from "@/observability/render-span";
import { ${viewSymbol} } from "./view";

/**
 * 取得と組み立て。
 *
 * @remarks
 * TODO: \`adapters\` から取得し、表示モデルへ写した値を \`${viewSymbol}\` へ渡してください。
 * 生成型（\`src/adapters/gen/\`）はここへ持ち込まないこと。
 */
${screenSpanExport(symbol, spanName, "async ()", [`return <${viewSymbol} title="見出し" />;`])}`;
}

/**
 * 画面まるごとの story。`title` は `Page/<feature>/<画面>` で、`components/README.md` の体系に従う。
 *
 * @remarks
 * route と同じ器で包むのは実装する人の仕事です。ここは読み幅の器と既定の 1 本、説明を書く場所
 * だけを出します。
 */
function featureStory(symbol: string, title: string): string {
  return `import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { ContentContainer } from "@/components/shell/content-container/content-container";

import { ${symbol} } from "./view";

const meta = {
  title: "${title}",
  component: ${symbol},
  parameters: {
    layout: "fullscreen",
    docs: {
      story: { inline: false, iframeHeight: 900 },
      description: {
        component:
          "TODO: この画面が何のためにあるかと、カタログで確かめられる範囲を書いてください。",
      },
    },
  },
  decorators: [
    // TODO: route の layout が置く shell と、page が置く見出し・読み幅をここで再現してください。
    (Story) => (
      <ContentContainer className="py-8">
        <Story />
      </ContentContainer>
    ),
  ],
  args: { title: "見出し" },
} satisfies Meta<typeof ${symbol}>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 既定の見え方。TODO: 画面が取る状態（loading / empty / error / success）ごとに story を足してください。 */
export const Default: Story = {};
`;
}

/** `page-content.tsx` に対応するテスト。取得の差し替えと組み立ての観点は scaffold-test へ渡す。 */
function featurePageContentTest(symbol: string): string {
  return `// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ${symbol} } from "./page-content";

describe("${symbol}", () => {
  // ----- 正常系 -----
  it("取得した値で画面を組み立てる", async () => {
    render(await ${symbol}());

    expect(screen.getByRole("heading", { name: "見出し" })).toBeVisible();
  });
});
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
 * 残るようにするためです。feature の README が既に在るときは、画面のディレクトリだけを返します。
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

  const { screen } = input.placement;
  const screenSymbol = toPascalCase(screen);
  const viewSymbol = `${screenSymbol}View`;
  const pageContentSymbol = `${screenSymbol}PageContent`;
  const { readme, screenDirectory } = featureLocation(input.name, screen);
  const spanPrefix = `features/${input.name}/${screen}`;

  return [
    ...(input.readme.kind === "create"
      ? [{ path: readme, content: featureReadme(input, input.readme.template) }]
      : []),
    {
      path: `${screenDirectory}/view.tsx`,
      content: featureView(viewSymbol, `${spanPrefix}/view`, screen),
    },
    {
      path: `${screenDirectory}/view.stories.tsx`,
      content: featureStory(viewSymbol, `Page/${symbol}/${screenSymbol}`),
    },
    { path: `${screenDirectory}/view.test.tsx`, content: componentTest(viewSymbol, "./view") },
    {
      path: `${screenDirectory}/page-content.tsx`,
      content: featurePageContent(pageContentSymbol, viewSymbol, `${spanPrefix}/page-content`),
    },
    {
      path: `${screenDirectory}/page-content.test.tsx`,
      content: featurePageContentTest(pageContentSymbol),
    },
  ];
}
