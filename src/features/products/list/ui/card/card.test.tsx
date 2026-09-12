// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { MEDIA_IMAGE_PRIORITY } from "@/components/design-system/display/media-image/media-image.definition";
import { INQUIRY_PATH } from "@/features/inquiry/facade/paths/paths";
import type { ActionState } from "@/model/action-state";
import type { ProductListItem } from "@/model/product/product";
import { toProductId } from "@/model/product/product";
import { useCartStore } from "@/stores/cart-store";

const { addToCartAction } = vi.hoisted(() => ({
  addToCartAction:
    vi.fn<(previous: ActionState<void>, formData: FormData) => Promise<ActionState<void>>>(),
}));

vi.mock("@/features/cart/facade/add-to-cart/add-to-cart", () => ({ addToCartAction }));

import { ProductCard } from "./card";

const ITEM: ProductListItem = {
  id: toProductId("0195f0c2-0000-7000-8000-000000000001"),
  name: "スタンドライト",
  price: "4980.00",
  quantity: 3,
  categoryName: "デスク周り",
  statusName: "公開中",
  imageUrl: null,
};

function renderCard(item: ProductListItem) {
  return render(<ProductCard item={item} />);
}

describe("ProductCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    addToCartAction.mockResolvedValue({ status: "success", value: undefined });
    useCartStore.setState({ isOpen: false });
  });

  it("名称・分類・状態・価格・在庫数を表示する", () => {
    render(<ProductCard item={ITEM} />);

    expect(screen.getByText("スタンドライト")).toBeVisible();
    expect(screen.getByText("デスク周り")).toBeVisible();
    expect(screen.getByText("公開中")).toBeVisible();
    expect(screen.getByText("$4980.00")).toBeVisible();
    expect(screen.getByText("在庫 3")).toBeVisible();
  });

  it("商品名の link が詳細を指す", () => {
    render(<ProductCard item={ITEM} />);

    expect(screen.getByRole("link", { name: "スタンドライト" })).toHaveAttribute(
      "href",
      "/products/0195f0c2-0000-7000-8000-000000000001",
    );
  });

  it("詳細への導線はカードで 1 つだけにする", () => {
    render(<ProductCard item={ITEM} />);

    expect(screen.getAllByRole("link")).toHaveLength(1);
  });

  it("画像があれば名称を代替テキストにして表示する", () => {
    render(<ProductCard item={{ ...ITEM, imageUrl: "/products/1.png" }} />);

    expect(screen.getByRole("img", { name: "スタンドライト" })).toBeVisible();
  });

  it("画像が無ければ代替画像を出す", () => {
    render(<ProductCard item={ITEM} />);

    expect(screen.queryByRole("img", { name: "スタンドライト" })).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "画像なし" })).toBeVisible();
  });

  it("先頭に並ぶ商品の画像は後回しにしない", () => {
    render(
      <ProductCard
        imagePriority={MEDIA_IMAGE_PRIORITY.PRELOAD}
        item={{ ...ITEM, imageUrl: "/products/1.png" }}
      />,
    );

    expect(screen.getByRole("img", { name: "スタンドライト" })).not.toHaveAttribute("loading");
  });

  it("先頭でない商品の画像は見えてから読み込む", () => {
    render(<ProductCard item={{ ...ITEM, imageUrl: "/products/1.png" }} />);

    expect(screen.getByRole("img", { name: "スタンドライト" })).toHaveAttribute("loading", "lazy");
  });

  it("詳細への導線と並べてカートへ入れられる", async () => {
    render(<ProductCard item={ITEM} />);

    await userEvent.click(screen.getByRole("button", { name: "カートに追加" }));

    const formData = addToCartAction.mock.calls.at(-1)?.[1];

    expect(formData?.get("productId")).toBe(ITEM.id);
  });

  it("在庫が無ければ在庫なしを添える", () => {
    renderCard({ ...ITEM, quantity: 0 });

    expect(screen.getByText("在庫なし")).toBeVisible();
  });

  it("在庫があれば在庫なしを添えない", () => {
    render(<ProductCard item={ITEM} />);

    expect(screen.queryByText("在庫なし")).not.toBeInTheDocument();
  });

  it("在庫が無ければカートへ入れられない", () => {
    renderCard({ ...ITEM, quantity: 0 });

    expect(screen.getByRole("button", { name: "カートに追加" })).toBeDisabled();
  });

  it("在庫が無ければ問い合わせの入口を並べる", () => {
    renderCard({ ...ITEM, quantity: 0 });

    expect(screen.getByRole("link", { name: "お問い合わせ" })).toHaveAttribute(
      "href",
      INQUIRY_PATH,
    );
  });

  it("在庫があれば問い合わせの入口を出さない", () => {
    renderCard(ITEM);

    expect(screen.queryByRole("link", { name: "お問い合わせ" })).not.toBeInTheDocument();
  });

  it("a11y 自動検査に違反しない", async () => {
    const { container } = render(<ProductCard item={ITEM} />);

    expect(
      (await axe(container, { rules: { "color-contrast": { enabled: false } } })).violations,
    ).toEqual([]);
  });
});
