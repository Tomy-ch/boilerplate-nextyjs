import type { AnyExtension, Editor } from "@tiptap/core";
import { Blockquote } from "@tiptap/extension-blockquote";
import { Bold } from "@tiptap/extension-bold";
import { Code } from "@tiptap/extension-code";
import { Document } from "@tiptap/extension-document";
import { HardBreak } from "@tiptap/extension-hard-break";
import { Heading, type Level } from "@tiptap/extension-heading";
import { HorizontalRule } from "@tiptap/extension-horizontal-rule";
import { Italic } from "@tiptap/extension-italic";
import { Link } from "@tiptap/extension-link";
import { BulletList, ListItem, OrderedList } from "@tiptap/extension-list";
import { Paragraph } from "@tiptap/extension-paragraph";
import { Strike } from "@tiptap/extension-strike";
import { Text } from "@tiptap/extension-text";
import { UndoRedo } from "@tiptap/extensions";

import {
  BoldIcon,
  CodeIcon,
  Heading2Icon,
  Heading3Icon,
  Heading4Icon,
  type IconComponent,
  ItalicIcon,
  ListIcon,
  ListOrderedIcon,
  MinusIcon,
  QuoteIcon,
  RedoIcon,
  StrikethroughIcon,
  UndoIcon,
} from "@/components/icon";
import { RICH_TEXT_LINK_PROTOCOLS } from "@/model/rich-text/rich-text.definition";
import { SHORTCUT_MODIFIER } from "../../display/keyboard-shortcut/keyboard-shortcut.definition";

/**
 * 見出しとして書ける階層です。
 *
 * `h1` を含めないのは、本文の見出しが page の `h1` と競合するためです。
 *
 * @see Storybook `Rich Text/RichTextEditor`
 */
export const RICH_TEXT_EDITOR_HEADING_LEVELS: readonly Level[] = [2, 3, 4];

/**
 * `a` の `href` として書けるかどうかを判定します。
 *
 * protocol を持たない相対 URL と、{@link RICH_TEXT_LINK_PROTOCOLS} の protocol を持つ URL だけを
 * 通します。protocol の有無は最初の `:` の位置で決まり、`?` `#` `/` より後ろにある `:` は
 * protocol の区切りとして扱いません。
 *
 * `//` で始まる値は拒否します。`:` を持たないため相対 URL の見た目をしていますが、閲覧中の
 * ページと同じ protocol で解決される外部ホストへの絶対 URL であり、アプリ内のパスではありません。
 *
 * @param href - 判定する `href` の値
 * @returns 書ける場合は `true`
 */
export function isRichTextHrefAllowed(href: string): boolean {
  if (href.startsWith("//")) {
    return false;
  }

  const colon = href.indexOf(":");
  const questionMark = href.indexOf("?");
  const numberSign = href.indexOf("#");
  const slash = href.indexOf("/");

  if (
    colon < 0 ||
    (slash > -1 && colon > slash) ||
    (questionMark > -1 && colon > questionMark) ||
    (numberSign > -1 && colon > numberSign)
  ) {
    return true;
  }

  return RICH_TEXT_LINK_PROTOCOLS.includes(href.slice(0, colon));
}

/**
 * editor が読み書きする node と mark の全体です。
 *
 * この集合が editor の出力できるタグを決めます。sanitizer の allowlist
 * （`model/rich-text` の `RICH_TEXT_TAG_NAMES`）に収まる範囲だけを登録しており、外へ出るものを足すと、書けたのに
 * 表示されない内容が生まれます。extension を足すときは allowlist・この集合・test を揃えて変えます。
 *
 * @see Storybook `Rich Text/RichTextEditor`
 */
export const RICH_TEXT_EDITOR_EXTENSIONS: readonly AnyExtension[] = [
  Document,
  Paragraph,
  Text,
  Heading.configure({ levels: [...RICH_TEXT_EDITOR_HEADING_LEVELS] }),
  Bold,
  Italic,
  Strike,
  Code,
  BulletList,
  OrderedList,
  ListItem,
  Blockquote,
  HorizontalRule,
  HardBreak,
  Link.configure({
    HTMLAttributes: { class: null, rel: null, target: null },
    defaultProtocol: "https",
    isAllowedUri: isRichTextHrefAllowed,
    openOnClick: false,
  }),
  UndoRedo,
];

/**
 * 選択範囲へ適用されているかどうかを持つ操作です。
 *
 * 押下状態を持つ切り替えとして toolbar に並びます。
 *
 * @see {@link RICH_TEXT_EDITOR_MARK_ACTIONS}
 * @see {@link RICH_TEXT_EDITOR_BLOCK_ACTIONS}
 */
export type RichTextEditorToggleAction = {
  /** 操作を識別する key。 */
  readonly id: string;
  /** toolbar のボタンのアクセシブルな名前。 */
  readonly label: string;
  /** ボタンに表示する図案。 */
  readonly Icon: IconComponent;
  /** 同じことを起こすキー。押す順に並べる。持たない操作もある。 */
  readonly shortcut?: readonly string[];
  /** 選択範囲へ適用されているかどうかを返す。 */
  readonly isActive: (editor: Editor) => boolean;
  /** 適用と解除を切り替える。 */
  readonly run: (editor: Editor) => void;
};

/**
 * 押下状態を持たず、実行できるかどうかだけを持つ操作です。
 *
 * 実行するボタンとして toolbar に並びます。
 *
 * @see {@link RICH_TEXT_EDITOR_COMMAND_ACTIONS}
 */
