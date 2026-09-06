// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

const { placeOrderAction } = vi.hoisted(() => ({ placeOrderAction: vi.fn() }));

vi.mock("../../../actions", () => ({ placeOrderAction }));

import { failedActionState, succeededActionState } from "@/model/action-state";
import { IDEMPOTENCY_KEY_FIELD } from "@/model/idempotency-key";

import { PlaceOrderStateProvider, usePlaceOrderState } from "./place-order-state";

const KEY = "0195f0c2-0000-7000-a000-000000000001";
const OTHER_KEY = "0195f0c2-0000-7000-a000-000000000002";

/** 器から読んだものを、そのまま見える形に出す姿。名前で 2 つを見分ける。 */
function Consumer({ name }: { name: string }) {
  const { formAction, state, isPending, idempotencyKey } = usePlaceOrderState();

  return (
    <form action={formAction}>
      <input name={IDEMPOTENCY_KEY_FIELD} type="hidden" value={idempotencyKey} />
      <p>{`${name}:${isPending ? "待っている" : "待っていない"}`}</p>
      <p>{`${name}:${state.status === "error" ? (state.formError ?? "") : "理由なし"}`}</p>
      <button type="submit">{`${name} から送る`}</button>
    </form>
  );
}

beforeEach(() => {
  placeOrderAction.mockReset();
  placeOrderAction.mockResolvedValue(succeededActionState(undefined));
});

describe("PlaceOrderStateProvider", () => {
  it("受け取った鍵を、器の中のどの姿へも同じ値で配る", () => {
    const { container } = render(
      <PlaceOrderStateProvider idempotencyKey={KEY}>
        <Consumer name="脇" />
        <Consumer name="帯" />
      </PlaceOrderStateProvider>,
    );

    const keys = [...container.querySelectorAll(`input[name="${IDEMPOTENCY_KEY_FIELD}"]`)].map(
      (input) => input.getAttribute("value"),
    );

    expect(keys).toEqual([KEY, KEY]);
  });

  it("組み直された画面から別の鍵が届いても、配る鍵は変えない", () => {
    const { container, rerender } = render(
      <PlaceOrderStateProvider idempotencyKey={KEY}>
        <Consumer name="脇" />
      </PlaceOrderStateProvider>,
    );

    rerender(
      <PlaceOrderStateProvider idempotencyKey={OTHER_KEY}>
        <Consumer name="脇" />
      </PlaceOrderStateProvider>,
    );

    expect(container.querySelector(`input[name="${IDEMPOTENCY_KEY_FIELD}"]`)).toHaveValue(KEY);
  });

  it("片方の姿から送った失敗を、もう片方の姿も読む", async () => {
    placeOrderAction.mockResolvedValue(failedActionState({ formError: "在庫が変わりました。" }));

    render(
      <PlaceOrderStateProvider idempotencyKey={KEY}>
        <Consumer name="脇" />
        <Consumer name="帯" />
      </PlaceOrderStateProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: "帯 から送る" }));

    expect(await screen.findByText("脇:在庫が変わりました。")).toBeVisible();
    expect(screen.getByText("帯:在庫が変わりました。")).toBeVisible();
  });

  it("片方の姿から送っているあいだ、もう片方の姿も待っている", async () => {
    placeOrderAction.mockReturnValue(new Promise(() => undefined));

    render(
      <PlaceOrderStateProvider idempotencyKey={KEY}>
        <Consumer name="脇" />
        <Consumer name="帯" />
      </PlaceOrderStateProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: "帯 から送る" }));

    expect(await screen.findByText("脇:待っている")).toBeVisible();
    expect(screen.getByText("帯:待っている")).toBeVisible();
  });

  it("a11y 自動検査に違反しない。包んだだけで支援技術への見え方を変えない", async () => {
    const { container } = render(
      <PlaceOrderStateProvider idempotencyKey={KEY}>
        <Consumer name="脇" />
      </PlaceOrderStateProvider>,
    );

    expect(
      (await axe(container, { rules: { "color-contrast": { enabled: false } } })).violations,
    ).toEqual([]);
  });
});

describe("usePlaceOrderState", () => {
  // ----- 正常系 -----
  it("まだ送っていないあいだは、待っておらず理由も持たない", () => {
    render(
      <PlaceOrderStateProvider idempotencyKey={KEY}>
        <Consumer name="脇" />
      </PlaceOrderStateProvider>,
    );

    expect(screen.getByText("脇:待っていない")).toBeVisible();
    expect(screen.getByText("脇:理由なし")).toBeVisible();
  });

  // ----- 異常系 -----
  it("器の外で読もうとしたら、その場で落とす", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(() => render(<Consumer name="器の外" />)).toThrow(
      "PlaceOrderStateProvider の外で確定の送信状態を読もうとしました",
    );

    vi.restoreAllMocks();
  });
});
