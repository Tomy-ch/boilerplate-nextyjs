// @vitest-environment jsdom

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { Button } from "@/components/design-system/action/button/button";
import { WizardForm, type WizardSteps } from "./wizard-form";

const STEPS = [
  {
    id: "applicant",
    title: "申請者",
    content: <input aria-label="氏名" defaultValue="田中" name="name" />,
  },
  {
    id: "details",
    title: "申請内容",
    content: <input aria-label="用途" defaultValue="開発" name="purpose" />,
  },
  { id: "confirm", title: "確認", content: <p>この内容で申請します。</p> },
] satisfies WizardSteps;

function WizardFixture({ steps = STEPS }: { steps?: WizardSteps } = {}) {
  return (
    <WizardForm
      label="利用申請"
      steps={steps}
      submit={
        <Button type="submit" variant="default">
          申請する
        </Button>
      }
    />
  );
}

const next = async () => await userEvent.click(screen.getByRole("button", { name: "次へ" }));
const previous = async () => await userEvent.click(screen.getByRole("button", { name: "戻る" }));

describe("WizardForm", () => {
  it("通過した段階へは進捗から直接戻れる", async () => {
    render(
      <WizardForm
        label="利用申請"
        steps={[
          { id: "a", title: "入力", content: <p>入力の中身</p> },
          { id: "b", title: "確認", content: <p>確認の中身</p> },
        ]}
        submit={<button type="submit">申請する</button>}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "次へ" }));
    await userEvent.click(screen.getByRole("button", { name: "入力" }));

    expect(screen.getByText("入力の中身")).toBeVisible();
  });

  it("前へ戻っても、通過した段階の印は残る", async () => {
    render(
      <WizardForm
        label="利用申請"
        steps={[
          { id: "a", title: "入力", content: <p>入力の中身</p> },
          { id: "b", title: "確認", content: <p>確認の中身</p> },
          { id: "c", title: "送信", content: <p>送信の中身</p> },
        ]}
        submit={<button type="submit">申請する</button>}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "次へ" }));
    await userEvent.click(screen.getByRole("button", { name: "次へ" }));
    await userEvent.click(screen.getByRole("button", { name: "入力" }));

    const [first, second] = screen.getAllByRole("listitem");

    expect(first).toHaveAttribute("data-state", "current");
    expect(second).toHaveAttribute("data-state", "complete");
  });

  it("到達した段階へは、印が付いていなくても行ける", async () => {
    render(
      <WizardForm
        label="利用申請"
        steps={[
          { id: "a", title: "入力", content: <p>入力の中身</p> },
          { id: "b", title: "確認", content: <p>確認の中身</p> },
        ]}
        submit={<button type="submit">申請する</button>}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "次へ" }));
    await userEvent.click(screen.getByRole("button", { name: "入力" }));

    // 「確認」は到達しただけで通過はしていないため印は付かないが、行けるようにする。
    const [, second] = screen.getAllByRole("listitem");
    expect(second).toHaveAttribute("data-state", "upcoming");

    await userEvent.click(screen.getByRole("button", { name: "確認" }));

    expect(screen.getByText("確認の中身")).toBeVisible();
  });

  it("進んだ数より先の段階は到達済みにならない", async () => {
    render(
      <WizardForm
        label="利用申請"
        steps={[
          { id: "a", title: "入力", content: <p>入力の中身</p> },
          { id: "b", title: "確認", content: <p>確認の中身</p> },
          { id: "c", title: "送信", content: <p>送信の中身</p> },
          { id: "d", title: "完了", content: <p>完了の中身</p> },
        ]}
        submit={<button type="submit">申請する</button>}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "次へ" }));
    await userEvent.click(screen.getByRole("button", { name: "次へ" }));
    await userEvent.click(screen.getByRole("button", { name: "入力" }));

    expect(
      [...screen.getAllByRole("listitem")].map((item) => item.getAttribute("data-state")),
    ).toEqual(["current", "complete", "upcoming", "upcoming"]);
    expect(screen.queryByRole("button", { name: "完了" })).not.toBeInTheDocument();
  });

  it("済ませた段階へ戻っても印は残る", async () => {
    render(
      <WizardForm
        label="利用申請"
        steps={[
          { id: "a", title: "入力", content: <p>入力の中身</p> },
          { id: "b", title: "確認", content: <p>確認の中身</p> },
        ]}
        submit={<button type="submit">申請する</button>}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "次へ" }));
    await userEvent.click(screen.getByRole("button", { name: "入力" }));

    const [first] = screen.getAllByRole("listitem");

    // 現在地であることは状態で示したまま、済ませた印を残す。
    expect(first).toHaveAttribute("data-state", "current");
    expect(first?.querySelector('[data-slot="stepper-item-marker"] svg')).toBeInTheDocument();
    expect(first).toHaveTextContent("現在の段階・完了");
  });

  it("今の段階を終えられないあいだは、先の段階へ進捗からも行けない", () => {
    render(
      <WizardForm
        label="利用申請"
        steps={[
          { id: "a", title: "入力", content: <p>入力の中身</p>, blocked: true },
          { id: "b", title: "確認", content: <p>確認の中身</p> },
        ]}
        submit={<button type="submit">申請する</button>}
      />,
    );

    expect(screen.getByRole("button", { name: "次へ" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "確認" })).not.toBeInTheDocument();
  });

  it("まだ到達していない段階は進捗から押せない", () => {
    render(
      <WizardForm
        label="利用申請"
        steps={[
          { id: "a", title: "入力", content: <p>入力の中身</p> },
          { id: "b", title: "確認", content: <p>確認の中身</p> },
        ]}
        submit={<button type="submit">申請する</button>}
      />,
    );

    expect(screen.queryByRole("button", { name: "確認" })).not.toBeInTheDocument();
  });

  it("段階が持つ文言があれば、その段階の次へだけ差し替える", async () => {
    render(
      <WizardForm
        label="利用申請"
        steps={[
          { id: "a", title: "入力", content: <p>入力</p>, nextLabel: "確認へ" },
          { id: "b", title: "確認", content: <p>確認</p> },
        ]}
        submit={<button type="submit">申請する</button>}
      />,
    );

    expect(screen.getByRole("button", { name: "確認へ" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "次へ" })).not.toBeInTheDocument();
  });

  it("最初の段階から始める", () => {
    render(<WizardFixture />);

    expect(screen.getByRole("group", { name: "申請者" })).toBeVisible();
    expect(screen.queryByRole("group", { name: "申請内容" })).not.toBeInTheDocument();
  });

  it("表示していない段階は支援技術からも外れる", () => {
    const { container } = render(<WizardFixture />);

    const panels = container.querySelectorAll("[data-slot='wizard-form-step']");

    expect(panels).toHaveLength(3);
    expect(screen.getAllByRole("group")).toHaveLength(1);
  });

  it("進捗として段階の並びと現在位置を示す", () => {
    render(<WizardFixture />);

    const progress = screen.getByRole("list", { name: "利用申請の進捗" });
    const currentStep = screen.getByRole("listitem", { current: "step" });

    expect(progress).toBeInTheDocument();
    expect(currentStep).toHaveTextContent("申請者");
  });

  it("次へ進むと現在位置が移る", async () => {
    render(<WizardFixture />);

    await next();

    expect(screen.getByRole("group", { name: "申請内容" })).toBeVisible();
    expect(screen.getByRole("listitem", { current: "step" })).toHaveTextContent("申請内容");
  });

  it("戻ると前の段階へ返る", async () => {
    render(<WizardFixture />);
    await next();

    await previous();

    expect(screen.getByRole("group", { name: "申請者" })).toBeVisible();
  });

  it("最初の段階では戻れない", () => {
    render(<WizardFixture />);

    expect(screen.getByRole("button", { name: "戻る" })).toBeDisabled();
  });

  it("最後の段階では次へではなく送信の操作を置く", async () => {
    render(<WizardFixture />);

    await next();
    await next();

    expect(screen.queryByRole("button", { name: "次へ" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "申請する" })).toBeInTheDocument();
  });

  it("終えられない段階からは進めない", () => {
    render(<WizardFixture steps={[{ ...STEPS[0], blocked: true }, STEPS[1], STEPS[2]]} />);

    expect(screen.getByRole("button", { name: "次へ" })).toBeDisabled();
  });

  it("終えられない段階に居るあいだは、到達済みの先の段階へも進捗から飛べない", async () => {
    // 「次へ」だけを塞いでも、進捗から飛べては同じことになる。戻る側は塞がない。
    const { rerender } = render(<WizardFixture />);

    await next();
    await previous();
    rerender(<WizardFixture steps={[{ ...STEPS[0], blocked: true }, STEPS[1], STEPS[2]]} />);

    expect(screen.getByRole("button", { name: STEPS[1].title })).toBeDisabled();
  });

  it("終えられない段階からの直行は、押しても現在地を動かさない", async () => {
    // 判定は描画と状態で共有する。描画側だけで塞ぐと、規則の変更が見た目の変更としてしか
    // 現れず、状態の側は素通しのままになる。
    const { rerender } = render(<WizardFixture />);

    await next();
    await previous();
    rerender(<WizardFixture steps={[{ ...STEPS[0], blocked: true }, STEPS[1], STEPS[2]]} />);

    await userEvent.click(screen.getByRole("button", { name: STEPS[1].title }));

    expect(screen.getByLabelText("氏名")).toBeVisible();
    expect(screen.getByLabelText("用途")).not.toBeVisible();
  });

  it("段階が減って現在地が並びの外へ出たら、先頭の段階の操作を出す", async () => {
    const { rerender } = render(<WizardFixture />);

    await next();
    await next();
    rerender(<WizardFixture steps={[{ ...STEPS[0], nextLabel: "申請内容へ" }, STEPS[1]]} />);

    expect(screen.getByRole("button", { name: "申請内容へ" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "申請する" })).not.toBeInTheDocument();
  });

  it("隠れている段階の入力値も form に残る", async () => {
    render(
      <form data-testid="wizard-host">
        <WizardFixture />
      </form>,
    );
    await next();

    const form = screen.getByTestId("wizard-host");

    expect(new FormData(form instanceof HTMLFormElement ? form : undefined).get("name")).toBe(
      "田中",
    );
  });

  it("段階が変わったら、その段階へ focus を移す", async () => {
    render(<WizardFixture />);

    await next();

    await waitFor(() => expect(screen.getByRole("group", { name: "申請内容" })).toHaveFocus());
  });

  it("最初の表示では focus を奪わない", () => {
    render(<WizardFixture />);

    expect(screen.getByRole("group", { name: "申請者" })).not.toHaveFocus();
  });

  it("操作の文言を呼び出し元が差し替えられる", () => {
    render(
      <WizardForm
        label="利用申請"
        nextLabel="次の項目へ"
        previousLabel="前の項目へ"
        steps={STEPS}
        submit={<Button type="submit">申請する</Button>}
      />,
    );

    expect(screen.getByRole("button", { name: "次の項目へ" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "前の項目へ" })).toBeInTheDocument();
  });

  it("最後の一つ手前で次へを押しても送信しない", async () => {
    const onSubmit = vi.fn((event: { preventDefault: () => void }) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <WizardFixture />
      </form>,
    );

    await next();
    await next();

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "申請する" })).toBeInTheDocument();
  });

  it("送信は呼び出し元が持つ", async () => {
    const onSubmit = vi.fn((event: { preventDefault: () => void }) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <WizardFixture />
      </form>,
    );
    await next();
    await next();

    await userEvent.click(screen.getByRole("button", { name: "申請する" }));

    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it("a11y 自動検査に違反しない", async () => {
    const { container } = render(<WizardFixture />);

    const result = await axe(container, { rules: { "color-contrast": { enabled: false } } });

    expect(result.violations).toEqual([]);
  });
});
