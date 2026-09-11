// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

import { ConnectionStatus } from "./connection-status";

describe("ConnectionStatus", () => {
  // ----- 正常系 -----
  it("渡した文言を見出しと領域名に表示する", () => {
    render(<ConnectionStatus title="見出し" />);

    expect(screen.getByRole("region", { name: "見出し" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "見出し" })).toBeVisible();
  });

  it("アクセシビリティ違反を持たない", async () => {
    const { container } = render(<ConnectionStatus title="見出し" />);

    expect((await axe(container)).violations).toEqual([]);
  });
});
