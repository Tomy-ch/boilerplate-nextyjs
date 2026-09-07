import type { Rule } from "eslint";

/**
 * 太さの utility を直に書かせないルール。
 *
 * 規約そのものは `src/components/README.md`「文字の太さ」が持つ。Biome は class 文字列の中身を
 * 見ないため ESLint 側で持つ。
 *
 * **文字列リテラルだけを見る。** class は文字列としてしか書けないので、これで書かれた分は必ず拾える。
 * 式で組んだ class は解決先が分からないため見送る（`no-internal-anchor` と同じ線引き）。
 *
 * test と story は対象外。除外は `eslint.config.ts` の `ignores` が持ち、理由もそこにある。
 */

/**
 * 直に書かせない utility。
 *
 * **`font-normal` は含めません。** あれは「強調しない」を明示する打ち消しで、400 はどの書体も
 * 持つため丸められません。禁じたいのは**本文より強い段を数値で指定すること**だけです。
 */
const RAW_WEIGHT = /\bfont-(thin|extralight|light|medium|semibold|bold|extrabold|black)\b/;

const noRawFontWeight: Rule.RuleModule = {
  meta: {
    type: "problem",
    docs: {
      description: "強調は font-emphasis で書く",
    },
    schema: [],
    messages: {
      noRawFontWeight:
        "太さを直に指定しないでください（{{ utility }}）。強調は font-emphasis を使います。書体が持たない段は丸められ、強調になりません。",
    },
  },
  create(context) {
    function check(node: Rule.Node, value: unknown): void {
      if (typeof value !== "string") {
        return;
      }

      const found = RAW_WEIGHT.exec(value);

      if (found !== null) {
        context.report({ node, messageId: "noRawFontWeight", data: { utility: found[0] } });
      }
    }

    return {
      Literal(node) {
        check(node, node.value);
      },
      TemplateElement(node) {
        check(node as unknown as Rule.Node, node.value.cooked);
      },
    };
  },
};

export default noRawFontWeight;
