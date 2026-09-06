// @vitest-environment jsdom

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

import { failedActionState, idleActionState } from "@/model/action-state";
import { SESSION_ROLE, type Session } from "@/model/session";

import type { DiscardDevSessionAction } from "../../form-state";
import { CurrentSession } from "./current-session";

const SESSION: Session = {
  userId: "dev-user",
  role: SESSION_ROLE.user,
  expiresAt: new Date("2026-08-18T12:00:00+09:00"),
};

/** 何も起きない送信先。表示だけを見る試験で使う。 */
const discard: DiscardDevSessionAction = async () => idleActionState();

describe("CurrentSession", () => {
  it("いまの session の身元・役割・失効を出す", () => {
    render(<CurrentSession action={discard} session={SESSION} />);

    expect(screen.getByText("dev-user")).toBeVisible();
    expect(screen.getByText(SESSION_ROLE.user)).toBeVisible();
    expect(screen.getByText("2026/08/18 12:00")).toBeVisible();
  });

  it("捨てる操作を出す", () => {
    render(<CurrentSession action={discard} session={SESSION} />);

    expect(screen.getByRole("button", { name: "session を捨てる" })).toBeEnabled();
  });

  it("捨てている間は、押せなくしたうえで進行を読み上げる", async () => {
    const user = userEvent.setup();
    let settle: (() => void) | undefined;
    const pendingDiscard: DiscardDevSessionAction = () =>
      new Promise((resolve) => {
        settle = () => resolve(idleActionState());
      });

    render(<CurrentSession action={pendingDiscard} session={SESSION} />);
    await user.click(screen.getByRole("button", { name: "session を捨てる" }));

    expect(await screen.findByRole("button", { name: "session を捨てています" })).toBeDisabled();

    settle?.();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "session を捨てる" })).toBeEnabled(),
    );
  });
  it("持っていないときは、その旨だけを出す", () => {
    render(<CurrentSession action={discard} session={null} />);

    expect(screen.getByText("いま session は持っていません。")).toBeVisible();
    expect(screen.queryByRole("button", { name: "session を捨てる" })).not.toBeInTheDocument();
  });

  it("捨てられなかったときは、その操作の隣に理由を出す", async () => {
    const user = userEvent.setup();
    const failingDiscard: DiscardDevSessionAction = async () =>
      failedActionState({ formError: "現在サービスを利用できません。" });

    render(<CurrentSession action={failingDiscard} session={SESSION} />);
    await user.click(screen.getByRole("button", { name: "session を捨てる" }));

    expect(await screen.findByText("session を捨てられませんでした")).toBeVisible();
    expect(screen.getByText("現在サービスを利用できません。")).toBeVisible();
  });

  it("捨てられなかった理由が無ければ、見出しごと出さない", async () => {
    const user = userEvent.setup();
    const silentDiscard: DiscardDevSessionAction = async () => failedActionState({});

    render(<CurrentSession action={silentDiscard} session={SESSION} />);
    await user.click(screen.getByRole("button", { name: "session を捨てる" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "session を捨てる" })).toBeEnabled(),
    );

    expect(screen.queryByText("session を捨てられませんでした")).not.toBeInTheDocument();
  });

  it("Access Token を出さない", () => {
    render(<CurrentSession action={discard} session={SESSION} />);

    expect(screen.queryByText(/Access Token/)).not.toBeInTheDocument();
  });

  it("a11y 自動検査に違反しない", async () => {
    const { container } = render(<CurrentSession action={discard} session={SESSION} />);

    expect((await axe(container)).violations).toEqual([]);
  });
});
