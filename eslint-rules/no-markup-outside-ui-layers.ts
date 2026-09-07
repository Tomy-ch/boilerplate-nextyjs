import { relative } from "node:path";

import type { Rule } from "eslint";

import { UI_KERNELS } from "../architecture";

/**
 * UI を置いてよい層の外で DOM マークアップを書かせないルール。
 *
 * 置いてよい層は [`architecture.ts`](../architecture.ts) の `UI_KERNELS` が持ち、規約は
 * `docs/rules.md`「層境界と依存」にある。`eslint-plugin-boundaries` は import の向きしか見ない
 * ため、層の中で完結するマークアップは境界検査を素通りする。Biome にも同等の検査は無い。
 *
 * **見るのは host 要素だけである。** 禁じられているのは「UI マークアップ」であって JSX ではない。
 * `capabilities` が Provider を export することも、それを shell が mount することも許されており、
 * React 19 では Provider も JSX である。
 *
 * テストは対象外にする。hook を回すのに wrapper を描くことがあり、それは層の担う UI ではない。
 *
 * 報告はファイルにつき 1 件に留める。指摘は要素ではなく置き場に対するものである。
 */
const UI_LAYERS: readonly string[] = UI_KERNELS;

/**
 * 層名を取り出す。層の外なら `undefined`。
 *
 * 起点からの相対で見る。`docs-viewer/src/` のようにワークスペースの中にも `src/` があり、
 * ファイル名のどこかで `src/` に一致させると、そちらの直下も層として数えてしまう。
 */
function layerOf(filename: string, cwd: string): string | undefined {
  return /^src\/([^/]+)\//.exec(relative(cwd, filename).replaceAll("\\", "/"))?.[1];
}

/** テストか。 */
function isTest(filename: string): boolean {
  return /\.test\.[cm]?[jt]sx?$/.test(filename);
}

const noMarkupOutsideUiLayers: Rule.RuleModule = {
  meta: {
    type: "problem",
    docs: {
      description: "UI を置いてよい層の外で DOM マークアップを書かない",
    },
    schema: [],
    messages: {
      noMarkupOutsideUiLayers:
        "{{layer}} は UI を持ちません。`{{element}}` の描画は {{allowed}} のいずれかへ置いてください。",
    },
  },
  create(context) {
    const layer = layerOf(context.filename, context.cwd);

    if (layer === undefined || UI_LAYERS.includes(layer) || isTest(context.filename)) {
      return {};
    }

    let reported = false;

    return {
      JSXOpeningElement(node) {
        // JSX の慣習どおり、小文字始まりを host 要素、それ以外を component として扱う。
        if (reported || node.name.type !== "JSXIdentifier" || !/^[a-z]/.test(node.name.name)) {
          return;
        }

        reported = true;
        context.report({
          node,
          messageId: "noMarkupOutsideUiLayers",
          data: { layer, element: node.name.name, allowed: UI_LAYERS.join(" / ") },
        });
      },
    };
  },
};

export default noMarkupOutsideUiLayers;
