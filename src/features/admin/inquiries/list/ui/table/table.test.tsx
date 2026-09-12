// @vitest-environment jsdom

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

import { formatDateTime } from "@/model/datetime";

import { ADMIN_INQUIRY_ROWS } from "../../../inquiries.fixture";
import { AdminInquiryTable } from "./table";

describe("AdminInquiryTable", () => {
  it("行から対応の画面へ入れる", () => {
    render(<AdminInquiryTable items={ADMIN_INQUIRY_ROWS} />);

    // 先頭の行だけだと、行と行き先の対応ではなく「どこかに 1 本ある」ことしか言えない。
    for (const row of ADMIN_INQUIRY_ROWS) {
      expect(screen.getByRole("link", { name: row.userId })).toHaveAttribute(
        "href",
        `/admin/inquiries/${row.id}`,
      );
    }
  });

  it("行ごとに最終更新を出す", () => {
    render(<AdminInquiryTable items={ADMIN_INQUIRY_ROWS} />);

    expect(screen.getByText("最終更新")).toBeVisible();

    for (const row of ADMIN_INQUIRY_ROWS) {
      expect(screen.getByText(formatDateTime(row.updatedAt))).toBeVisible();
    }
  });

  it("最終更新と開始を、取り違えずにそれぞれの列へ置く", () => {
    render(<AdminInquiryTable items={ADMIN_INQUIRY_ROWS} />);

    const headers = screen.getAllByRole("columnheader").map((cell) => cell.textContent);
    const updatedAtColumn = headers.indexOf("最終更新");
    const createdAtColumn = headers.indexOf("開始");

    expect(updatedAtColumn).toBeGreaterThanOrEqual(0);
    expect(createdAtColumn).toBeGreaterThanOrEqual(0);

    const rows = screen.getAllByRole("row").slice(1);

    for (const [index, row] of rows.entries()) {
      const cells = within(row).getAllByRole("cell");
      const item = ADMIN_INQUIRY_ROWS[index];

      expect(cells[updatedAtColumn]).toHaveTextContent(
        formatDateTime(item?.updatedAt ?? new Date()),
      );
      expect(cells[createdAtColumn]).toHaveTextContent(
        formatDateTime(item?.createdAt ?? new Date()),
      );
    }
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
