// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

import { INQUIRY_PATH } from "../../../../inquiry/facade/paths/paths";
import { ProductContactButton } from "./contact-button";

describe("ProductContactButton", () => {
  it("問い合わせの入口を link として出す", () => {
    render(<ProductContactButton />);

    expect(screen.getByRole("link", { name: "お問い合わせ" })).toBeInTheDocument();
  });

  it("問い合わせの画面を行き先にする", () => {
    render(<ProductContactButton />);

    expect(screen.getByRole("link", { name: "お問い合わせ" })).toHaveAttribute(
      "href",
      INQUIRY_PATH,
    );
  });

  it("a11y 自動検査に違反しない", async () => {
    const { container } = render(<ProductContactButton />);

    expect((await axe(container)).violations).toEqual([]);
  });
});
