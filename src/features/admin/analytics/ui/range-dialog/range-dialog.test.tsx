// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

import { RangeDialog } from "./range-dialog";

async function open() {
  await userEvent.click(screen.getByRole("button", { name: "期間を指定" }));

  return screen.getByRole("dialog");
}

describe("RangeDialog", () => {
  // ----- 閉じているとき -----
  it("引き金だけが見える", () => {
    render(<RangeDialog selected={false} />);

    expect(screen.getByRole("button", { name: "期間を指定" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("いまこの期間で見ていれば引き金に aria-current が付く", () => {
    render(<RangeDialog selected />);

    expect(screen.getByRole("button", { name: "期間を指定" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("いまこの期間で見ていなければ引き金に aria-current を付けない", () => {
    render(<RangeDialog selected={false} />);

    expect(screen.getByRole("button", { name: "期間を指定" })).not.toHaveAttribute("aria-current");
  });

  // ----- 開いているとき -----
  it("両端の入力欄が出る", async () => {
    render(<RangeDialog selected={false} />);
    await open();

    expect(screen.getByLabelText(/開始日/)).toBeInTheDocument();
    expect(screen.getByLabelText(/終了日/)).toBeInTheDocument();
  });

  it("URL に載っていた日付が初期値になる", async () => {
    render(<RangeDialog from="2026-08-01" selected to="2026-08-19" />);
    await open();

    expect(screen.getByLabelText(/開始日/)).toHaveValue("2026-08-01");
    expect(screen.getByLabelText(/終了日/)).toHaveValue("2026-08-19");
  });

  it("送ると GET で集計画面へ向かう", async () => {
    render(<RangeDialog selected={false} />);
    const dialog = await open();
    const form = dialog.querySelector("form");

    expect(form).toHaveAttribute("action", "/admin/analytics");
    expect(form).toHaveAttribute("method", "get");
  });

  it("期間の区分を hidden で載せる", async () => {
    render(<RangeDialog selected={false} />);
    const dialog = await open();

    expect(dialog.querySelector('input[name="period"]')).toHaveValue("range");
  });

  it("前後の関係を min / max で示す", async () => {
    render(<RangeDialog from="2026-08-01" selected to="2026-08-19" />);
    await open();

    expect(screen.getByLabelText(/開始日/)).toHaveAttribute("max", "2026-08-19");
    expect(screen.getByLabelText(/終了日/)).toHaveAttribute("min", "2026-08-01");
  });

  it("a11y 検査を通る", async () => {
    render(<RangeDialog selected={false} />);
    const dialog = await open();

    expect(
      (await axe(dialog, { rules: { "color-contrast": { enabled: false } } })).violations,
    ).toEqual([]);
  });
});
