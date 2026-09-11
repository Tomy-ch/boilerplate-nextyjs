// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { failedActionState, idleActionState, succeededActionState } from "@/model/action-state";
import { toInquiryId } from "@/model/inquiry/inquiry";

import { REPLY_BODY_FIELD } from "../../../form-names";
import { AdminInquiryReplyForm } from "./reply-form";

const KEY = "00000000-0000-4000-8000-000000000001";

const INQUIRY_ID = toInquiryId("0198a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a60");

function renderForm(overrides: Partial<Parameters<typeof AdminInquiryReplyForm>[0]> = {}) {
  return render(
    <AdminInquiryReplyForm
      action={vi.fn()}
      idempotencyKey={KEY}
      inquiryId={INQUIRY_ID}
      pending={false}
      state={idleActionState<void, typeof REPLY_BODY_FIELD>()}
      {...overrides}
    />,
  );
}

describe("AdminInquiryReplyForm", () => {
  it("回答先を送信に載せる", () => {
    const { container } = renderForm();

    expect(container.querySelector('input[name="inquiryId"]')).toHaveValue(INQUIRY_ID);
  });

  it("冪等キーを送信に載せる", () => {
    const { container } = renderForm();

    expect(container.querySelector('input[name="idempotencyKey"]')).toHaveValue(KEY);
  });

  it("空のままでは送信できない", () => {
    renderForm();

    expect(screen.getByRole("button", { name: "回答する" })).toBeDisabled();
  });

  it("送信中は二重に送れない", () => {
    renderForm({ pending: true });

    expect(screen.getByRole("button", { name: "送信中" })).toBeDisabled();
  });

  it("修飾キーつきの Enter では送らない", async () => {
    renderForm();

    const textarea = screen.getByLabelText("回答");
    const submit = vi.fn((event: SubmitEvent) => event.preventDefault());

    textarea.closest("form")?.addEventListener("submit", submit);
    await userEvent.type(textarea, "回答");
    await userEvent.type(textarea, "{Meta>}{Enter}{/Meta}");

    expect(submit).not.toHaveBeenCalled();
  });

  it("成立したら書きかけを片付ける", async () => {
    const { rerender } = renderForm();
    const textarea = screen.getByLabelText("回答");

    await userEvent.type(textarea, "回答");
    rerender(
      <AdminInquiryReplyForm
        action={vi.fn()}
        idempotencyKey={KEY}
        inquiryId={INQUIRY_ID}
        pending={false}
        state={succeededActionState<void, typeof REPLY_BODY_FIELD>(undefined)}
      />,
    );

    expect(textarea).toHaveValue("");
  });

  it("本文の項目エラーを入力欄へ紐づける", () => {
    renderForm({
      state: failedActionState<void, typeof REPLY_BODY_FIELD>({
        fieldErrors: { [REPLY_BODY_FIELD]: ["本文を入力してください。"] },
      }),
    });

    expect(screen.getByLabelText("回答")).toHaveAttribute("aria-invalid", "true");
  });

  it("a11y 自動検査に違反しない", async () => {
    const { container } = renderForm();

    expect((await axe(container)).violations).toEqual([]);
  });
});
