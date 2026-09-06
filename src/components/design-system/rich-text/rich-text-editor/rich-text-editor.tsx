"use client";

import type { Editor } from "@tiptap/core";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import {
  type ChangeEvent,
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useId,
  useState,
} from "react";

import { cn } from "@/components/cn";
import { EyeIcon, LinkIcon, UnlinkIcon } from "@/components/icon";
import { SanitizedRichText } from "@/model/rich-text/sanitized-rich-text";
import { Button } from "../../action/button/button";
import { BUTTON_SIZE, BUTTON_VARIANT } from "../../action/button/button.definition";
import { Toggle } from "../../action/toggle/toggle";
import { KeyboardShortcutKeys } from "../../display/keyboard-shortcut/keyboard-shortcut-keys";
import { Input } from "../../form/input/input";
import { Label } from "../../form/label/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../../overlay/tooltip/tooltip";
import { RichTextContent } from "../rich-text-content/rich-text-content";
import {
  isRichTextHrefAllowed,
  RICH_TEXT_EDITOR_BLOCK_ACTIONS,
  RICH_TEXT_EDITOR_COMMAND_ACTIONS,
  RICH_TEXT_EDITOR_EXTENSIONS,
  RICH_TEXT_EDITOR_MARK_ACTIONS,
  type RichTextEditorCommandAction,
  type RichTextEditorToggleAction,
} from "./rich-text-editor.definition";

const EDITOR_EXTENSIONS = [...RICH_TEXT_EDITOR_EXTENSIONS];

const EDITOR_CONTENT_CLASS_NAME =
  "typeset typeset-docs min-h-40 px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-active focus-visible:shadow-glow-primary";

const TOOLBAR_BUTTON_CLASS_NAME = "size-8 min-w-8 p-0 [&_svg]:size-4";

/**
 * 選択範囲にかかっている link の `href` を読み出します。
 *
 * @param editor - 読み出す対象の editor
 * @returns link がかかっていれば その `href`、かかっていなければ空文字列
 */
function readLinkHref(editor: Editor): string {
  const href = editor.getAttributes("link").href;

  return typeof href === "string" ? href : "";
}

/**
 * toolbar のボタンに、その操作の名前と、同じことを起こすキーを添えます。
 *
 * @remarks
 * **toolbar のボタンはすべてこれを通します。** キーを持つものと持たないものが混ざりますが、案内の
 * 出方は 1 つに揃えます。片方を browser 標準の `title` のままにすると、同じ toolbar の中で出る速さも
 * 見た目も違うものが並びます。
 *
 * キーの表示に使うのは {@link KeyboardShortcutKeys} です。説明とキーを `dt` / `dd` の組にする
 * `KeyboardShortcut` は `dl` の子であることを前提にしており、`dl` を持たないこの位置へ置くと
 * 孤立した `dt` / `dd` になります。ここでは説明が隣に並ぶだけで足りるため、組にしません。
 *
 * `aria-keyshortcuts` は付けていません。値が `Control+B` と `Meta+B` のどちらになるかは動かして
 * いる環境で決まり、その判定は {@link KeyboardShortcutKeys} が既に持っています。ここで二つ目の
 * 判定を持つと、表示と読み上げが食い違いうる状態を自分で作ることになります。
 *
 * @param props.label - 操作の名前
 * @param props.shortcut - 同じことを起こすキー。押す順に並べる。持たない操作もある
 * @param props.children - 案内を添える対象のボタン
 */
