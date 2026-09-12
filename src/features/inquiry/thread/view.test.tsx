// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

vi.mock("./ui/conversation/conversation", () => ({
  InquiryConversation: () => <p>やり取り</p>,
}));

import { HISTORY } from "../inquiry.fixture";
import { InquiryThreadView } from "./view";

describe("InquiryThreadView", () => {
  it("やり取りを画面の本体として出す", () => {
    render(<InquiryThreadView history={HISTORY} />);

    expect(screen.getByText("やり取り")).toBeVisible();
  });

  it("画面の名前を、見えない見出しとして置く", () => {
    render(<InquiryThreadView history={HISTORY} />);

    expect(screen.getByRole("heading", { level: 1, name: "お問い合わせ" })).toHaveClass("sr-only");
  });

  it("器の高さを確定させ、画面ごとは流れないようにする", () => {
    const { container } = render(<InquiryThreadView history={HISTORY} />);

    // 正規化の順序は比較の主題ではない。器の高さが、画面の高さから header と余白を引いた値であること。
    const height = container.firstElementChild?.getAttribute("style") ?? "";

    expect(height).toContain("100dvh");
    expect(height).toContain("57px");
    expect(height).toContain("2rem");
  });

  it("a11y 自動検査に違反しない", async () => {
    const { container } = render(<InquiryThreadView history={HISTORY} />);

    expect((await axe(container)).violations).toEqual([]);
  });
});
