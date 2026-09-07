// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import LoginPage, { metadata } from "./page";

async function renderPage(searchParams: Record<string, string | string[] | undefined>) {
  return render(await LoginPage({ searchParams: Promise.resolve(searchParams) }));
}

describe("LoginPage", () => {
  it("この画面の名前と説明を metadata に持つ", () => {
    expect(metadata.title).toBe("ログイン");
    expect(metadata.description).toBe("認証を始めます。資格情報の入力は認証基盤の画面で行われます。");
  });

  it("検索エンジンに拾わせない", () => {
    expect(metadata.robots).toMatchObject({ index: false });
  });

  it("復帰先を画面へ渡す", async () => {
    const { container } = await renderPage({ returnUrl: "/account" });

    expect(container.querySelector('input[name="returnUrl"]')).toHaveValue("/account");
  });

  it("認証を始める操作を出す", async () => {
    await renderPage({});

    expect(screen.getByRole("button", { name: "ログインへ進む" })).toBeVisible();
  });

  it("a11y 違反を持たない", async () => {
    const { container } = await renderPage({});

    expect(
      (await axe(container, { rules: { "color-contrast": { enabled: false } } })).violations,
    ).toEqual([]);
  });

  it("復帰先が無ければルートへ戻す", async () => {
    const { container } = await renderPage({});

    expect(container.querySelector('input[name="returnUrl"]')).toHaveValue("/");
  });

  it("外部 URL の復帰先を落とす", async () => {
    const { container } = await renderPage({ returnUrl: "https://evil.example.test" });

    expect(container.querySelector('input[name="returnUrl"]')).toHaveValue("/");
  });

  it("復帰先が複数指定されていれば落とす", async () => {
    const { container } = await renderPage({ returnUrl: ["/account", "/admin"] });

    expect(container.querySelector('input[name="returnUrl"]')).toHaveValue("/");
  });

  it("認証を始められなかったとき、その案内を画面へ渡す", async () => {
    await renderPage({ error: "unavailable" });

    expect(screen.getByRole("alert")).toHaveTextContent("認証を始められませんでした");
  });

  it("案内を出した状態でも a11y 違反を持たない", async () => {
    const { container } = await renderPage({ error: "unavailable" });

    expect(screen.getByRole("alert")).toBeVisible();
    expect(
      (await axe(container, { rules: { "color-contrast": { enabled: false } } })).violations,
    ).toEqual([]);
  });

  it("宣言に無い理由は画面へ渡さない", async () => {
    await renderPage({ error: "unauthorized" });

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("理由が複数指定されていれば落とす", async () => {
    await renderPage({ error: ["unavailable", "unavailable"] });

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