function RichTextEditorHint({
  label,
  shortcut,
  children,
}: {
  label: string;
  shortcut?: readonly string[];
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild={true}>{children}</TooltipTrigger>
      <TooltipContent className="flex items-center gap-2">
        {label}
        {shortcut === undefined ? null : (
          <KeyboardShortcutKeys className="text-xs tracking-widest" keys={shortcut} />
        )}
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * 適用状態を押下状態として示す toolbar のボタンです。
 *
 * @param props - 表す操作と、操作対象の editor
 * @param props.action - toolbar に並べる操作
 * @param props.editor - 操作対象の editor
 */
function RichTextEditorToggle({
  action,
  editor,
}: {
  action: RichTextEditorToggleAction;
  editor: Editor;
}) {
  const isActive = useEditorState({ editor, selector: (state) => action.isActive(state.editor) });
  const isEditable = useEditorState({ editor, selector: (state) => state.editor.isEditable });
  const handleClick = useCallback(() => action.run(editor), [action, editor]);

  return (
    <RichTextEditorHint label={action.label} shortcut={action.shortcut}>
      <Toggle
        aria-label={action.label}
        className={TOOLBAR_BUTTON_CLASS_NAME}
        data-slot="rich-text-editor-toggle"
        disabled={!isEditable}
        onClick={handleClick}
        pressed={isActive}
      >
        <action.Icon aria-hidden="true" />
      </Toggle>
    </RichTextEditorHint>
  );
}

/**
 * 実行できるかどうかだけを示す toolbar のボタンです。
 *
 * @param props - 表す操作と、操作対象の editor
 * @param props.action - toolbar に並べる操作
 * @param props.editor - 操作対象の editor
 */
function RichTextEditorCommand({
  action,
  editor,
}: {
  action: RichTextEditorCommandAction;
  editor: Editor;
}) {
  const isEnabled = useEditorState({
    editor,
    selector: (state) => state.editor.isEditable && action.isEnabled(state.editor),
  });
  const handleClick = useCallback(() => action.run(editor), [action, editor]);

  return (
    <RichTextEditorHint label={action.label} shortcut={action.shortcut}>
      <Button
        aria-label={action.label}
        className={TOOLBAR_BUTTON_CLASS_NAME}
        data-slot="rich-text-editor-command"
        disabled={!isEnabled}
        onClick={handleClick}
        size={BUTTON_SIZE.SMALL}
        type="button"
        variant={BUTTON_VARIANT.GHOST}
      >
        <action.Icon aria-hidden="true" />
      </Button>
    </RichTextEditorHint>
  );
}

/**
 * toolbar・link 入力・編集面をまとめる、editor が用意できてからの本体です。
 *
 * @param props - 編集面の見た目と、操作対象の editor
 * @param props.className - 外枠へ追加する class
 * @param props.editor - 操作対象の editor
 */
function RichTextEditorFrame({ className, editor }: { className?: string; editor: Editor }) {
  const linkInputId = useId();
  const linkErrorId = useId();
  const [isLinkFormOpen, setIsLinkFormOpen] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [linkHref, setLinkHref] = useState("");
  const [hasLinkError, setHasLinkError] = useState(false);
  const isLinkActive = useEditorState({
    editor,
    selector: (state) => state.editor.isActive("link"),
  });
  const isEditable = useEditorState({ editor, selector: (state) => state.editor.isEditable });

  const togglePreview = useCallback(() => {
    setIsLinkFormOpen(false);
    setIsPreviewing((current) => !current);
  }, []);

  const toggleLinkForm = useCallback(() => {
    setHasLinkError(false);
    setLinkHref(readLinkHref(editor));
    setIsLinkFormOpen((current) => !current);
  }, [editor]);

  const changeLinkHref = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setHasLinkError(false);
    setLinkHref(event.target.value);
  }, []);

  const applyLink = useCallback(() => {
    if (linkHref === "" || !isRichTextHrefAllowed(linkHref)) {
      setHasLinkError(true);
      return;
    }

    const chain = editor.chain().focus().extendMarkRange("link");

    if (editor.state.selection.empty && !isLinkActive) {
      chain
        .insertContent({
          type: "text",
          marks: [{ type: "link", attrs: { href: linkHref } }],
          text: linkHref,
        })
        // 挿入したあと mark を外す。外さないと、続けて打った文字までリンクへ入る。
        .unsetMark("link");
    } else {
      chain.setLink({ href: linkHref });
    }

    chain.run();
    setIsLinkFormOpen(false);
  }, [editor, isLinkActive, linkHref]);

  const removeLink = useCallback(() => {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    setIsLinkFormOpen(false);
  }, [editor]);

  const handleLinkKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key !== "Enter") {
        return;
      }

      event.preventDefault();
      applyLink();
    },
    [applyLink],
  );

  const commandActions = isPreviewing
    ? null
    : RICH_TEXT_EDITOR_COMMAND_ACTIONS.map((action) => (
        <RichTextEditorCommand action={action} editor={editor} key={action.id} />
      ));

  const linkErrorMessage = hasLinkError ? (
    <p className="text-destructive text-sm" id={linkErrorId}>
      http / https / mailto から始まる URL か、スラッシュで始まるアプリ内のパスを入力してください。
    </p>
  ) : null;

  const linkForm =
    isLinkFormOpen && !isPreviewing ? (
      <div className="flex flex-col gap-2 border-border border-b px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <Label htmlFor={linkInputId}>リンク先</Label>
          <Input
            aria-describedby={hasLinkError ? linkErrorId : undefined}
            aria-invalid={hasLinkError}
            className="w-64 max-w-full"
            id={linkInputId}
            onChange={changeLinkHref}
            onKeyDown={handleLinkKeyDown}
            type="url"
            value={linkHref}
          />
          <Button onClick={applyLink} size={BUTTON_SIZE.SMALL} type="button">
            適用
          </Button>
          <RichTextEditorHint label="リンクを解除">
            <Button
              aria-label="リンクを解除"
              className={TOOLBAR_BUTTON_CLASS_NAME}
              disabled={!isLinkActive}
              onClick={removeLink}
              size={BUTTON_SIZE.SMALL}
              type="button"
              variant={BUTTON_VARIANT.GHOST}
            >
              <UnlinkIcon aria-hidden="true" />
            </Button>
          </RichTextEditorHint>
        </div>
        {linkErrorMessage}
      </div>
    ) : null;

  return (
    // Provider をこの部品が持つ。外へ出すと、呼び出し元が mount し忘れた時点で描画が例外になる。
    <TooltipProvider>
      <div
        className={cn("rounded-md border border-border bg-background", className)}
        data-slot="rich-text-editor"
      >
        <div
          aria-label="書式"
          className="flex flex-wrap items-center gap-1 border-border border-b p-1"
          data-slot="rich-text-editor-toolbar"
          role="toolbar"
        >
          {isPreviewing
            ? null
            : RICH_TEXT_EDITOR_MARK_ACTIONS.map((action) => (
                <RichTextEditorToggle action={action} editor={editor} key={action.id} />
              ))}
          {isPreviewing
            ? null
            : RICH_TEXT_EDITOR_BLOCK_ACTIONS.map((action) => (
                <RichTextEditorToggle action={action} editor={editor} key={action.id} />
              ))}
          {isPreviewing ? null : (
            <RichTextEditorHint label="リンク">
              <Toggle
                aria-expanded={isLinkFormOpen}
                aria-label="リンク"
                className={TOOLBAR_BUTTON_CLASS_NAME}
                data-slot="rich-text-editor-link"
                disabled={!isEditable}
                onClick={toggleLinkForm}
                pressed={isLinkActive}
              >
                <LinkIcon aria-hidden="true" />
              </Toggle>
            </RichTextEditorHint>
          )}
          {commandActions}
          <RichTextEditorHint label="プレビュー">
            <Toggle
              aria-label="プレビュー"
              className={cn(TOOLBAR_BUTTON_CLASS_NAME, "ms-auto")}
              data-slot="rich-text-editor-preview"
              onClick={togglePreview}
              pressed={isPreviewing}
            >
              <EyeIcon aria-hidden="true" />
            </Toggle>
          </RichTextEditorHint>
        </div>
        {linkForm}
        {/* 編集面は DOM へ残す。外すと editor の view が壊れ、戻ったときに書きかけが失われる。 */}
        <div hidden={isPreviewing}>
          <EditorContent editor={editor} />
        </div>
        {isPreviewing ? (
          <RichTextContent
            className="px-3 py-2"
            content={SanitizedRichText.from(editor.getHTML())}
          />
        ) : null}
      </div>
    </TooltipProvider>
  );
}

