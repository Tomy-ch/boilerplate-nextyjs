// @vitest-environment jsdom

import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { SEARCH_FIELD_DEBOUNCE_MS, SearchFieldClient } from "./search-field-client";
import { SEARCH_FIELD_COMMIT } from "./search-field-client.definition";

const noop = () => undefined;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

/**
 * 検索語を打ち込む。
 *
 * @remarks
 * **ここは `user-event` を使いません。**この部品の主題は打鍵を待ってから通知することで、
 * 待ち時間そのものを確かめるには偽の時計が要ります。`user-event` は入力の再現に自前の待ち合わせを
 * 挟むため、偽の時計の下では進め方を渡しても止まったままになります。
 */
function type(value: string) {
  fireEvent.change(screen.getByRole("searchbox"), { target: { value } });
}

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

describe("SearchFieldClient", () => {
  it("search landmark の中に type=search の検索入力を置く", () => {
    const { container } = render(<SearchFieldClient label="項目を検索" onSearch={noop} />);

    expect(container.querySelector("[data-slot='search-field']")?.tagName).toBe("SEARCH");
    expect(screen.getByRole("searchbox", { name: "項目を検索" })).toHaveAttribute("type", "search");
  });

  it("初期表示だけでは通知しない", () => {
    const onSearch = vi.fn();
    render(<SearchFieldClient defaultValue="標準" label="項目を検索" onSearch={onSearch} />);

    advance(SEARCH_FIELD_DEBOUNCE_MS);

    expect(onSearch).not.toHaveBeenCalled();
  });

  it("入力が止まってから検索語を通知する", () => {
    const onSearch = vi.fn();
    render(<SearchFieldClient label="項目を検索" onSearch={onSearch} />);

    type("標準");

    expect(onSearch).not.toHaveBeenCalled();

    advance(SEARCH_FIELD_DEBOUNCE_MS);

    expect(onSearch).toHaveBeenCalledExactlyOnceWith("標準");
  });

  it("入力が続く間は通知をまとめ、最後の値だけを通知する", () => {
    const onSearch = vi.fn();
    render(<SearchFieldClient label="項目を検索" onSearch={onSearch} />);

    type("標");
    advance(SEARCH_FIELD_DEBOUNCE_MS - 1);
    type("標準");
    advance(SEARCH_FIELD_DEBOUNCE_MS);

    expect(onSearch).toHaveBeenCalledExactlyOnceWith("標準");
  });

  it("待ち時間を呼び出し元が変えられる", () => {
    const onSearch = vi.fn();
    render(<SearchFieldClient debounceMs={1000} label="項目を検索" onSearch={onSearch} />);

    type("標準");
    advance(SEARCH_FIELD_DEBOUNCE_MS);

    expect(onSearch).not.toHaveBeenCalled();

    advance(1000 - SEARCH_FIELD_DEBOUNCE_MS);

    expect(onSearch).toHaveBeenCalledExactlyOnceWith("標準");
  });

  it("検索語が空のときは消去ボタンを描画しない", () => {
    render(<SearchFieldClient label="項目を検索" onSearch={noop} />);

    expect(screen.queryByRole("button", { name: "検索語を消去" })).not.toBeInTheDocument();
  });

  it("検索語があるときだけ消去ボタンを描画する", () => {
    render(<SearchFieldClient defaultValue="標準" label="項目を検索" onSearch={noop} />);

    expect(screen.getByRole("button", { name: "検索語を消去" })).toHaveAttribute("type", "button");
  });

  it("消去すると入力を空にし、空文字列を通知して入力へ focus を戻す", () => {
    const onSearch = vi.fn();
    render(<SearchFieldClient defaultValue="標準" label="項目を検索" onSearch={onSearch} />);

    fireEvent.click(screen.getByRole("button", { name: "検索語を消去" }));

    const input = screen.getByRole("searchbox", { name: "項目を検索" });

    expect(input).toHaveValue("");
    expect(input).toHaveFocus();

    advance(SEARCH_FIELD_DEBOUNCE_MS);

    expect(onSearch).toHaveBeenCalledExactlyOnceWith("");
  });

  it("消去ボタンのアクセシブルな名前を変えられる", () => {
    render(
      <SearchFieldClient
        clearLabel="入力を消す"
        defaultValue="標準"
        label="項目を検索"
        onSearch={noop}
      />,
    );

    expect(screen.getByRole("button", { name: "入力を消す" })).toBeInTheDocument();
  });

  it("a11y 自動検査に違反しない", async () => {
    vi.useRealTimers();

    const { container } = render(
      <SearchFieldClient
        defaultValue="標準"
        label="項目を検索"
        onSearch={noop}
        placeholder="キーワードを入力"
      />,
    );

    const result = await axe(container, { rules: { "color-contrast": { enabled: false } } });

    expect(result.violations).toEqual([]);
  });

  // ----- 確定の契機を送信にした場合 -----
  it("送信でだけ確定する形では、打鍵しても通知しない", () => {
    const onSearch = vi.fn();
    render(
      <SearchFieldClient
        commit={SEARCH_FIELD_COMMIT.SUBMIT}
        label="項目を検索"
        onSearch={onSearch}
      />,
    );

    type("本");
    advance(SEARCH_FIELD_DEBOUNCE_MS * 2);

    expect(onSearch).not.toHaveBeenCalled();
  });

  it("送信でだけ確定する形では、消去しても通知しない", async () => {
    vi.useRealTimers();

    const user = userEvent.setup();
    const onSearch = vi.fn();
    render(
      <SearchFieldClient
        commit={SEARCH_FIELD_COMMIT.SUBMIT}
        defaultValue="本"
        label="項目を検索"
        onSearch={onSearch}
      />,
    );

    await user.click(screen.getByRole("button", { name: "検索語を消去" }));

    expect(screen.getByRole("searchbox", { name: "項目を検索" })).toHaveValue("");
    expect(onSearch).not.toHaveBeenCalled();
  });

  it("送信の操作で、そのときの検索語を通知する", () => {
    const onSearch = vi.fn();
    render(
      <SearchFieldClient
        commit={SEARCH_FIELD_COMMIT.SUBMIT}
        label="項目を検索"
        onSearch={onSearch}
      />,
    );

    type("本");
    fireEvent.click(screen.getByRole("button", { name: "検索" }));

    expect(onSearch).toHaveBeenCalledWith("本");
  });

  it("Enter でも確定する", () => {
    const onSearch = vi.fn();
    render(
      <SearchFieldClient
        commit={SEARCH_FIELD_COMMIT.SUBMIT}
        label="項目を検索"
        onSearch={onSearch}
      />,
    );

    type("本");
    fireEvent.keyDown(screen.getByRole("searchbox", { name: "項目を検索" }), { key: "Enter" });

    expect(onSearch).toHaveBeenCalledWith("本");
  });

  it("Enter 以外のキーでは確定しない", () => {
    const onSearch = vi.fn();
    render(
      <SearchFieldClient
        commit={SEARCH_FIELD_COMMIT.SUBMIT}
        label="項目を検索"
        onSearch={onSearch}
      />,
    );

    type("本");
    fireEvent.keyDown(screen.getByRole("searchbox", { name: "項目を検索" }), { key: "a" });

    expect(onSearch).not.toHaveBeenCalled();
  });

  it("送信ボタンの文言を差し替えられる", () => {
    render(
      <SearchFieldClient
        commit={SEARCH_FIELD_COMMIT.SUBMIT}
        label="項目を検索"
        onSearch={vi.fn()}
        submitLabel="絞り込む"
      />,
    );

    expect(screen.getByRole("button", { name: "絞り込む" })).toBeInTheDocument();
  });

  it("呼び出し元が押せないと決めたとき、送信を押せなくする", () => {
    render(
      <SearchFieldClient
        commit={SEARCH_FIELD_COMMIT.SUBMIT}
        label="項目を検索"
        onSearch={vi.fn()}
        submitDisabled
      />,
    );

    expect(screen.getByRole("button", { name: "検索" })).toBeDisabled();
  });

  it("打鍵で確定する形では送信ボタンを出さない", () => {
    render(<SearchFieldClient label="項目を検索" onSearch={vi.fn()} />);

    expect(screen.queryByRole("button", { name: "検索" })).not.toBeInTheDocument();
  });

  // ----- 制御 component として使う場合 -----
  it("外から渡された検索語を映す", () => {
    render(<SearchFieldClient label="項目を検索" onSearch={vi.fn()} value="鞄" />);

    expect(screen.getByRole("searchbox", { name: "項目を検索" })).toHaveValue("鞄");
  });

  it("打鍵のたびに、呼び出し元へ入力を渡す", () => {
    const onValueChange = vi.fn();
    render(
      <SearchFieldClient
        label="項目を検索"
        onSearch={vi.fn()}
        onValueChange={onValueChange}
        value=""
      />,
    );

    type("鞄");

    expect(onValueChange).toHaveBeenCalledWith("鞄");
  });

  it("外から渡されている間は、自分では入力を保持しない", () => {
    render(<SearchFieldClient label="項目を検索" onSearch={vi.fn()} value="鞄" />);

    type("靴");

    expect(screen.getByRole("searchbox", { name: "項目を検索" })).toHaveValue("鞄");
  });

  it("消去の操作でも、空を呼び出し元へ渡す", () => {
    const onValueChange = vi.fn();
    render(
      <SearchFieldClient
        label="項目を検索"
        onSearch={vi.fn()}
        onValueChange={onValueChange}
        value="鞄"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "検索語を消去" }));

    expect(onValueChange).toHaveBeenCalledWith("");
  });
});
