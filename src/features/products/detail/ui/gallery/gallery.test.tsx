// @vitest-environment jsdom

import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { ProductGallery } from "./gallery";

const PRODUCT_NAME = "深煎りブレンド";
const IMAGE_URL = "https://media.example.test/coffee-front.png";
const IMAGE_URLS = [IMAGE_URL] as const;
const THREE_IMAGE_URLS = [
  IMAGE_URL,
  "https://media.example.test/coffee-back.png",
  "https://media.example.test/coffee-side.png",
] as const;

class IntersectionObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

describe("ProductGallery", () => {
  beforeEach(() => {
    vi.stubGlobal("IntersectionObserver", IntersectionObserverStub);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("渡された URL で画像を出す", () => {
    render(<ProductGallery imageUrls={IMAGE_URLS} productName={PRODUCT_NAME} />);

    expect(screen.getByRole("img", { name: PRODUCT_NAME })).toHaveAttribute(
      "src",
      expect.stringContaining(encodeURIComponent(IMAGE_URL)),
    );
  });

  it("商品名で引ける面に画像を載せる", () => {
    render(<ProductGallery imageUrls={IMAGE_URLS} productName={PRODUCT_NAME} />);

    expect(screen.getByRole("region", { name: "深煎りブレンドの画像" })).toBeVisible();
  });

  it("画像の枚数だけ送り先の一覧を下に並べる", () => {
    render(<ProductGallery imageUrls={THREE_IMAGE_URLS} productName={PRODUCT_NAME} />);

    expect(screen.getAllByRole("group")).toHaveLength(3);
    expect(screen.getByRole("list", { name: "画像の一覧" })).toBeVisible();
    expect(screen.getByRole("link", { name: "2 枚目" })).toHaveAttribute(
      "href",
      "#product-image-2",
    );
  });

  it("画像が 1 枚でも送り先の一覧を出す", () => {
    render(<ProductGallery imageUrls={IMAGE_URLS} productName={PRODUCT_NAME} />);

    expect(screen.getByRole("link", { name: "1 枚目" })).toHaveAttribute(
      "href",
      "#product-image-1",
    );
  });

  it("同じ URL の画像が並んでも枚数どおりに並べる", () => {
    render(<ProductGallery imageUrls={[IMAGE_URL, IMAGE_URL]} productName={PRODUCT_NAME} />);

    expect(screen.getAllByRole("group")).toHaveLength(2);
    expect(screen.getByRole("link", { name: "2 枚目" })).toBeVisible();
  });

  it("先頭では前へを出さず、末尾では次へを出さない", () => {
    render(<ProductGallery imageUrls={THREE_IMAGE_URLS} productName={PRODUCT_NAME} />);
    const [first, middle, last] = screen.getAllByRole("group");

    expect(within(first).queryByRole("link", { name: "前へ" })).not.toBeInTheDocument();
    expect(within(first).getByRole("link", { name: "次へ" })).toBeVisible();
    expect(within(middle).getByRole("link", { name: "前へ" })).toBeVisible();
    expect(within(middle).getByRole("link", { name: "次へ" })).toBeVisible();
    expect(within(last).getByRole("link", { name: "前へ" })).toBeVisible();
    expect(within(last).queryByRole("link", { name: "次へ" })).not.toBeInTheDocument();
  });

  it("画像が 1 枚なら前へも次へも出さない", () => {
    render(<ProductGallery imageUrls={IMAGE_URLS} productName={PRODUCT_NAME} />);

    expect(screen.queryByRole("link", { name: "前へ" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "次へ" })).not.toBeInTheDocument();
  });

  it("先頭の画像だけ後回しにしない", () => {
    render(<ProductGallery imageUrls={THREE_IMAGE_URLS} productName={PRODUCT_NAME} />);

    const [first, , third] = screen.getAllByRole("img", { name: PRODUCT_NAME });

    expect(first).not.toHaveAttribute("loading");
    expect(third).toHaveAttribute("loading", "lazy");
  });

  it("紙には先頭の 1 枚だけを残す", () => {
    render(<ProductGallery imageUrls={THREE_IMAGE_URLS} productName={PRODUCT_NAME} />);

    const [first, second, third] = screen.getAllByRole("group");

    expect(first).not.toHaveClass("print-hidden");
    expect(second).toHaveClass("print-hidden");
    expect(third).toHaveClass("print-hidden");
  });

  it("実画像には拡大する操作を出す", () => {
    render(<ProductGallery imageUrls={IMAGE_URLS} productName={PRODUCT_NAME} />);

    expect(screen.getAllByRole("button", { name: /を拡大する/ })).toHaveLength(IMAGE_URLS.length);
  });

  it("画像が無ければ代替画像を 1 枚として置く", () => {
    render(<ProductGallery imageUrls={[]} productName={PRODUCT_NAME} />);

    expect(screen.getByRole("img", { name: "画像なし" })).toHaveAttribute("src", "/no-image.svg");
    expect(screen.getByRole("link", { name: "1 枚目" })).toBeVisible();
  });

  it("代替画像には拡大する操作を出さない", () => {
    render(<ProductGallery imageUrls={[]} productName={PRODUCT_NAME} />);

    expect(screen.queryByRole("button", { name: /を拡大する/ })).not.toBeInTheDocument();
  });

  it("アクセシビリティ違反を持たない", async () => {
    const { container } = render(
      <ProductGallery imageUrls={THREE_IMAGE_URLS} productName={PRODUCT_NAME} />,
    );

    expect(
      (await axe(container, { rules: { "color-contrast": { enabled: false } } })).violations,
    ).toEqual([]);
  });
});
