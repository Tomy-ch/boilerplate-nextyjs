// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

import { ConnectionStatus } from "./connection-status";
import { CONNECTION_STATUS } from "./connection-status.definition";

describe("ConnectionStatus", () => {
  it("状態に対応する文言を出す", () => {
    render(<ConnectionStatus status={CONNECTION_STATUS.RECEIVING} />);

    expect(screen.getByText("受信中")).toBeInTheDocument();
  });

  it("状態の変化を、割り込まずに伝える意味論を持つ", () => {
    render(<ConnectionStatus status={CONNECTION_STATUS.RECONNECTING} />);

    const status = screen.getByRole("status");

    expect(status).toHaveAttribute("aria-live", "polite");
  });

  it("状態を data 属性として公開する", () => {
    render(<ConnectionStatus status={CONNECTION_STATUS.OFFLINE} />);

    expect(screen.getByRole("status")).toHaveAttribute("data-status", "offline");
  });

  it("すべての状態が文言を持つ", () => {
    for (const status of Object.values(CONNECTION_STATUS)) {
      const { unmount } = render(<ConnectionStatus status={status} />);

      expect(screen.getByRole("status").textContent).not.toBe("");

      unmount();
    }
  });

  it("色だけで区別させない", () => {
    const { rerender } = render(<ConnectionStatus status={CONNECTION_STATUS.HALTED} />);
    const halted = screen.getByRole("status").textContent;

    rerender(<ConnectionStatus status={CONNECTION_STATUS.EXPIRED} />);

    expect(screen.getByRole("status").textContent).not.toBe(halted);
  });

  it("呼び出し元の属性をそのまま渡す", () => {
    render(<ConnectionStatus className="mx-auto" status={CONNECTION_STATUS.CONNECTING} />);

    expect(screen.getByRole("status")).toHaveClass("mx-auto");
  });

  it("a11y 自動検査に違反しない", async () => {
    const { container } = render(<ConnectionStatus status={CONNECTION_STATUS.RECEIVING} />);

    expect((await axe(container)).violations).toEqual([]);
  });
});
