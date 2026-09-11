// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

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

  it("器の高さを確定させ、画面ごとは流れないようにする", () => {
    const { container } = render(<InquiryThreadView history={HISTORY} />);

    // 正規化の順序は比較の主題ではない。器の高さが、画面の高さから header と余白を引いた値であること。
    const height = container.firstElementChild?.getAttribute("style") ?? "";

    expect(height).toContain("100dvh");
    expect(height).toContain("57px");
    expect(height).toContain("2rem");
  });
});
