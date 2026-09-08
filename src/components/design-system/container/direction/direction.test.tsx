// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { DirectionProvider, useDirection } from "./direction";
import { DIRECTION, type DirectionValue } from "./direction.definition";

beforeAll(() => {
  // Radix が位置計算に使う API を jsdom が持たないため、実装を変えずにここで補う。
  Element.prototype.scrollIntoView = vi.fn();
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

function DirectionProbe() {
  return <span data-testid="probe">{useDirection()}</span>;
}

function Fixture({ dir, direction }: { dir?: DirectionValue; direction?: DirectionValue }) {
  return (
    <DirectionProvider dir={dir} direction={direction}>
      <DirectionProbe />
    </DirectionProvider>
  );
}

describe("DirectionProvider", () => {
  it("省略時は ltr を配る", () => {
    render(<Fixture />);

    expect(screen.getByTestId("probe")).toHaveTextContent(DIRECTION.LTR);
  });

  it("dir で指定した向きを配る", () => {
    render(<Fixture dir={DIRECTION.RTL} />);

    expect(screen.getByTestId("probe")).toHaveTextContent(DIRECTION.RTL);
  });

  it("別名の direction でも同じ向きを配る", () => {
    render(<Fixture direction={DIRECTION.RTL} />);

    expect(screen.getByTestId("probe")).toHaveTextContent(DIRECTION.RTL);
  });

  it("dir と direction の両方があるときは direction を優先する", () => {
    render(<Fixture dir={DIRECTION.LTR} direction={DIRECTION.RTL} />);

    expect(screen.getByTestId("probe")).toHaveTextContent(DIRECTION.RTL);
  });

  it("入れ子にすると内側の Provider の向きが勝つ", () => {
    render(
      <DirectionProvider dir={DIRECTION.RTL}>
        <DirectionProvider dir={DIRECTION.LTR}>
          <DirectionProbe />
        </DirectionProvider>
      </DirectionProvider>,
    );

    expect(screen.getByTestId("probe")).toHaveTextContent(DIRECTION.LTR);
  });

  it("DOM の dir 属性は設定せず、context だけを配る", () => {
    const { container } = render(<Fixture dir={DIRECTION.RTL} />);

    expect(container.querySelector("[dir]")).not.toBeInTheDocument();
  });

  it("a11y 自動検査に違反しない", async () => {
    const { container } = render(<Fixture dir={DIRECTION.RTL} />);

    const result = await axe(container, { rules: { "color-contrast": { enabled: false } } });

    expect(result.violations).toEqual([]);
  });
});

describe("useDirection", () => {
  it("Provider が無い場合は ltr を返す", () => {
    render(<DirectionProbe />);

    expect(screen.getByTestId("probe")).toHaveTextContent(DIRECTION.LTR);
  });
});
