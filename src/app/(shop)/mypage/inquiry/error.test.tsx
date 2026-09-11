// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import InquiryError from "./error";

const DIGEST = "2741564515";

/** `digest` は `null` を渡すと省略した状態になる。省略値と既定値を取り違えないための形。 */
function renderError(digest: string | null = DIGEST) {
  const error = new Error("connect ECONNREFUSED 127.0.0.1:8080");

  return render(
    <InquiryError
      error={digest === null ? error : Object.assign(error, { digest })}
      reset={vi.fn()}
    />,
  );
}

describe("InquiryError", () => {
  it("生のエラー本文を出さずに正規化済みの文言を出す", () => {
    renderError();

    expect(screen.queryByText(/ECONNREFUSED/)).not.toBeInTheDocument();
    expect(screen.getByText(/問題が発生しました/)).toBeVisible();
  });

  it("サーバログと突合できる識別子を出す", () => {
    renderError();

    expect(screen.getByText(new RegExp(DIGEST))).toBeVisible();
  });

  it("識別子が無いときは問い合わせ ID を出さない", () => {
    renderError(null);

    expect(screen.queryByText(/問い合わせ ID/)).not.toBeInTheDocument();
  });

  it("再試行が境界の reset を呼ぶ", async () => {
    const user = userEvent.setup();
    const reset = vi.fn();

    render(<InquiryError error={new Error("失敗")} reset={reset} />);
    await user.click(screen.getByRole("button", { name: "再試行" }));

    expect(reset).toHaveBeenCalledOnce();
  });

  it("a11y 自動検査に違反しない", async () => {
    const { container } = renderError();

    expect(
      (await axe(container, { rules: { "color-contrast": { enabled: false } } })).violations,
    ).toEqual([]);
  });
});
