// @vitest-environment jsdom

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

const { placeOrderAction } = vi.hoisted(() => ({ placeOrderAction: vi.fn() }));

vi.mock("../actions", () => ({ placeOrderAction }));

import { failedActionState } from "@/model/action-state";

import { EMPTY_CART, ORDERABLE_CART, PROFILE, SUBTOTAL_REFERENCE } from "../checkout.fixture";
import { CheckoutConfirmView } from "./view";

const KEY = "0195f0c2-0000-7000-a000-000000000001";

function renderView(cart = ORDERABLE_CART) {
  return render(
    <CheckoutConfirmView
      cart={cart}
      idempotencyKey={KEY}
      profile={PROFILE}
      reference={SUBTOTAL_REFERENCE}
    />,
  );
}

describe("CheckoutConfirmView", () => {
  it("届け先と注文内容を並べる", () => {
    renderView();

    expect(screen.getByText("お届け先")).toBeVisible();
    expect(screen.getByText("ご注文内容（全 2 件）")).toBeVisible();
  });

  it("集計を脇と下端の 2 か所へ置く", () => {
    const { container } = renderView();

    expect(screen.getByRole("complementary", { name: "お支払い金額" }).tagName).toBe("ASIDE");
    expect(container.querySelector('[data-slot="action-bar"]')).toBeInTheDocument();
  });

  it("同じ名前の区画を 2 つ名乗らない", () => {
    renderView();

    expect(screen.getAllByRole("complementary", { name: "お支払い金額" })).toHaveLength(1);
  });
  it("片方の姿から送った失敗を、もう片方の姿も出す", async () => {
    placeOrderAction.mockResolvedValue(failedActionState({ formError: "在庫が変わりました。" }));

    renderView();
    const aside = screen.getByRole("complementary", { name: "お支払い金額" });

    await userEvent.click(within(aside).getByRole("button", { name: "注文を確定する" }));

    // 脇と下端は CSS で出し分けるだけで、DOM には両方が居る。送信の状態を姿ごとに持つと、
    // 送った直後に幅が境界を跨いだとき、表に出る側が「何も送っていない」姿になる。
    expect(await screen.findAllByText("在庫が変わりました。")).toHaveLength(2);
  });

  it("カートが空なら、確かめる対象が無いことと商品を探す導線を出す", () => {
    renderView(EMPTY_CART);

    expect(screen.getByText(/確定できる注文がありません/)).toBeVisible();
    expect(screen.getByRole("link", { name: "商品を探す" })).toHaveAttribute("href", "/products");
  });

  it("カートが空なら確定の操作を出さない", () => {
    renderView(EMPTY_CART);

    expect(screen.queryByRole("button", { name: "注文を確定する" })).not.toBeInTheDocument();
  });

  it("a11y 自動検査に違反しない", async () => {
    const { container } = renderView();

    expect((await axe(container)).violations).toEqual([]);
  });
});
