import { describe, expect, it } from "vitest";

import { nextPollOutcome, readCeTask } from "./analysis";

describe("readCeTask", () => {
  // ----- 正常系 -----
  it("状態と解析の id を読む", () => {
    const payload = { task: { status: "SUCCESS", analysisId: "AY-analysis" } };

    expect(readCeTask(payload)).toEqual({ status: "SUCCESS", analysisId: "AY-analysis" });
  });

  it("id がまだ付いていなければ空にする", () => {
    expect(readCeTask({ task: { status: "PENDING" } })).toEqual({
      status: "PENDING",
      analysisId: "",
    });
  });

  // ----- 異常系 -----
  it("entry が無ければ UNKNOWN として読む", () => {
    expect(readCeTask({})).toEqual({ status: "UNKNOWN", analysisId: "" });
  });

  it("応答として読めない形も UNKNOWN として読む", () => {
    expect(readCeTask("応答ではない")).toEqual({ status: "UNKNOWN", analysisId: "" });
  });
});

describe("nextPollOutcome", () => {
  // ----- 正常系 -----
  it("SUCCESS なら解析の id を連れて進む", () => {
    expect(nextPollOutcome({ status: "SUCCESS", analysisId: "AY-analysis" })).toEqual({
      kind: "completed",
      analysisId: "AY-analysis",
    });
  });

  it("処理中なら待つ", () => {
    expect(nextPollOutcome({ status: "IN_PROGRESS", analysisId: "" })).toEqual({ kind: "pending" });
  });

  // ----- 異常系 -----
  it("FAILED なら終わり方を挙げて落とす", () => {
    expect(nextPollOutcome({ status: "FAILED", analysisId: "" })).toEqual({
      kind: "failed",
      status: "FAILED",
    });
  });

  it("CANCELED も結果を持たない終わりとして落とす", () => {
    expect(nextPollOutcome({ status: "CANCELED", analysisId: "" })).toEqual({
      kind: "failed",
      status: "CANCELED",
    });
  });

  it("知らない状態は失敗にせず待つ", () => {
    expect(nextPollOutcome({ status: "UNKNOWN", analysisId: "" })).toEqual({ kind: "pending" });
  });
});
