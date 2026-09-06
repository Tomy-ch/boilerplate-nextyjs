// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import type { DashboardSummary } from "@/model/dashboard/dashboard";
import type { TimeWindow } from "@/model/time-window";

const { getDashboardSummary } = vi.hoisted(() => ({ getDashboardSummary: vi.fn() }));

vi.mock("@/adapters/server/api/dashboard", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/adapters/server/api/dashboard")>()),
  getDashboardSummary,
}));

import { AnalyticsSummarySection } from "./summary-section";

const SUMMARY: DashboardSummary = {
  salesAmount: 123_456,
  salesCount: 1234,
  purchaseStatusCounts: [{ statusId: "1", statusName: "検討中", count: 22 }],
  totalProductCount: 476,
  publishedProductCount: 454,
};

/** 2026 年 8 月 1 か月ぶんの区間。 */
const MONTH_WINDOW: TimeWindow = {
  after: "2026-08-01T00:00:00+09:00",
  before: "2026-09-01T00:00:00+09:00",
};

beforeEach(() => {
  vi.clearAllMocks();
  getDashboardSummary.mockResolvedValue(SUMMARY);
});

describe("AnalyticsSummarySection", () => {
  // ----- 期間が決まっていないとき -----
  it("日付が揃っていなければ両方を選ぶよう促す", async () => {
    render(await AnalyticsSummarySection({ request: { status: "incomplete" } }));

    expect(screen.getByText("開始日と終了日の両方を選んでください。")).toBeInTheDocument();
  });

  it("終了日が前なら選び直すよう促す", async () => {
    render(await AnalyticsSummarySection({ request: { status: "reversed" } }));

    expect(
      screen.getByText("終了日は開始日と同じ日か、それより後を選んでください。"),
    ).toBeInTheDocument();
  });

  it("これから選ぶ案内は誤りの色で出さない", async () => {
    render(await AnalyticsSummarySection({ request: { status: "incomplete" } }));

    expect(screen.getByText("開始日と終了日の両方を選んでください。")).toHaveClass(
      "text-muted-foreground",
    );
  });

  it("前後が逆であることは誤りの色で出す", async () => {
    render(await AnalyticsSummarySection({ request: { status: "reversed" } }));

    expect(screen.getByText("終了日は開始日と同じ日か、それより後を選んでください。")).toHaveClass(
      "text-destructive",
    );
  });

  it("最初から画面にある文言なので読み上げの役を持たせない", async () => {
    render(await AnalyticsSummarySection({ request: { status: "incomplete" } }));

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("取得を試みない", async () => {
    render(await AnalyticsSummarySection({ request: { status: "incomplete" } }));

    expect(getDashboardSummary).not.toHaveBeenCalled();
  });

  it("数を出さない", async () => {
    render(await AnalyticsSummarySection({ request: { status: "reversed" } }));

    expect(screen.queryByRole("region", { name: "選んだ期間の集計" })).not.toBeInTheDocument();
  });

  it("促す形でも a11y 検査を通る", async () => {
    const { container } = render(
      await AnalyticsSummarySection({ request: { status: "incomplete" } }),
    );

    expect(
      (await axe(container, { rules: { "color-contrast": { enabled: false } } })).violations,
    ).toEqual([]);
  });

  // ----- 期間が決まっているとき -----
  it("解決済みの区間をそのまま取得へ渡す", async () => {
    const window: TimeWindow = {
      after: "2026-08-01T00:00:00+09:00",
      before: "2026-08-20T00:00:00+09:00",
    };

    render(await AnalyticsSummarySection({ request: { status: "ready", window } }));

    expect(getDashboardSummary).toHaveBeenCalledWith(window);
  });

  it("その期間で集計を求め、数値カードと内訳を出す", async () => {
    render(
      await AnalyticsSummarySection({
        request: { status: "ready", window: MONTH_WINDOW },
      }),
    );

    expect(screen.getByRole("region", { name: "選んだ期間の集計" })).toBeInTheDocument();
    expect(screen.getByText("$1,234.56")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "ステータス別の件数" })).toBeInTheDocument();
  });

  it("入口の画面とは別の見出しで数を出す", async () => {
    render(
      await AnalyticsSummarySection({
        request: { status: "ready", window: MONTH_WINDOW },
      }),
    );

    expect(screen.queryByRole("region", { name: "今日の集計" })).not.toBeInTheDocument();
  });

  it("集計を出す形でも a11y 検査を通る", async () => {
    const { container } = render(
      await AnalyticsSummarySection({
        request: { status: "ready", window: MONTH_WINDOW },
      }),
    );

    expect(
      (await axe(container, { rules: { "color-contrast": { enabled: false } } })).violations,
    ).toEqual([]);
  });
});