/** {@link RichTextEditor} の props。 */
export type RichTextEditorProps = {
  /**
   * 編集面のアクセシブルな名前。
   *
   * 編集面は `textbox` として公開されるが視覚的なラベルを持たないため、何を書く欄なのかは
   * この値だけが伝える。
   */
  label: string;
  /**
   * 内容が変わるたびに、現在の内容を HTML 文字列として受け取る。
   *
   * 保存・送信・検証は呼び出し元が行う。表示するときは `SanitizedRichText.from` を通す。
   */
  onChange: (html: string) => void;
  /**
   * 初期表示する HTML 文字列。
   *
   * allowlist の外にあるタグは parse の時点で落ちる。保存済みの内容を編集する場合に渡す。
   */
  defaultValue?: string;
  /**
   * 編集面そのものへ与える `id`。
   *
   * 誤りの要約など、外から編集面を名指しで指したい場合に渡す。省略すると付かない。
   */
  id?: string;
  /** `true` の間は読み取り専用になり、toolbar からの操作も効かなくなる。 */
  disabled?: boolean;
  /** 外枠へ追加する class。 */
  className?: string;
};

/**
 * 書式付きの本文を書くための client island。
 *
 * @remarks
 * ProseMirror の編集面を browser 側で組み立てるため hydration が必要で、Server Component からは
 * 直接 render できない。
 *
 * 扱う値は HTML 文字列だけで、`defaultValue` も `onChange` の引数も文字列である。表示側の
 * `RichTextContent` が受け取る `SanitizedRichText` は受け取らず、返しもしない。編集へ戻すのは
 * 保存した文字列そのものであり、`SanitizedRichText` は class instance で serializable ではない
 * ため Client Component の props としても運べない。
 *
 * 保存も送信も持たない。内容が変わるたびに `onChange` へ HTML 文字列を渡すだけで、`<form>` にも
 * 載らない。呼び出し元は受け取った文字列を hidden input へ載せるか、Server Action の引数として
 * 渡す。**受け取った HTML を検証済みとして扱わない。** 表示するときは必ず
 * `SanitizedRichText.from` を通す。この component が出せるタグは sanitizer の allowlist に
 * 収まっているが、それは editor の設定が満たしている性質であって、引数として渡された文字列が
 * 満たす性質ではない。sanitize は保存のときではなく表示の直前に行う。
 *
 * 書けるのは見出し（2〜4）・箇条書き・番号付き箇条書き・引用・区切り線・太字・斜体・打ち消し線・
 * コード・改行とリンクに限る。表・画像・コードブロック・下線は書けない。
 *
 * リンクは toolbar の「リンク」から入力するほか、URL を入力または貼り付けると自動でリンクになる。
 * `http` / `https` / `mailto` とアプリ内のパスだけを受け付ける。
 *
 * 編集面は `textbox` として公開されるため、`label` でアクセシブルな名前を必ず与える。
 *
 * @example
 * ```tsx
 * "use client";
 *
 * import { useCallback, useState } from "react";
 *
 * import { RichTextEditor } from "@/components/design-system/rich-text/rich-text-editor/rich-text-editor";
 *
 * export function DescriptionField() {
 *   const [html, setHtml] = useState("");
 *   const handleChange = useCallback((value: string) => setHtml(value), []);
 *
 *   return (
 *     <>
 *       <RichTextEditor label="説明" onChange={handleChange} />
 *       <input name="description" type="hidden" value={html} />
 *     </>
 *   );
 * }
 * ```
 *
 * @example
 * 送られてきた文字列を表示するのは Server Component 側で、sanitize はその直前に行う。
 * ```tsx
 * import { RichTextContent } from "@/components/design-system/rich-text/rich-text-content/rich-text-content";
 * import { SanitizedRichText } from "@/model/rich-text/sanitized-rich-text";
 *
 * <RichTextContent className="typeset-docs" content={SanitizedRichText.from(html)} />
 * ```
 *
 * @param props - 編集面の名前・初期値・変更の受け取り方。
 * @see Storybook `Rich Text/RichTextEditor`
 */
export function RichTextEditor({
  className,
  defaultValue = "",
  disabled = false,
  label,
  onChange,
  id,
}: RichTextEditorProps) {
  const editor = useEditor({
    content: defaultValue,
    editable: !disabled,
    editorProps: {
      attributes: {
        "aria-label": label,
        "aria-multiline": "true",
        class: EDITOR_CONTENT_CLASS_NAME,
        role: "textbox",
        ...(id === undefined ? {} : { id }),
      },
    },
    extensions: EDITOR_EXTENSIONS,
    immediatelyRender: false,
    onUpdate: ({ editor: updated }) => onChange(updated.getHTML()),
  });

  if (editor === null) {
    return null;
  }

  return <RichTextEditorFrame className={className} editor={editor} />;
}
