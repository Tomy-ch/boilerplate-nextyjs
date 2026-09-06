// @vitest-environment jsdom

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { type ActionState, failedActionState, succeededActionState } from "@/model/action-state";

const { addToCartAction } = vi.hoisted(() => ({
  addToCartAction:
    vi.fn<(previous: ActionState<void>, formData: FormData) => Promise<ActionState<void>>>(),
}));

vi.mock("./add-to-cart", () => ({ addToCartAction }));

import { useCartStore } from "@/stores/cart-store";

import { AddToCartButton } from "./add-to-cart-button";

const PRODUCT_ID = "0195f0c2-0000-7000-8000-000000000001";

beforeEach(() => {
  addToCartAction.mockReset();
  addToCartAction.mockResolvedValue(succeededActionState(undefined));
  useCartStore.setState({ isOpen: false });
});

describe("AddToCartButton", () => {
  it("押すと対象の商品を送る", async () => {
    const user = userEvent.setup();

    render(<AddToCartButton productId={PRODUCT_ID} stockQuantity={3} />);
    await user.click(screen.getByRole("button", { name: "カートに追加" }));

    const formData = addToCartAction.mock.calls.at(-1)?.[1];

    expect(formData?.get("productId")).toBe(PRODUCT_ID);
  });

  it("結果を待たずにカートを開く", async () => {
    const user = userEvent.setup();
    let settle: (() => void) | undefined;

    addToCartAction.mockReturnValue(
      new Promise((resolve) => {
        settle = () => resolve(succeededActionState(undefined));
      }),
    );

    render(<AddToCartButton productId={PRODUCT_ID} stockQuantity={3} />);
    await user.click(screen.getByRole("button", { name: "カートに追加" }));

    expect(useCartStore.getState().isOpen).toBe(true);

    settle?.();
    await waitFor(() => expect(screen.getByRole("button", { name: "カートに追加" })).toBeEnabled());
  });

  it("在庫が無い商品では押せない", () => {
    render(<AddToCartButton productId={PRODUCT_ID} stockQuantity={0} />);

    expect(screen.getByRole("button", { name: "カートに追加" })).toBeDisabled();
  });

  it("送信中は押せなくなり、進行中であることを文言で示す", async () => {
    const user = userEvent.setup();
    let settle: (() => void) | undefined;

    addToCartAction.mockReturnValue(
      new Promise((resolve) => {
        settle = () => resolve(succeededActionState(undefined));
      }),
    );

    render(<AddToCartButton productId={PRODUCT_ID} stockQuantity={3} />);
    await user.click(screen.getByRole("button", { name: "カートに追加" }));

    const pending = await screen.findByRole("button", { name: "カートに追加しています" });

    expect(pending).toBeDisabled();

    settle?.();
    await waitFor(() => expect(screen.getByRole("button", { name: "カートに追加" })).toBeEnabled());
  });

  it("失敗したとき、この操作の下に理由を出す", async () => {
    const user = userEvent.setup();

    addToCartAction.mockResolvedValue(
      failedActionState({ formError: "現在サービスを利用できません。" }),
    );

    render(<AddToCartButton productId={PRODUCT_ID} stockQuantity={3} />);
    await user.click(screen.getByRole("button", { name: "カートに追加" }));

    expect(await screen.findByText("カートに追加できませんでした")).toBeVisible();
    expect(screen.getByText("現在サービスを利用できません。")).toBeVisible();
  });

  it("送信していない間は失敗の文言を出さない", () => {
    render(<AddToCartButton productId={PRODUCT_ID} stockQuantity={3} />);

    expect(screen.queryByText("カートに追加できませんでした")).not.toBeInTheDocument();
  });

  it("失敗の理由が無ければ、見出しごと出さない", async () => {
    const user = userEvent.setup();

    addToCartAction.mockResolvedValue(failedActionState({}));

    render(<AddToCartButton productId={PRODUCT_ID} stockQuantity={3} />);
    await user.click(screen.getByRole("button", { name: "カートに追加" }));

    await waitFor(() => expect(addToCartAction).toHaveBeenCalled());

    expect(screen.queryByText("カートに追加できませんでした")).not.toBeInTheDocument();
  });

  it("置き場所を渡さないとき、画面の主操作として幅を占める", () => {
    render(<AddToCartButton productId={PRODUCT_ID} stockQuantity={3} />);

    expect(screen.getByRole("button", { name: "カートに追加" })).toHaveClass("w-full", "h-11");
  });

  it("一覧に置くときは、1 件ぶんの枠に収める", () => {
    render(<AddToCartButton placement="list" productId={PRODUCT_ID} stockQuantity={3} />);

    expect(screen.getByRole("button", { name: "カートに追加" })).not.toHaveClass("w-full");
  });

  it("a11y 自動検査に違反しない", async () => {
    const { container } = render(<AddToCartButton productId={PRODUCT_ID} stockQuantity={3} />);

    expect((await axe(container)).violations).toEqual([]);
  });
});
