import type { Rule } from "eslint";

/**
 * 名前を持たない default export を禁じるルール。
 *
 * default export の公開名は `default` なので、宣言側に名前が無いとその契約を指す名前が
 * どこにも存在しない。1:1 テスト対応は `describe` 名で対象を指すため、名前の無い default export は
 * 対応の要求すら受けられない。
 * React component としては DevTools とエラー境界のスタックでも名前を失う。
 *
 * 許すのは 2 形のみ — 名前付きの関数 / クラス宣言(`export default function Foo() {}`)と、
 * 識別子への参照(`const Foo = () => {}; export default Foo;`)。arrow function を default
 * export できるのは後者だけなので、両方を許して初めて書ける形が揃う。
 */
const noAnonymousDefaultExport: Rule.RuleModule = {
  meta: {
    type: "problem",
    docs: {
      description: "default export は名前を持つ宣言か識別子参照にする",
    },
    schema: [],
    messages: {
      anonymousDefaultExport:
        "default export に名前がありません。`export default function Foo() {}` か、`const Foo = …; export default Foo;` の形にしてください。",
    },
  },
  create(context) {
    return {
      ExportDefaultDeclaration(node) {
        const declaration = node.declaration;

        if (declaration.type === "Identifier") {
          return;
        }

        const named =
          (declaration.type === "FunctionDeclaration" ||
            declaration.type === "ClassDeclaration" ||
            declaration.type === "FunctionExpression" ||
            declaration.type === "ClassExpression") &&
          declaration.id !== null;

        if (named) {
          return;
        }

        context.report({ node, messageId: "anonymousDefaultExport" });
      },
    };
  },
};

export default noAnonymousDefaultExport;
