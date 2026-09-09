import type { Element } from "hast";
import { toJsxRuntime } from "hast-util-to-jsx-runtime";
import type { ComponentProps } from "react";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";

import { cn } from "@/components/cn";

import { MermaidDiagram } from "../mermaid-diagram/mermaid-diagram";
import { mermaidSourceOf } from "../mermaid-diagram/mermaid-source";
import type { SanitizedDocument } from "../sanitize/sanitized-document";

/**
 * mermaid のコードフェンスだけを図へ差し替えます。
 *
 * 判断は木の形だけで行い（{@link mermaidSourceOf}）、それ以外の `pre` は素の要素のまま返します。
 */
function DocumentPre({ node, ...props }: ComponentProps<"pre"> & { node?: Element }) {
  /* istanbul ignore next -- `passNode` が木の節を必ず渡すため、TS の絞り込みのためだけの分岐。 */
  const source = node === undefined ? undefined : mermaidSourceOf(node);

  return source === undefined ? <pre {...props} /> : <MermaidDiagram source={source} />;
}

/**
 * {@link DocumentContent} が受け取る props です。
 *
 * `children` と `dangerouslySetInnerHTML` は受け取りません。本文は `content` だけが決めます。
 */
export type DocumentContentProps = Omit<
  ComponentProps<"div">,
  "children" | "content" | "dangerouslySetInnerHTML"
> & {
  /** 表示する文書。sanitize を通した値だけがこの型を持ちます。 */
  content: SanitizedDocument;
};

/**
 * sanitize 済みのドキュメントを本文として表示する。
 *
 * @remarks
 * アプリ本体の `RichTextContent` と同じ形を採りますが、受け取る型が違います。ドキュメントは
 * 表・コードブロック・図を含み、利用者の投稿内容より広い allowlist を通っているため、
 * 両者の型を混ぜられない状態にしています。
 *
 * 描画は HTML 文字列を経由せず、木から React 要素を直接作ります。組版は `typeset` の CSS 基盤が
 * 持ち、ドキュメント用の preset を既定で当てます。
 *
 * 見出しは文書自身の `h1` から始まります。本文を開いた面の title は manifest の項目名であって
 * 文書の題ではないため、競合しません（`sanitize/document.definition.ts`）。
 *
 * mermaid のコードフェンスだけは図として描きます。差し替えは要素 1 つに閉じており、木のほかの
 * 部分は sanitize が通した形のまま描かれます。
 */
export function DocumentContent({ content, className, ...props }: DocumentContentProps) {
  return (
    <div className={cn("typeset typeset-docs", className)} data-slot="document-content" {...props}>
      {toJsxRuntime(content.root, {
        Fragment,
        jsx,
        jsxs,
        components: { pre: DocumentPre },
        passNode: true,
      })}
    </div>
  );
}
