// @vitest-environment jsdom

import { render, screen, within } from "@testing-library/react";
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

  it("送り手の文字と寄せる向きを、同じ 1 通の中で対応させる", () => {
    const { container } = render(<AdminInquiryMessageList days={DAYS} pending={[]} />);
    const messages = [...container.querySelectorAll<HTMLElement>('[data-slot="message"]')];

    for (const message of messages) {
      const mine = message.getAttribute("data-align") === "end";

      // 別々に数えると、送り手と向きの対応が入れ替わっても両方の検査が通る。
      expect(within(message).getByText(mine ? /運営/ : /利用者/)).toBeVisible();
      expect(within(message).queryByText(mine ? /利用者/ : /運営/)).not.toBeInTheDocument();
    }
  });

  it("送り手ごとに吹き出しの見え方を変える", () => {
    const { container } = render(<AdminInquiryMessageList days={DAYS} pending={[]} />);
    const messages = [...container.querySelectorAll<HTMLElement>('[data-slot="message"]')];

    for (const message of messages) {
      const mine = message.getAttribute("data-align") === "end";
      const bubble = message.querySelector('[data-slot="bubble"]');

      expect(bubble).toHaveAttribute("data-variant", mine ? "default" : "muted");
    }
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
