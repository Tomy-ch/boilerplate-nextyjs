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

    expect(container.firstElementChild).toHaveStyle({
      height: "calc(100dvh - 57px - 2rem)",
    });
  });
});
