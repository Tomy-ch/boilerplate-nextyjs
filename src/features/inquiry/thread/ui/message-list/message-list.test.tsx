// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

import { toConversationDays } from "@/model/inquiry/conversation";

import { INQUIRY_AUTHOR_KIND, type InquiryMessage } from "@/model/inquiry/inquiry";

import { HISTORY, MESSAGES } from "../../../inquiry.fixture";
import { InquiryMessageList } from "./message-list";

const DAYS = toConversationDays(HISTORY.messages);

describe("InquiryMessageList", () => {
  it("やり取りを本文として並べる", () => {
    render(<InquiryMessageList days={DAYS} pending={[]} />);

    for (const message of MESSAGES) {
      expect(screen.getByText(message.body)).toBeVisible();
    }
  });

  it("日付の区切りを、日が変わる位置に置く", () => {
    render(<InquiryMessageList days={DAYS} pending={[]} />);

    expect(screen.getByText("2026/09/01")).toBeVisible();
    expect(screen.getByText("2026/09/02")).toBeVisible();
  });

  it("誰の発言かを、向きに頼らず文字で示す", () => {
    render(<InquiryMessageList days={DAYS} pending={[]} />);

    expect(screen.getAllByText(/あなた/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/サポート/).length).toBeGreaterThan(0);
  });

  it("自分の発言を右へ、サポートを左へ寄せる", () => {
    const { container } = render(<InquiryMessageList days={DAYS} pending={[]} />);
    const messages = container.querySelectorAll('[data-slot="message"]');

    expect(messages[0]).toHaveAttribute("data-align", "end");
    expect(messages[1]).toHaveAttribute("data-align", "start");
  });

  it("送信中の 1 通を末尾に置き、送信中であることを添える", () => {
    render(<InquiryMessageList days={DAYS} pending={["追跡番号を教えてください。"]} />);

    const rows = screen.getAllByText(/追跡番号を教えてください。/);

    expect(rows).toHaveLength(1);
    expect(screen.getByText("送信中")).toBeVisible();
  });

  it("送信中が無ければ、その区画を描かない", () => {
    render(<InquiryMessageList days={DAYS} pending={[]} />);

    expect(screen.queryByText("送信中")).not.toBeInTheDocument();
  });

  it("同じ本文を続けて送っても、それぞれ並ぶ", () => {
    render(<InquiryMessageList days={[]} pending={["確認します", "確認します"]} />);

    expect(screen.getAllByText("確認します")).toHaveLength(2);
  });

  it("本文の改行を保つ", () => {
    const multiline: InquiryMessage = {
      id: "m-multiline",
      authorKind: INQUIRY_AUTHOR_KIND.user,
      body: "1 行目\n2 行目",
      sequence: 1,
      createdAt: new Date("2026-09-01T01:00:00.000Z"),
    };

    render(<InquiryMessageList days={toConversationDays([multiline])} pending={[]} />);

    expect(screen.getByText(/1 行目/)).toHaveClass("whitespace-pre-wrap");
  });

  it("何も無ければ何も描かない", () => {
    const { container } = render(<InquiryMessageList days={[]} pending={[]} />);

    expect(container.textContent).toBe("");
  });

  it("a11y 自動検査に違反しない", async () => {
    const { container } = render(
      <InquiryMessageList days={DAYS} pending={["送信中の本文"]} />,
    );

    expect((await axe(container)).violations).toEqual([]);
  });
});
