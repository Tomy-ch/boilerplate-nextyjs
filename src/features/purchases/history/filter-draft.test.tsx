// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useCallback } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { push, replace } = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace }) }));

import { PurchaseFilterDraftProvider, usePurchaseFilterDraft } from "./filter-draft";
import type { PeriodSelection } from "./period";

/** 下書きの中身と操作を、押せる形で覗く。 */
function Probe() {
  const { draft, applied, change, apply, applyInPlace, reset } = usePurchaseFilterDraft();
  const buildMonth = useCallback(
    () => change({ ...draft, kind: "month", month: "2026-07" }),
    [change, draft],
  );

  return (
    <>
      <span data-testid="kind">{draft.kind}</span>
      <span data-testid="month">{draft.month}</span>
      <span data-testid="applied">{applied === null ? "不成立" : applied.kind}</span>
      <button onClick={buildMonth} type="button">
        月を組む
      </button>
      <button onClick={apply} type="button">
        反映する
      </button>
      <button onClick={applyInPlace} type="button">
        積まずに反映する
      </button>
      <button onClick={reset} type="button">
        全期間へ戻す
      </button>
    </>
  );
}

function renderProbe(period: PeriodSelection = { kind: "all" }) {
  return render(
    <PurchaseFilterDraftProvider period={period}>
      <Probe />
    </PurchaseFilterDraftProvider>,
  );
}

beforeEach(() => {
  push.mockClear();
  replace.mockClear();
});

describe("PurchaseFilterDraftProvider", () => {
  it("効いている期間を下書きの初期値にする", () => {
    renderProbe({ kind: "month", month: "2026-07" });

    expect(screen.getByTestId("kind")).toHaveTextContent("month");
    expect(screen.getByTestId("month")).toHaveTextContent("2026-07");
  });

  it("組み立てただけでは一覧を変えない", async () => {
    renderProbe();
    await userEvent.click(screen.getByRole("button", { name: "月を組む" }));

    expect(screen.getByTestId("kind")).toHaveTextContent("month");
    expect(push).not.toHaveBeenCalled();
  });

  it("反映で、組み立てた期間の URL へ送る", async () => {
    renderProbe();
    await userEvent.click(screen.getByRole("button", { name: "月を組む" }));
    await userEvent.click(screen.getByRole("button", { name: "反映する" }));

    expect(push).toHaveBeenCalledWith("/purchases?period=month&month=2026-07");
  });

  it("積まずに反映すると、履歴を増やさずに同じ URL へ移る", async () => {
    renderProbe();
    await userEvent.click(screen.getByRole("button", { name: "月を組む" }));
    await userEvent.click(screen.getByRole("button", { name: "積まずに反映する" }));

    expect(replace).toHaveBeenCalledWith("/purchases?period=month&month=2026-07");
    expect(push).not.toHaveBeenCalled();
  });

  it("全期間へ戻すと、下書きも一覧も全期間になり、履歴は差し替わる", async () => {
    renderProbe({ kind: "month", month: "2026-07" });
    await userEvent.click(screen.getByRole("button", { name: "全期間へ戻す" }));

    expect(screen.getByTestId("kind")).toHaveTextContent("all");
    expect(replace).toHaveBeenCalledWith("/purchases");
    expect(push).not.toHaveBeenCalled();
  });

  it("効いている期間が外から変わったら、下書きを捨ててそちらへ揃える", async () => {
    const { rerender } = renderProbe();

    await userEvent.click(screen.getByRole("button", { name: "月を組む" }));
    rerender(
      <PurchaseFilterDraftProvider period={{ kind: "recent", days: 7 }}>
        <Probe />
      </PurchaseFilterDraftProvider>,
    );

    expect(screen.getByTestId("kind")).toHaveTextContent("recent");
    expect(screen.getByTestId("month")).toBeEmptyDOMElement();
  });

  it("成り立っていない組み立てでは反映しない", async () => {
    render(
      <PurchaseFilterDraftProvider period={{ kind: "all" }}>
        <Incomplete />
      </PurchaseFilterDraftProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: "月にする" }));
    await userEvent.click(screen.getByRole("button", { name: "反映する" }));
    await userEvent.click(screen.getByRole("button", { name: "積まずに反映する" }));

    expect(screen.getByTestId("applied")).toHaveTextContent("不成立");
    expect(push).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });
});

/** 必須を欠いたまま反映を押すための覗き窓。 */
function Incomplete() {
  const { draft, applied, change, apply, applyInPlace } = usePurchaseFilterDraft();
  const toMonth = useCallback(() => change({ ...draft, kind: "month" }), [change, draft]);

  return (
    <>
      <span data-testid="applied">{applied === null ? "不成立" : applied.kind}</span>
      <button onClick={toMonth} type="button">
        月にする
      </button>
      <button onClick={apply} type="button">
        反映する
      </button>
      <button onClick={applyInPlace} type="button">
        積まずに反映する
      </button>
    </>
  );
}

describe("usePurchaseFilterDraft", () => {
  it("供給の外では、その場で失敗させる", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(() => render(<Probe />)).toThrow("PurchaseFilterDraftProvider の外で");

    spy.mockRestore();
  });
});
