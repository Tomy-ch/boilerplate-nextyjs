import type { Rule } from "eslint";

/**
 * 内部リンクに生の `<a href="/...">` を使わせないルール。
 *
 * `next/link` を通さない内部遷移はクライアント遷移とプリフェッチを失い、フルリロードになる。
 * Biome には同等の検査が無いため ESLint 側で持つ。
 *
 * 判定は静的に読める `href` に限る。JSX 属性のリテラル値は文字列しか取らないため、`/` 始まりの
 * リテラルだけが内部リンクとして確定できる。式で組んだ `href` は解決先が分からないので見送る。
 */
const noInternalAnchor: Rule.RuleModule = {
  meta: {
    type: "problem",
    docs: {
      description: "内部リンクには next/link を使う",
    },
    schema: [],
    messages: {
      noInternalAnchor: "内部リンクには <a> ではなく next/link を使ってください。",
    },
  },
  create(context) {
    return {
      JSXOpeningElement(node) {
        if (node.name.type !== "JSXIdentifier" || node.name.name !== "a") {
          return;
        }

        for (const attribute of node.attributes) {
          if (attribute.type !== "JSXAttribute" || attribute.name.type !== "JSXIdentifier") {
            continue;
          }

          if (attribute.name.name !== "href") {
            continue;
          }

          if (attribute.value?.type !== "Literal") {
            return;
          }

          if (!String(attribute.value.value).startsWith("/")) {
            return;
          }

          context.report({ node, messageId: "noInternalAnchor" });

          return;
        }
      },
    };
  },
};

export default noInternalAnchor;
