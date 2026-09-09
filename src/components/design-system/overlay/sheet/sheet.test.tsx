// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type SyntheticEvent, useCallback, useId } from "react";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetOverlay,
  SheetPortal,
  SheetTitle,
  SheetTrigger,
} from "./sheet";
import { SHEET_SIDE, type SheetSide } from "./sheet.definition";

function SheetFixture({
  defaultOpen = false,
  showCloseButton = true,
  side,
}: {
  defaultOpen?: boolean;
  showCloseButton?: boolean;
  side?: SheetSide;
}) {
  return (
    <Sheet defaultOpen={defaultOpen}>
      <SheetTrigger>メニューを開く</SheetTrigger>
      <SheetContent showCloseButton={showCloseButton} side={side}>
        <SheetHeader>
          <SheetTitle>メニュー</SheetTitle>
          <SheetDescription>各セクションへ移動します。</SheetDescription>
        </SheetHeader>
        <SheetFooter>
          <SheetClose>戻る</SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function FormSheetFixture({ onSubmitted }: { onSubmitted: (entries: FormData) => void }) {
  const keywordId = useId();
  const handleSubmit = useCallback(
    (event: SyntheticEvent<HTMLFormElement>) => {
      event.preventDefault();
      onSubmitted(new FormData(event.currentTarget));
    },
    [onSubmitted],
  );

  return (
    <Sheet defaultOpen>
      <SheetTrigger>絞り込み</SheetTrigger>
      <SheetContent>
        <SheetTitle>絞り込み</SheetTitle>
        <SheetDescription>条件を指定します。</SheetDescription>
        <form onSubmit={handleSubmit}>
          <label htmlFor={keywordId}>キーワード</label>
          <input defaultValue="標準" id={keywordId} name="keyword" />
          <button type="submit">適用</button>
        </form>
      </SheetContent>
    </Sheet>
  );
}

describe("Sheet", () => {
  it("開くまで内容を表示しない", () => {
    render(<SheetFixture />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("trigger の操作で開き、title と説明を関連付ける", async () => {
    render(<SheetFixture />);

    await userEvent.click(screen.getByRole("button", { name: "メニューを開く" }));

    const content = screen.getByRole("dialog", { name: "メニュー" });

    expect(content).toHaveAttribute("data-slot", "sheet-content");
    expect(content).toHaveAccessibleDescription("各セクションへ移動します。");
  });

  it("title を見出しとして描画し、内容のアクセシブルな名前にする", () => {
    render(<SheetFixture defaultOpen />);

    expect(screen.getByRole("heading", { name: "メニュー" })).toHaveAttribute(
      "data-slot",
      "sheet-title",
    );
  });

  it("不可逆操作の確認用ではないため alertdialog ではなく dialog の意味論を持つ", () => {
    render(<SheetFixture defaultOpen />);

    expect(screen.getByRole("dialog", { name: "メニュー" })).toBeInTheDocument();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("既定では画面右端へ縦長に固定する", () => {
    render(<SheetFixture defaultOpen />);

    expect(screen.getByRole("dialog", { name: "メニュー" })).toHaveClass(
      "inset-y-0",
      "right-0",
      "h-full",
    );
  });

  it("side で指定した画面端へ固定する", () => {
    render(<SheetFixture defaultOpen side={SHEET_SIDE.BOTTOM} />);

    expect(screen.getByRole("dialog", { name: "メニュー" })).toHaveClass(
      "inset-x-0",
      "bottom-0",
      "h-auto",
    );
  });

  it("右上の閉じる操作は読み上げ可能な名前を持ち、押すと閉じる", async () => {
    render(<SheetFixture defaultOpen />);

    await userEvent.click(screen.getByRole("button", { name: "閉じる" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("showCloseButton を false にすると右上の閉じる操作を描画しない", () => {
    render(<SheetFixture defaultOpen showCloseButton={false} />);

    expect(screen.queryByRole("button", { name: "閉じる" })).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "メニュー" })).toBeInTheDocument();
  });

  it("SheetClose で内容側からも閉じられる", async () => {
    render(<SheetFixture defaultOpen />);

    await userEvent.click(screen.getByRole("button", { name: "戻る" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("Escape で閉じる", async () => {
    render(<SheetFixture defaultOpen />);

    await userEvent.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("Portal へ描画しても内容の form が name と value を送信値として保つ", async () => {
    const onSubmitted = vi.fn<(entries: FormData) => void>();

    render(<FormSheetFixture onSubmitted={onSubmitted} />);

    await userEvent.click(screen.getByRole("button", { name: "適用" }));

    expect(onSubmitted).toHaveBeenCalledTimes(1);
    expect(onSubmitted.mock.lastCall?.[0].get("keyword")).toBe("標準");
  });

  it("SheetPortal と SheetOverlay を直接指定して描画先と背面を差し替えられる", () => {
    render(
      <Sheet defaultOpen>
        <SheetTrigger>開く</SheetTrigger>
        <SheetPortal>
          <SheetOverlay data-testid="overlay" />
          <SheetContent showCloseButton={false} side={SHEET_SIDE.LEFT}>
            <SheetTitle>差し替え</SheetTitle>
            <SheetDescription>背面と描画先を明示した場合の構成です。</SheetDescription>
          </SheetContent>
        </SheetPortal>
      </Sheet>,
    );

    expect(screen.getByTestId("overlay")).toHaveAttribute("data-slot", "sheet-overlay");
    expect(screen.getByRole("dialog", { name: "差し替え" })).toBeInTheDocument();
  });

  it("上端を指定すると画面上端へ横長に固定する", () => {
    render(<SheetFixture defaultOpen side={SHEET_SIDE.TOP} />);

    expect(screen.getByRole("dialog", { name: "メニュー" })).toHaveClass(
      "inset-x-0",
      "top-0",
      "h-auto",
    );
  });

  it("開いた状態で a11y 自動検査に違反しない", async () => {
    const { baseElement } = render(<SheetFixture defaultOpen />);

    const result = await axe(baseElement, { rules: { "color-contrast": { enabled: false } } });

    expect(result.violations).toEqual([]);
  });
});

describe("SheetTrigger", () => {
  it("開く操作として slot を持つ要素を描画する", () => {
    render(<SheetFixture />);

    expect(screen.getByRole("button", { name: "メニューを開く" })).toHaveAttribute(
      "data-slot",
      "sheet-trigger",
    );
  });

  it("押すと内容を開く", async () => {
    render(<SheetFixture />);

    await userEvent.click(screen.getByRole("button", { name: "メニューを開く" }));

    expect(screen.getByRole("dialog")).toBeVisible();
  });
});

describe("SheetPortal", () => {
  it("内容を呼び出し位置の外へ描画する", () => {
    const { container } = render(<SheetFixture defaultOpen />);

    expect(screen.getByRole("dialog")).toBeVisible();
    expect(container.querySelector('[data-slot="sheet-content"]')).toBeNull();
  });
});

describe("SheetOverlay", () => {
  it("開いている間だけ背面の覆いを描画する", () => {
    render(<SheetFixture defaultOpen />);

    expect(document.querySelector('[data-slot="sheet-overlay"]')).not.toBeNull();
  });

  it("閉じている間は背面の覆いを描画しない", () => {
    render(<SheetFixture />);

    expect(document.querySelector('[data-slot="sheet-overlay"]')).toBeNull();
  });
});

describe("SheetContent", () => {
  it("開いた内容として slot を持つ要素を描画する", () => {
    render(<SheetFixture defaultOpen />);

    expect(screen.getByRole("dialog")).toHaveAttribute("data-slot", "sheet-content");
  });

  it("閉じている間は内容を描画しない", () => {
    render(<SheetFixture />);

    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("SheetHeader", () => {
  it("見出し枠として slot を持つ要素を描画する", () => {
    render(<SheetFixture defaultOpen />);

    expect(document.querySelector('[data-slot="sheet-header"]')).not.toBeNull();
  });
});

describe("SheetFooter", () => {
  it("操作枠として slot を持つ要素を描画する", () => {
    render(<SheetFixture defaultOpen />);

    expect(document.querySelector('[data-slot="sheet-footer"]')).not.toBeNull();
  });
});

describe("SheetTitle", () => {
  it("題名として slot を持つ要素を描画する", () => {
    render(<SheetFixture defaultOpen />);

    expect(screen.getByText("メニュー")).toHaveAttribute("data-slot", "sheet-title");
  });
});

describe("SheetDescription", () => {
  it("補足として slot を持つ要素を描画する", () => {
    render(<SheetFixture defaultOpen />);

    expect(screen.getByText("各セクションへ移動します。")).toHaveAttribute(
      "data-slot",
      "sheet-description",
    );
  });
});

describe("SheetClose", () => {
  it("閉じる操作として slot を持つ要素を描画する", () => {
    render(<SheetFixture defaultOpen />);

    expect(screen.getByRole("button", { name: "戻る" })).toHaveAttribute(
      "data-slot",
      "sheet-close",
    );
  });

  it("押すと内容を閉じる", async () => {
    render(<SheetFixture defaultOpen />);

    await userEvent.click(screen.getByRole("button", { name: "戻る" }));

    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
