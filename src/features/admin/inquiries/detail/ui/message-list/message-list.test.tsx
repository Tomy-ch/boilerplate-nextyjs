// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

import { toConversationDays } from "@/model/inquiry/conversation";

import { ADMIN_INQUIRY_HISTORY } from "../../../inquiries.fixture";
import { AdminInquiryMessageList } from "./message-list";

const DAYS = toConversationDays(ADMIN_INQUIRY_HISTORY.messages);

describe("AdminInquiryMessageList", () => {
  it("やり取りを本文として並べる", () => {
    render(<AdminInquiryMessageList days={DAYS} pending={[]} />);

    expect(screen.getByText(ADMIN_INQUIRY_HISTORY.messages[0]?.body ?? "")).toBeVisible();
  });

  it("運営の発言を右へ、利用者を左へ寄せる", () => {
    const { container } = render(<AdminInquiryMessageList days={DAYS} pending={[]} />);
    const messages = container.querySelectorAll('[data-slot="message"]');

    expect(messages[0]).toHaveAttribute("data-align", "start");
    expect(messages[1]).toHaveAttribute("data-align", "end");
  });

  it("送り手を、向きに頼らず文字で示す", () => {
    render(<AdminInquiryMessageList days={DAYS} pending={[]} />);

    expect(screen.getAllByText(/利用者/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/運営/).length).toBeGreaterThan(0);
  });

  it("送信中の回答を末尾に置く", () => {
    render(
      <AdminInquiryMessageList
        days={DAYS}
        pending={[{ id: "draft-1", body: "確認しております。" }]}
      />,
    );

    expect(screen.getByText("確認しております。")).toBeVisible();
    expect(screen.getByText("送信中")).toBeVisible();
  });

  it("a11y 自動検査に違反しない", async () => {
    const { container } = render(<AdminInquiryMessageList days={DAYS} pending={[]} />);

    expect((await axe(container)).violations).toEqual([]);
  });
});
