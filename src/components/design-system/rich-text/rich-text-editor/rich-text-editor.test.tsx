// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { Editor } from "@tiptap/core";
import type { Nodes } from "hast";
import { fromHtml } from "hast-util-from-html";
import { afterEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { RICH_TEXT_TAG_NAMES } from "@/model/rich-text/rich-text.definition";
import { SanitizedRichText } from "@/model/rich-text/sanitized-rich-text";

import { RichTextEditor } from "./rich-text-editor";
import { RICH_TEXT_EDITOR_EXTENSIONS } from "./rich-text-editor.definition";

const noop = () => undefined;

// **リンク先の入力だけは `user-event` を使いません。**打ち込むと本文側の入力位置が動き、
// ProseMirror がその座標を測りに来ます。jsdom は文字の矩形を持たないため、そこで落ちます。
// 本文そのものが contenteditable であることと同じ理由で、この編集器は打鍵の再現の外にあります。

type ElementSignature = { tagName: string; propertyNames: readonly string[] };

function elementSignatures(node: Nodes): ElementSignature[] {
  const signatures: ElementSignature[] = [];

  const walk = (current: Nodes): void => {
    if (current.type === "element") {
      signatures.push({
        tagName: current.tagName,
        propertyNames: Object.keys(current.properties).sort(),
      });
    }

    if ("children" in current) {
      for (const child of current.children) {
        walk(child);
      }
    }
  };

  walk(node);

  return signatures;
}

function createHeadlessEditor(): Editor {
  return new Editor({ extensions: [...RICH_TEXT_EDITOR_EXTENSIONS] });
}

function renderEditor(props: Partial<Parameters<typeof RichTextEditor>[0]> = {}) {
  return render(<RichTextEditor label="本文" onChange={props.onChange ?? noop} {...props} />);
}

function toolbarButton(name: string): HTMLElement {
  return screen.getByRole("button", { name });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("RichTextEditor", () => {
  it("プレビューへ切り替えると、表示側と同じ形で読める", async () => {
    render(<RichTextEditor label="説明文" defaultValue="<h2>見出し</h2>" onChange={noop} />);

    fireEvent.click(await screen.findByRole("button", { name: "プレビュー" }));

    expect(screen.getByRole("heading", { name: "見出し", level: 2 })).toBeInTheDocument();
  });

  it("プレビュー中は書式の操作を出さない", async () => {
    render(<RichTextEditor label="説明文" onChange={noop} />);

    fireEvent.click(await screen.findByRole("button", { name: "プレビュー" }));

    expect(screen.queryByRole("button", { name: "リンク" })).not.toBeInTheDocument();
  });

  it("プレビューから戻ると書きかけが残っている", async () => {
    render(<RichTextEditor label="説明文" defaultValue="<p>書きかけ</p>" onChange={noop} />);

    const preview = await screen.findByRole("button", { name: "プレビュー" });

    fireEvent.click(preview);
    fireEvent.click(preview);

    expect(screen.getByRole("textbox", { name: "説明文" })).toHaveTextContent("書きかけ");
  });

  it("書式の toolbar と、名前を持つ編集面を描画する", () => {
    renderEditor();

    expect(screen.getByRole("toolbar", { name: "書式" })).toBeInTheDocument();

    const textbox = screen.getByRole("textbox", { name: "本文" });

    expect(textbox).toHaveAttribute("contenteditable", "true");
    expect(textbox).toHaveAttribute("aria-multiline", "true");
  });

  it("toolbar の中は矢印キーで隣の操作へ移る", () => {
    renderEditor();

    toolbarButton("太字").focus();
    fireEvent.keyDown(toolbarButton("太字"), { key: "ArrowRight" });
    expect(toolbarButton("斜体")).toHaveFocus();

    fireEvent.keyDown(toolbarButton("斜体"), { key: "ArrowLeft" });
    expect(toolbarButton("太字")).toHaveFocus();
  });

  it("矢印キーの移動は端で反対側へ回る", () => {
    renderEditor();

    toolbarButton("太字").focus();
    fireEvent.keyDown(toolbarButton("太字"), { key: "ArrowLeft" });
    expect(toolbarButton("プレビュー")).toHaveFocus();

    fireEvent.keyDown(toolbarButton("プレビュー"), { key: "ArrowRight" });
    expect(toolbarButton("太字")).toHaveFocus();
  });

  it("Home と End で toolbar の両端へ移る", () => {
    renderEditor();

    toolbarButton("斜体").focus();
    fireEvent.keyDown(toolbarButton("斜体"), { key: "End" });
    expect(toolbarButton("プレビュー")).toHaveFocus();

    fireEvent.keyDown(toolbarButton("プレビュー"), { key: "Home" });
    expect(toolbarButton("太字")).toHaveFocus();
  });

  it("押せない操作は矢印キーの移動で飛ばす", () => {
    renderEditor();

    toolbarButton("区切り線").focus();
    fireEvent.keyDown(toolbarButton("区切り線"), { key: "ArrowRight" });

    expect(toolbarButton("元に戻す")).toBeDisabled();
    expect(toolbarButton("プレビュー")).toHaveFocus();
  });

  it("Tab の並びに残る toolbar のボタンは、最後に focus を持った 1 つだけ", () => {
    renderEditor();

    const toolbar = screen.getByRole("toolbar", { name: "書式" });
    const tabStops = () =>
      [...toolbar.querySelectorAll("button")].filter((button) => button.tabIndex === 0);

    expect(tabStops()).toEqual([toolbarButton("太字")]);

    toolbarButton("太字").focus();
    fireEvent.keyDown(toolbarButton("太字"), { key: "ArrowRight" });

    expect(tabStops()).toEqual([toolbarButton("斜体")]);
  });

  it("読み取り専用のときは、押せるプレビューだけが Tab の並びに残る", () => {
    renderEditor({ disabled: true });

    const toolbar = screen.getByRole("toolbar", { name: "書式" });
    const tabStops = [...toolbar.querySelectorAll("button")].filter(
      (button) => button.tabIndex === 0,
    );

    expect(tabStops).toEqual([toolbarButton("プレビュー")]);
  });

  it("初期値の HTML を編集面へ読み込む", () => {
    renderEditor({ defaultValue: "<h2>見出し</h2><p>本文</p>" });

    expect(screen.getByRole("heading", { level: 2, name: "見出し" })).toBeInTheDocument();
    expect(screen.getByText("本文")).toBeInTheDocument();
  });

  it("allowlist の外にあるタグは初期値から落ちる", () => {
    renderEditor({ defaultValue: "<h1>見出し 1</h1><p>本文</p>" });

    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
  });

  it("読み取り専用のときは編集できない", () => {
    renderEditor({ defaultValue: "<p>本文</p>", disabled: true });

    expect(screen.getByRole("textbox", { name: "本文" })).toHaveAttribute(
      "contenteditable",
      "false",
    );
  });

  it("読み取り専用のときは toolbar の操作も効かない", () => {
    renderEditor({ defaultValue: "<p>本文</p>", disabled: true });

    expect(toolbarButton("太字")).toBeDisabled();
    expect(toolbarButton("箇条書き")).toBeDisabled();
    expect(toolbarButton("リンク")).toBeDisabled();
    expect(toolbarButton("区切り線")).toBeDisabled();
  });

  it("読み取り専用でもプレビューへは切り替えられる", () => {
    renderEditor({ defaultValue: "<p>本文</p>", disabled: true });

    expect(toolbarButton("プレビュー")).toBeEnabled();
  });

  // 案内は hover / focus でしか開かないため、押下ではなく focus で確かめる。
  it("キーを持つ操作は、案内にそのキーを添える", async () => {
    renderEditor({ defaultValue: "<p>本文</p>" });

    fireEvent.focus(toolbarButton("太字"));

    expect(await screen.findByRole("tooltip")).toHaveTextContent(/太字.*B/);
  });

  it("キーを持たない操作の案内は、名前だけを出す", async () => {
    renderEditor({ defaultValue: "<p>本文</p>" });

    fireEvent.focus(toolbarButton("プレビュー"));

    expect(await screen.findByRole("tooltip")).toHaveTextContent("プレビュー");
    expect(screen.getByRole("tooltip").textContent).toBe("プレビュー");
  });

  it("リンク入力欄を開いたままプレビューへ切り替えると入力欄を閉じる", () => {
    renderEditor({ defaultValue: "<p>本文</p>" });

    fireEvent.click(toolbarButton("リンク"));
    expect(screen.getByLabelText("リンク先")).toBeInTheDocument();

    fireEvent.click(toolbarButton("プレビュー"));
    fireEvent.click(toolbarButton("プレビュー"));

    expect(screen.queryByLabelText("リンク先")).not.toBeInTheDocument();
  });

  it("外枠へ class を追加できる", () => {
    const { container } = renderEditor({ className: "max-w-prose" });

    expect(container.querySelector("[data-slot='rich-text-editor']")).toHaveClass("max-w-prose");
  });

  it("書式ボタンを押すと押下状態が変わる", () => {
    renderEditor({ defaultValue: "<p>本文</p>" });

    const bold = toolbarButton("太字");

    expect(bold).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(bold);

    expect(bold).toHaveAttribute("aria-pressed", "true");
  });

  it("太字ボタンが押下状態を切り替える", () => {
    renderEditor({ defaultValue: "<p>本文</p>" });

    fireEvent.click(toolbarButton("太字"));
    expect(toolbarButton("太字")).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(toolbarButton("太字"));
    expect(toolbarButton("太字")).toHaveAttribute("aria-pressed", "false");
  });

  it("斜体ボタンが押下状態を切り替える", () => {
    renderEditor({ defaultValue: "<p>本文</p>" });

    fireEvent.click(toolbarButton("斜体"));
    expect(toolbarButton("斜体")).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(toolbarButton("斜体"));
    expect(toolbarButton("斜体")).toHaveAttribute("aria-pressed", "false");
  });

  it("打ち消し線ボタンが押下状態を切り替える", () => {
    renderEditor({ defaultValue: "<p>本文</p>" });

    fireEvent.click(toolbarButton("打ち消し線"));
    expect(toolbarButton("打ち消し線")).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(toolbarButton("打ち消し線"));
    expect(toolbarButton("打ち消し線")).toHaveAttribute("aria-pressed", "false");
  });

  it("コードボタンが押下状態を切り替える", () => {
    renderEditor({ defaultValue: "<p>本文</p>" });

    fireEvent.click(toolbarButton("コード"));
    expect(toolbarButton("コード")).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(toolbarButton("コード"));
    expect(toolbarButton("コード")).toHaveAttribute("aria-pressed", "false");
  });

  it("見出し 2ボタンが押下状態を切り替える", () => {
    renderEditor({ defaultValue: "<p>本文</p>" });

    fireEvent.click(toolbarButton("見出し 2"));
    expect(toolbarButton("見出し 2")).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(toolbarButton("見出し 2"));
    expect(toolbarButton("見出し 2")).toHaveAttribute("aria-pressed", "false");
  });

  it("見出し 3ボタンが押下状態を切り替える", () => {
    renderEditor({ defaultValue: "<p>本文</p>" });

    fireEvent.click(toolbarButton("見出し 3"));
    expect(toolbarButton("見出し 3")).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(toolbarButton("見出し 3"));
    expect(toolbarButton("見出し 3")).toHaveAttribute("aria-pressed", "false");
  });

  it("見出し 4ボタンが押下状態を切り替える", () => {
    renderEditor({ defaultValue: "<p>本文</p>" });

    fireEvent.click(toolbarButton("見出し 4"));
    expect(toolbarButton("見出し 4")).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(toolbarButton("見出し 4"));
    expect(toolbarButton("見出し 4")).toHaveAttribute("aria-pressed", "false");
  });

  it("箇条書きボタンが押下状態を切り替える", () => {
    renderEditor({ defaultValue: "<p>本文</p>" });

    fireEvent.click(toolbarButton("箇条書き"));
    expect(toolbarButton("箇条書き")).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(toolbarButton("箇条書き"));
    expect(toolbarButton("箇条書き")).toHaveAttribute("aria-pressed", "false");
  });

  it("番号付き箇条書きボタンが押下状態を切り替える", () => {
    renderEditor({ defaultValue: "<p>本文</p>" });

    fireEvent.click(toolbarButton("番号付き箇条書き"));
    expect(toolbarButton("番号付き箇条書き")).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(toolbarButton("番号付き箇条書き"));
    expect(toolbarButton("番号付き箇条書き")).toHaveAttribute("aria-pressed", "false");
  });

  it("引用ボタンが押下状態を切り替える", () => {
    renderEditor({ defaultValue: "<p>本文</p>" });

    fireEvent.click(toolbarButton("引用"));
    expect(toolbarButton("引用")).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(toolbarButton("引用"));
    expect(toolbarButton("引用")).toHaveAttribute("aria-pressed", "false");
  });

  it("段落の種類を変えると、変更後の HTML を通知する", () => {
    const onChange = vi.fn();
    renderEditor({ defaultValue: "<p>本文</p>", onChange });

    fireEvent.click(toolbarButton("見出し 2"));

    expect(onChange).toHaveBeenCalledWith("<h2>本文</h2>");
    expect(toolbarButton("見出し 2")).toHaveAttribute("aria-pressed", "true");
  });

  it("箇条書き・引用・区切り線を挿入できる", () => {
    const onChange = vi.fn();
    renderEditor({ defaultValue: "<p>本文</p>", onChange });

    fireEvent.click(toolbarButton("箇条書き"));

    expect(onChange).toHaveBeenLastCalledWith("<ul><li><p>本文</p></li></ul>");

    fireEvent.click(toolbarButton("箇条書き"));
    fireEvent.click(toolbarButton("番号付き箇条書き"));

    expect(onChange).toHaveBeenLastCalledWith("<ol><li><p>本文</p></li></ol>");

    fireEvent.click(toolbarButton("番号付き箇条書き"));
    fireEvent.click(toolbarButton("引用"));

    expect(onChange).toHaveBeenLastCalledWith("<blockquote><p>本文</p></blockquote>");

    fireEvent.click(toolbarButton("区切り線"));

    expect(onChange).toHaveBeenLastCalledWith(expect.stringContaining("<hr>"));
  });

  it("取り消しとやり直しは、実行できる間だけ押せる", () => {
    renderEditor({ defaultValue: "<p>本文</p>" });

    expect(toolbarButton("元に戻す")).toBeDisabled();
    expect(toolbarButton("やり直す")).toBeDisabled();

    fireEvent.click(toolbarButton("見出し 2"));

    expect(toolbarButton("元に戻す")).toBeEnabled();

    fireEvent.click(toolbarButton("元に戻す"));

    expect(toolbarButton("見出し 2")).toHaveAttribute("aria-pressed", "false");
    expect(toolbarButton("やり直す")).toBeEnabled();

    fireEvent.click(toolbarButton("やり直す"));

    expect(toolbarButton("見出し 2")).toHaveAttribute("aria-pressed", "true");
  });

  describe("リンク", () => {
    it("リンクを押すまで入力欄を出さない", () => {
      renderEditor({ defaultValue: "<p>本文</p>" });

      expect(screen.queryByLabelText("リンク先")).not.toBeInTheDocument();
      expect(toolbarButton("リンク")).toHaveAttribute("aria-expanded", "false");

      fireEvent.click(toolbarButton("リンク"));

      expect(screen.getByLabelText("リンク先")).toHaveValue("");
      expect(toolbarButton("リンク")).toHaveAttribute("aria-expanded", "true");
    });

    it("選択範囲にかかっているリンク先を入力欄へ引き継ぐ", () => {
      renderEditor({ defaultValue: '<p><a href="https://example.com/a">リンク</a></p>' });

      expect(toolbarButton("リンク")).toHaveAttribute("aria-pressed", "true");

      fireEvent.click(toolbarButton("リンク"));

      expect(screen.getByLabelText("リンク先")).toHaveValue("https://example.com/a");
    });

    it("入力したリンク先を適用すると入力欄を閉じる", () => {
      renderEditor({ defaultValue: '<p><a href="https://example.com/a">リンク</a></p>' });

      fireEvent.click(toolbarButton("リンク"));
      fireEvent.change(screen.getByLabelText("リンク先"), {
        target: { value: "https://example.com/b" },
      });
      fireEvent.click(screen.getByRole("button", { name: "適用" }));

      expect(screen.queryByLabelText("リンク先")).not.toBeInTheDocument();
      expect(screen.getByRole("link", { name: "リンク" })).toHaveAttribute(
        "href",
        "https://example.com/b",
      );
    });

    it("選択範囲が無いときは、リンク先そのものを本文へ挿入する", () => {
      renderEditor({ defaultValue: "<p>本文</p>" });

      fireEvent.click(toolbarButton("リンク"));
      fireEvent.change(screen.getByLabelText("リンク先"), {
        target: { value: "https://example.com/b" },
      });
      fireEvent.click(screen.getByRole("button", { name: "適用" }));

      expect(screen.getByRole("link", { name: "https://example.com/b" })).toHaveAttribute(
        "href",
        "https://example.com/b",
      );
    });

    it("Enter でも適用する", () => {
      renderEditor({ defaultValue: '<p><a href="https://example.com/a">リンク</a></p>' });

      fireEvent.click(toolbarButton("リンク"));

      const input = screen.getByLabelText("リンク先");

      fireEvent.change(input, { target: { value: "/items/1" } });
      fireEvent.keyDown(input, { key: "Enter" });

      expect(screen.getByRole("link", { name: "リンク" })).toHaveAttribute("href", "/items/1");
    });

    it("Enter 以外のキーでは適用しない", () => {
      renderEditor({ defaultValue: '<p><a href="https://example.com/a">リンク</a></p>' });

      fireEvent.click(toolbarButton("リンク"));

      const input = screen.getByLabelText("リンク先");

      fireEvent.change(input, { target: { value: "https://example.com/b" } });
      fireEvent.keyDown(input, { key: "a" });

      expect(screen.getByLabelText("リンク先")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "リンク" })).toHaveAttribute(
        "href",
        "https://example.com/a",
      );
    });

    it("allowlist 外の protocol は適用せず、理由を入力欄へ結び付けて示す", () => {
      renderEditor({ defaultValue: '<p><a href="https://example.com/a">リンク</a></p>' });

      fireEvent.click(toolbarButton("リンク"));
      fireEvent.change(screen.getByLabelText("リンク先"), {
        target: { value: "javascript:alert(1)" },
      });
      fireEvent.click(screen.getByRole("button", { name: "適用" }));

      const input = screen.getByLabelText("リンク先");

      expect(input).toHaveAttribute("aria-invalid", "true");
      expect(input).toHaveAccessibleDescription(/http \/ https \/ mailto/);
      expect(screen.getByRole("link", { name: "リンク" })).toHaveAttribute(
        "href",
        "https://example.com/a",
      );
    });

    it("空のリンク先は適用しない", () => {
      renderEditor({ defaultValue: "<p>本文</p>" });

      fireEvent.click(toolbarButton("リンク"));
      fireEvent.click(screen.getByRole("button", { name: "適用" }));

      expect(screen.getByLabelText("リンク先")).toHaveAttribute("aria-invalid", "true");
    });

    it("入力し直すと理由の表示を取り下げる", () => {
      renderEditor({ defaultValue: "<p>本文</p>" });

      fireEvent.click(toolbarButton("リンク"));
      fireEvent.click(screen.getByRole("button", { name: "適用" }));
      fireEvent.change(screen.getByLabelText("リンク先"), {
        target: { value: "https://example.com" },
      });

      expect(screen.getByLabelText("リンク先")).toHaveAttribute("aria-invalid", "false");
      expect(screen.queryByText(/http \/ https \/ mailto/)).not.toBeInTheDocument();
    });

    it("リンクがかかっていない間は解除を押せない", () => {
      renderEditor({ defaultValue: "<p>本文</p>" });

      fireEvent.click(toolbarButton("リンク"));

      expect(toolbarButton("リンクを解除")).toBeDisabled();
    });

    it("解除するとリンクを外し、入力欄を閉じる", () => {
      renderEditor({ defaultValue: '<p><a href="https://example.com/a">リンク</a></p>' });

      fireEvent.click(toolbarButton("リンク"));
      fireEvent.click(toolbarButton("リンクを解除"));

      expect(screen.queryByRole("link")).not.toBeInTheDocument();
      expect(screen.queryByLabelText("リンク先")).not.toBeInTheDocument();
    });
  });

  describe("sanitizer の allowlist との関係", () => {
    // 一覧を書き写すのは、これが**留め金**だからである。extension を足し引きすると必ず落ち、
    // 足したものが allowlist に収まるかを人が見ることになる。対象から導出すると両辺が一緒に
    // 動いてしまい、何も止まらない。
    it("読み書きする node と mark を、この一覧に固定する", () => {
      const editor = createHeadlessEditor();

      expect(Object.keys(editor.schema.nodes).sort()).toEqual([
        "blockquote",
        "bulletList",
        "doc",
        "hardBreak",
        "heading",
        "horizontalRule",
        "listItem",
        "orderedList",
        "paragraph",
        "text",
      ]);
      expect(Object.keys(editor.schema.marks).sort()).toEqual([
        "bold",
        "code",
        "italic",
        "link",
        "strike",
      ]);

      editor.destroy();
    });

    it("editor が出せるタグが allowlist に収まる", () => {
      const editor = createHeadlessEditor();

      editor.commands.setContent(
        [
          "<h2>見出し 2</h2><h3>見出し 3</h3><h4>見出し 4</h4>",
          "<p><strong>太字</strong><em>斜体</em><s>打ち消し</s><code>コード</code>",
          '<a href="https://example.com">リンク</a><br>改行</p>',
          "<ul><li>箇条書き</li></ul><ol><li>番号付き</li></ol>",
          "<blockquote><p>引用</p></blockquote><hr>",
        ].join(""),
      );

      const tagNames = elementSignatures(fromHtml(editor.getHTML(), { fragment: true })).map(
        (signature) => signature.tagName,
      );

      expect(tagNames.length).toBeGreaterThan(0);
      expect(tagNames.filter((tagName) => !RICH_TEXT_TAG_NAMES.includes(tagName))).toEqual([]);

      editor.destroy();
    });

    it("editor の出力は sanitize を通しても変わらない", () => {
      const editor = createHeadlessEditor();

      editor.commands.setContent(
        [
          "<h2>見出し</h2>",
          '<p><strong>太字</strong><a href="https://example.com">リンク</a><br>改行</p>',
          '<p><a href="mailto:info@example.com">メール</a><a href="/items/1">アプリ内</a></p>',
          "<ul><li>箇条書き</li></ul><blockquote><p>引用</p></blockquote><hr>",
        ].join(""),
      );

      const html = editor.getHTML();

      expect(elementSignatures(SanitizedRichText.from(html).root)).toEqual(
        elementSignatures(fromHtml(html, { fragment: true })),
      );

      editor.destroy();
    });

    it("allowlist 外の protocol は editor 自身が出力しない", () => {
      const editor = createHeadlessEditor();

      editor.commands.setContent("<p>本文</p>");
      editor.commands.selectAll();
      editor.commands.setLink({ href: "javascript:alert(1)" });

      expect(editor.getHTML()).toBe("<p>本文</p>");

      editor.destroy();
    });
  });

  it("渡された id を編集面そのものへ与える", async () => {
    const controlId = "profile-bio";

    render(<RichTextEditor id={controlId} label="説明文" onChange={noop} />);

    expect(await screen.findByRole("textbox", { name: "説明文" })).toHaveAttribute("id", controlId);
  });

  it("id を渡さなければ付けない。外から指す必要が無いため", async () => {
    render(<RichTextEditor label="説明文" onChange={noop} />);

    expect(await screen.findByRole("textbox", { name: "説明文" })).not.toHaveAttribute("id");
  });

  it("a11y 自動検査に違反しない", async () => {
    const { container } = renderEditor({
      defaultValue: '<p><a href="https://example.com">リンク</a></p>',
    });

    fireEvent.click(toolbarButton("リンク"));

    const result = await axe(container, { rules: { "color-contrast": { enabled: false } } });

    expect(result.violations).toEqual([]);
  });

  // 案内は開いたときにしか DOM へ現れない。閉じたままの検査では、その中身が一度も見られない。
  it("案内を開いた状態で a11y 自動検査に違反しない", async () => {
    const { baseElement } = renderEditor({ defaultValue: "<p>本文</p>" });

    fireEvent.focus(toolbarButton("太字"));
    await screen.findByRole("tooltip");

    // 案内は portal で body の直下へ出るため、landmark の外に置かれる。これは部品を単体で
    // 描いたことによるもので、画面へ載れば landmark の内側に入る。
    const result = await axe(baseElement, {
      rules: { "color-contrast": { enabled: false }, region: { enabled: false } },
    });

    expect(result.violations).toEqual([]);
  });

  it("リンク先の誤りを出した状態で a11y 自動検査に違反しない", async () => {
    const { container } = renderEditor({ defaultValue: "<p>本文</p>" });

    fireEvent.click(toolbarButton("リンク"));
    fireEvent.change(screen.getByLabelText("リンク先"), { target: { value: "javascript:x" } });
    fireEvent.click(screen.getByRole("button", { name: "適用" }));

    const result = await axe(container, { rules: { "color-contrast": { enabled: false } } });

    expect(result.violations).toEqual([]);
  });

  it("プレビューの状態で a11y 自動検査に違反しない", async () => {
    const { container } = renderEditor({
      defaultValue: "<h2>見出し</h2><ul><li>項目</li></ul><blockquote><p>引用</p></blockquote>",
    });

    fireEvent.click(toolbarButton("プレビュー"));

    const result = await axe(container, { rules: { "color-contrast": { enabled: false } } });

    expect(result.violations).toEqual([]);
  });

  it("読み取り専用の状態で a11y 自動検査に違反しない", async () => {
    const { container } = renderEditor({ defaultValue: "<p>本文</p>", disabled: true });

    const result = await axe(container, { rules: { "color-contrast": { enabled: false } } });

    expect(result.violations).toEqual([]);
  });
});
