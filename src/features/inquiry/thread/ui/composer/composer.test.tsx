// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { failedActionState, idleActionState, succeededActionState } from "@/model/action-state";

import { INQUIRY_BODY_FIELD } from "../../../form-names";
import { InquiryComposer } from "./composer";

const KEY = "00000000-0000-4000-8000-000000000001";

function renderComposer(overrides: Partial<Parameters<typeof InquiryComposer>[0]> = {}) {
  const props = {
    action: vi.fn(),
    idempotencyKey: KEY,
    pending: false,
    state: idleActionState<void, typeof INQUIRY_BODY_FIELD>(),
    ...overrides,
  };

  return { ...render(<InquiryComposer {...props} />), props };
}

describe("InquiryComposer", () => {
  // ----- まだ書いていないとき -----
  it("本文の入力欄に名前を与える", () => {
    renderComposer();

    expect(screen.getByLabelText("お問い合わせ内容")).toBeInTheDocument();
  });

  it("契約の上限を入力欄へ渡す", () => {
    renderComposer();

    expect(screen.getByLabelText("お問い合わせ内容")).toHaveAttribute("maxLength", "4000");
  });

  it("冪等キーを送信に載せる", () => {
    const { container } = renderComposer();

    expect(container.querySelector('input[name="idempotencyKey"]')).toHaveValue(KEY);
  });

  it("空のままでは送信できない", () => {
    renderComposer();

    expect(screen.getByRole("button", { name: "送信" })).toBeDisabled();
  });

  it("空白だけでは送信できない", async () => {
    renderComposer();

    await userEvent.type(screen.getByLabelText("お問い合わせ内容"), "   ");

    expect(screen.getByRole("button", { name: "送信" })).toBeDisabled();
  });

  it("空のままでは修飾キーつきの Enter でも送らない", async () => {
    renderComposer();

    const textarea = screen.getByLabelText("お問い合わせ内容");
    const submit = vi.fn((event: SubmitEvent) => event.preventDefault());

    textarea.closest("form")?.addEventListener("submit", submit);
    await userEvent.type(textarea, "{Meta>}{Enter}{/Meta}");

    expect(submit).not.toHaveBeenCalled();
  });

  it("項目エラーが無ければ、入力欄に不正の印を付けない", () => {
    renderComposer();

    expect(screen.getByLabelText("お問い合わせ内容")).not.toHaveAttribute("aria-invalid");
  });

  it("a11y 自動検査に違反しない", async () => {
    const { container } = renderComposer();

    expect((await axe(container)).violations).toEqual([]);
  });

  // ----- 書きかけがあるとき -----
  it("本文があれば送信できる", async () => {
    renderComposer();

    await userEvent.type(screen.getByLabelText("お問い合わせ内容"), "本文");

    expect(screen.getByRole("button", { name: "送信" })).toBeEnabled();
  });

  it("修飾キーつきの Enter で送信する", async () => {
    renderComposer();

    const textarea = screen.getByLabelText("お問い合わせ内容");
    const submit = vi.fn((event: SubmitEvent) => event.preventDefault());

    textarea.closest("form")?.addEventListener("submit", submit);
    await userEvent.type(textarea, "本文");
    await userEvent.type(textarea, "{Meta>}{Enter}{/Meta}");

    expect(submit).toHaveBeenCalledOnce();
  });

  it("修飾キーの無い Enter では送らない", async () => {
    renderComposer();

    const textarea = screen.getByLabelText("お問い合わせ内容");
    const submit = vi.fn((event: SubmitEvent) => event.preventDefault());

    textarea.closest("form")?.addEventListener("submit", submit);
    await userEvent.type(textarea, "本文{Enter}");

    expect(submit).not.toHaveBeenCalled();
  });

  // ----- 送っているとき -----
  it("送信中は二重に送れない", () => {
    renderComposer({ pending: true });

    expect(screen.getByRole("button", { name: "送信中" })).toBeDisabled();
  });

  // ----- 送り終えたとき -----
  it("成立したら書きかけを片付ける", () => {
    const { rerender } = renderComposer();
    const textarea = screen.getByLabelText("お問い合わせ内容");

    rerender(
      <InquiryComposer
        action={vi.fn()}
        idempotencyKey={KEY}
        pending={false}
        state={succeededActionState<void, typeof INQUIRY_BODY_FIELD>(undefined)}
      />,
    );

    expect(textarea).toHaveValue("");
  });

  // ----- 送れなかったとき -----
  it("通らなかった送信では書きかけを残す", async () => {
    const { rerender } = renderComposer();
    const textarea = screen.getByLabelText("お問い合わせ内容");

    await userEvent.type(textarea, "打ち直したくない本文");
    rerender(
      <InquiryComposer
        action={vi.fn()}
        idempotencyKey={KEY}
        pending={false}
        state={failedActionState<void, typeof INQUIRY_BODY_FIELD>({ formError: "失敗" })}
      />,
    );

    expect(textarea).toHaveValue("打ち直したくない本文");
    // 項目に紐づかない失敗なので、入力欄そのものへ不正の印は付かない。
    expect(textarea).not.toHaveAttribute("aria-invalid");
  });

  it("本文の項目エラーを入力欄へ紐づける", () => {
    renderComposer({
      state: failedActionState<void, typeof INQUIRY_BODY_FIELD>({
        fieldErrors: { [INQUIRY_BODY_FIELD]: ["本文を入力してください。"] },
      }),
    });

    const textarea = screen.getByLabelText("お問い合わせ内容");

    expect(textarea).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("本文を入力してください。")).toBeVisible();
  });
});
