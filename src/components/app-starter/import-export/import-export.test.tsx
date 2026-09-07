// @vitest-environment jsdom

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

import { Button } from "@/components/design-system/action/button/button";
import { ExportButton, ImportErrorList, type ImportRowError, ImportSummary } from "./import-export";

const ERRORS: readonly ImportRowError[] = [
  { line: 12, column: "月額", message: "数値として読めません" },
  { line: 27, message: "列の数が合いません" },
];

describe("ImportSummary", () => {
  it("すべて取り込めたことを伝える", () => {
    render(<ImportSummary failed={0} succeeded={120} total={120} />);

    expect(screen.getByText("120 件を取り込みました")).toBeInTheDocument();
  });

  it("一部だけ失敗した状態を、成功とも失敗とも別に示す", () => {
    render(<ImportSummary failed={2} succeeded={118} total={120} />);

    expect(screen.getByText("120 件のうち 2 件を取り込めませんでした")).toBeInTheDocument();
    expect(screen.getByText("118 件は取り込み済みです。")).toBeInTheDocument();
  });

  it("目を離していても届くよう status として伝える", () => {
    render(<ImportSummary failed={0} succeeded={1} total={1} />);

    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("失敗があれば注意として示す", () => {
    render(<ImportSummary failed={1} succeeded={0} total={1} />);

    expect(screen.getByRole("status").className).toContain("warning");
  });

  it("件数の単位を呼び出し元が差し替えられる", () => {
    render(<ImportSummary failed={0} succeeded={3} total={3} unit="行" />);

    expect(screen.getByText("3 行を取り込みました")).toBeInTheDocument();
  });

  it("結果を受けて取る操作を合成できる", () => {
    render(
      <ImportSummary failed={2} succeeded={1} total={3}>
        <Button type="button">失敗した行だけ再実行</Button>
      </ImportSummary>,
    );

    expect(screen.getByRole("button", { name: "失敗した行だけ再実行" })).toBeInTheDocument();
  });

  describe("ImportExport 全体", () => {
    it("a11y 自動検査に違反しない", async () => {
      const { container } = render(
        <div>
          <ImportSummary failed={2} succeeded={118} total={120}>
            <Button type="button">再実行</Button>
          </ImportSummary>
          <ImportErrorList errors={ERRORS} />
          <ExportButton />
        </div>,
      );

      const result = await axe(container, { rules: { "color-contrast": { enabled: false } } });

      expect(result.violations).toEqual([]);
    });
  });
});

describe("ImportErrorList", () => {
  it("行番号・項目・理由を表として並べる", () => {
    render(<ImportErrorList errors={ERRORS} />);

    const table = screen.getByRole("table", { name: "取り込めなかった行" });
    const cells = within(table)
      .getAllByRole("row")
      .map((row) =>
        within(row)
          .queryAllByRole("cell")
          .map((cell) => cell.textContent),
      );

    expect(cells).toEqual([
      [],
      ["12", "月額", "数値として読めません"],
      ["27", "—", "列の数が合いません"],
    ]);
  });

  it("行全体が原因の場合は項目を空にする", () => {
    render(<ImportErrorList errors={ERRORS} />);

    expect(screen.getByRole("cell", { name: "—" })).toBeInTheDocument();
  });

  it("表の名前を呼び出し元が差し替えられる", () => {
    render(<ImportErrorList errors={ERRORS} label="取り込みエラー" />);

    expect(screen.getByRole("table", { name: "取り込みエラー" })).toBeInTheDocument();
  });

  it("渡された行をすべて並べる", () => {
    const many = Array.from({ length: 30 }, (_, index) => ({
      line: index + 1,
      message: "読めません",
    }));
    render(<ImportErrorList errors={many} />);

    expect(screen.getAllByRole("row")).toHaveLength(31);
  });
});

describe("ExportButton", () => {
  it("生成前は押せる操作として出す", () => {
    render(<ExportButton />);

    expect(screen.getByRole("button", { name: "書き出す" })).toBeEnabled();
  });

  it("生成中は押せず、文言でも何を待っているか示す", () => {
    render(<ExportButton pending />);

    const button = screen.getByRole("button", { name: "書き出しています" });

    expect(button).toBeDisabled();
  });

  it("生成が終わったら受け取る link へ変える", () => {
    render(<ExportButton fileName="plans.csv" href="/exports/plans.csv" />);

    const link = screen.getByRole("link", { name: "書き出す" });

    expect(link).toHaveAttribute("href", "/exports/plans.csv");
    expect(link).toHaveAttribute("download", "plans.csv");
  });

  it("前の出力を持ったまま生成中なら、受け取る link を出さない", () => {
    render(<ExportButton fileName="plans.csv" href="/exports/plans.csv" pending />);

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "書き出しています" })).toBeDisabled();
  });

  it("文言を呼び出し元が差し替えられる", () => {
    render(<ExportButton label="CSV を書き出す" />);

    expect(screen.getByRole("button", { name: "CSV を書き出す" })).toBeInTheDocument();
  });

  it("生成中の文言を呼び出し元が差し替えられる", () => {
    render(<ExportButton pending pendingLabel="生成中" />);

    expect(screen.getByRole("button", { name: "生成中" })).toBeInTheDocument();
  });
});
