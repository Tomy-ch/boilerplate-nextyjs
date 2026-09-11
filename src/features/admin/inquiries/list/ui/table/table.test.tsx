// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

import { ADMIN_INQUIRY_ROWS } from "../../../inquiries.fixture";
import { AdminInquiryTable } from "./table";

describe("AdminInquiryTable", () => {
  it("行から対応の画面へ入れる", () => {
    render(<AdminInquiryTable items={ADMIN_INQUIRY_ROWS} />);

    expect(screen.getByRole("link", { name: ADMIN_INQUIRY_ROWS[0]?.userId })).toHaveAttribute(
      "href",
      `/admin/inquiries/${ADMIN_INQUIRY_ROWS[0]?.id}`,
    );
  });

  it("最終更新を出す", () => {
    render(<AdminInquiryTable items={ADMIN_INQUIRY_ROWS} />);

    expect(screen.getByText("最終更新")).toBeVisible();
  });

  it("本文を出さない", () => {
    render(<AdminInquiryTable items={ADMIN_INQUIRY_ROWS} />);

    expect(screen.queryByText("本文")).not.toBeInTheDocument();
  });

  it("1 件も無いとき、その旨を出す", () => {
    render(<AdminInquiryTable items={[]} />);

    expect(screen.getByText("問い合わせはまだありません。")).toBeVisible();
  });

  it("下に置くページ送りを受け取る", () => {
    render(<AdminInquiryTable items={ADMIN_INQUIRY_ROWS} pagination={<p>ページ送り</p>} />);

    expect(screen.getByText("ページ送り")).toBeVisible();
  });

  it("a11y 自動検査に違反しない", async () => {
    const { container } = render(<AdminInquiryTable items={ADMIN_INQUIRY_ROWS} />);

    expect((await axe(container)).violations).toEqual([]);
  });
});