export type RichTextEditorCommandAction = {
  /** 操作を識別する key。 */
  readonly id: string;
  /** toolbar のボタンのアクセシブルな名前。 */
  readonly label: string;
  /** ボタンに表示する図案。 */
  readonly Icon: IconComponent;
  /** 同じことを起こすキー。押す順に並べる。持たない操作もある。 */
  readonly shortcut?: readonly string[];
  /** いま実行できるかどうかを返す。実行できない間はボタンを disabled にする。 */
  readonly isEnabled: (editor: Editor) => boolean;
  /** 操作を実行する。 */
  readonly run: (editor: Editor) => void;
};

/**
 * 文字そのものの見え方を変える操作です。
 *
 * 選択範囲に対して働き、範囲が無いときは以降の入力へ適用されます。
 *
 * @see Storybook `Rich Text/RichTextEditor`
 */
export const RICH_TEXT_EDITOR_MARK_ACTIONS: readonly RichTextEditorToggleAction[] = [
  {
    id: "bold",
    label: "太字",
    Icon: BoldIcon,
    shortcut: [SHORTCUT_MODIFIER.MOD, "B"],
    isActive: (editor) => editor.isActive("bold"),
    run: (editor) => void editor.chain().focus().toggleBold().run(),
  },
  {
    id: "italic",
    label: "斜体",
    Icon: ItalicIcon,
    shortcut: [SHORTCUT_MODIFIER.MOD, "I"],
    isActive: (editor) => editor.isActive("italic"),
    run: (editor) => void editor.chain().focus().toggleItalic().run(),
  },
  {
    id: "strike",
    label: "打ち消し線",
    Icon: StrikethroughIcon,
    shortcut: [SHORTCUT_MODIFIER.MOD, SHORTCUT_MODIFIER.SHIFT, "S"],
    isActive: (editor) => editor.isActive("strike"),
    run: (editor) => void editor.chain().focus().toggleStrike().run(),
  },
  {
    id: "code",
    label: "コード",
    Icon: CodeIcon,
    shortcut: [SHORTCUT_MODIFIER.MOD, "E"],
    isActive: (editor) => editor.isActive("code"),
    run: (editor) => void editor.chain().focus().toggleCode().run(),
  },
];

/**
 * 段落の種類を変える操作です。
 *
 * カーソルのある block を丸ごと置き換えます。同じ操作をもう一度実行すると段落へ戻ります。
 *
 * @see Storybook `Rich Text/RichTextEditor`
 */
export const RICH_TEXT_EDITOR_BLOCK_ACTIONS: readonly RichTextEditorToggleAction[] = [
  {
    id: "heading2",
    label: "見出し 2",
    Icon: Heading2Icon,
    shortcut: [SHORTCUT_MODIFIER.MOD, SHORTCUT_MODIFIER.ALT, "2"],
    isActive: (editor) => editor.isActive("heading", { level: 2 }),
    run: (editor) => void editor.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    id: "heading3",
    label: "見出し 3",
    Icon: Heading3Icon,
    shortcut: [SHORTCUT_MODIFIER.MOD, SHORTCUT_MODIFIER.ALT, "3"],
    isActive: (editor) => editor.isActive("heading", { level: 3 }),
    run: (editor) => void editor.chain().focus().toggleHeading({ level: 3 }).run(),
  },
  {
    id: "heading4",
    label: "見出し 4",
    Icon: Heading4Icon,
    shortcut: [SHORTCUT_MODIFIER.MOD, SHORTCUT_MODIFIER.ALT, "4"],
    isActive: (editor) => editor.isActive("heading", { level: 4 }),
    run: (editor) => void editor.chain().focus().toggleHeading({ level: 4 }).run(),
  },
  {
    id: "bulletList",
    label: "箇条書き",
    Icon: ListIcon,
    shortcut: [SHORTCUT_MODIFIER.MOD, SHORTCUT_MODIFIER.SHIFT, "8"],
    isActive: (editor) => editor.isActive("bulletList"),
    run: (editor) => void editor.chain().focus().toggleBulletList().run(),
  },
  {
    id: "orderedList",
    label: "番号付き箇条書き",
    Icon: ListOrderedIcon,
    shortcut: [SHORTCUT_MODIFIER.MOD, SHORTCUT_MODIFIER.SHIFT, "7"],
    isActive: (editor) => editor.isActive("orderedList"),
    run: (editor) => void editor.chain().focus().toggleOrderedList().run(),
  },
  {
    id: "blockquote",
    label: "引用",
    Icon: QuoteIcon,
    shortcut: [SHORTCUT_MODIFIER.MOD, SHORTCUT_MODIFIER.SHIFT, "B"],
    isActive: (editor) => editor.isActive("blockquote"),
    run: (editor) => void editor.chain().focus().toggleBlockquote().run(),
  },
];

/**
 * 挿入と取り消しの操作です。
 *
 * 適用状態を持たないため、押下状態ではなく実行可否だけを表します。
 *
 * @see Storybook `Rich Text/RichTextEditor`
 */
export const RICH_TEXT_EDITOR_COMMAND_ACTIONS: readonly RichTextEditorCommandAction[] = [
  {
    id: "horizontalRule",
    label: "区切り線",
    Icon: MinusIcon,
    isEnabled: (editor) => editor.can().setHorizontalRule(),
    run: (editor) => void editor.chain().focus().setHorizontalRule().run(),
  },
  {
    id: "undo",
    label: "元に戻す",
    Icon: UndoIcon,
    shortcut: [SHORTCUT_MODIFIER.MOD, "Z"],
    isEnabled: (editor) => editor.can().undo(),
    run: (editor) => void editor.chain().focus().undo().run(),
  },
  {
    id: "redo",
    label: "やり直す",
    Icon: RedoIcon,
    shortcut: [SHORTCUT_MODIFIER.MOD, SHORTCUT_MODIFIER.SHIFT, "Z"],
    isEnabled: (editor) => editor.can().redo(),
    run: (editor) => void editor.chain().focus().redo().run(),
  },
];
