// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import type { ScrollDirection } from "@/capabilities/use-scroll-direction";
import { APP_SHELL_HEADER_HEIGHT } from "@/components/shell/app-shell/app-shell.definition";

const { useScrollDirection } = vi.hoisted(() => ({
  useScrollDirection: vi.fn<() => ScrollDirection>(),
}));

vi.mock("@/capabilities/use-scroll-direction", () => ({ useScrollDirection }));

// 既定のスタブは何も通知しない。帯の高さは通知されて初めて配られるため、ここでは観測した時点で
// 1 度返す実装へ差し替える。
class ReportingResizeObserver implements ResizeObserver {
  private readonly notify: ResizeObserverCallback;

  constructor(notify: ResizeObserverCallback) {
    this.notify = notify;
  }

  observe(): void {
    this.notify([], this);
  }
  unobserve(): void {}
  disconnect(): void {}
}

import { ProductStickyAside, ProductStickyBar, ProductStickyRegion } from "./sticky-region";

/** 帯の高さを持たせた器。jsdom は自分では高さを持たない。 */
const BAR_HEIGHT = 40;

function renderRegion() {
  return render(
    <ProductStickyRegion>
      <ProductStickyBar>
        <p>検索と並び替え</p>
      </ProductStickyBar>
      <ProductStickyAside>
        <p>絞り込み</p>
      </ProductStickyAside>
    </ProductStickyRegion>,
  );
}

/** 器の中の 1 つ目の要素。無ければテストの前提が崩れている。 */
function firstChild(parent: Element): HTMLElement {
  const found = parent.firstElementChild;

  if (!(found instanceof HTMLElement)) {
    throw new Error("器の中に要素がありません");
  }

  return found;
}

function bar(container: HTMLElement): HTMLElement {
  return firstChild(container);
}

function asideInner(): HTMLElement {
  return firstChild(screen.getByRole("complementary", { name: "絞り込み条件" }));
}

beforeEach(() => {
  useScrollDirection.mockReturnValue("up");
  vi.stubGlobal("ResizeObserver", ReportingResizeObserver);
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(BAR_HEIGHT);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("ProductStickyRegion", () => {
  it("中身をそのまま並べる", () => {
    renderRegion();

    expect(screen.getByText("検索と並び替え")).toBeInTheDocument();
    expect(screen.getByText("絞り込み")).toBeInTheDocument();
  });

  // ----- 供給の外で使われたとき -----
  it("外で貼り付きの状態を読むと例外を投げる", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(() =>
      render(
        <ProductStickyBar>
          <p>帯</p>
        </ProductStickyBar>,
      ),
    ).toThrow("ProductStickyRegion の外で貼り付きの状態を読もうとしました");
  });
});

describe("ProductStickyBar", () => {
  it("上へ戻ろうとしているあいだは header の直下で止まる", () => {
    const { container } = renderRegion();

    expect(bar(container).className).toContain("sticky");
    expect(bar(container).style.top).toBe(`${APP_SHELL_HEADER_HEIGHT}px`);
  });

  it("下へ読み進めているあいだは貼り付きをやめ、本来の位置より上へ行かない", () => {
    useScrollDirection.mockReturnValue("down");

    const { container } = renderRegion();

    expect(bar(container).className).toContain("static");
    expect(bar(container).className).not.toContain("sticky");
    expect(bar(container).style.top).toBe("");
  });

  it("下を通る中身が透けないよう背景を敷く", () => {
    const { container } = renderRegion();

    expect(bar(container).className).toContain("bg-background");
  });
});

describe("ProductStickyAside", () => {
  it("脇の領域として名前を持つ", () => {
    renderRegion();

    expect(screen.getByRole("complementary", { name: "絞り込み条件" })).toBeInTheDocument();
  });

  it("帯が出ているあいだは、その高さのぶん下で止まる", () => {
    renderRegion();

    expect(asideInner().style.top).toBe(`${APP_SHELL_HEADER_HEIGHT + BAR_HEIGHT + 12}px`);
  });

  it("帯が退いているあいだは header の直下まで上がる", () => {
    useScrollDirection.mockReturnValue("down");

    renderRegion();

    expect(asideInner().style.top).toBe(`${APP_SHELL_HEADER_HEIGHT + 12}px`);
  });

  it("画面に収まらない高さになったら自分の中で送る", () => {
    renderRegion();

    expect(asideInner().className).toContain("overflow-y-auto");
    expect(asideInner().style.maxHeight).toContain("100dvh");
  });

  it("a11y 自動検査に違反しない", async () => {
    const { container } = renderRegion();

    expect((await axe(container)).violations).toEqual([]);
  });
});
