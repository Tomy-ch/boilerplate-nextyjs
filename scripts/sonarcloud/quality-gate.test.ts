import { describe, expect, it } from "vitest";

import { readGateStatus, renderFailingConditions } from "./quality-gate";

const FAILING_CONDITION = {
  metricKey: "new_duplicated_lines_density",
  comparator: "GT",
  errorThreshold: "3",
  actualValue: "7.4",
  status: "ERROR",
};

const PASSING_CONDITION = {
  metricKey: "new_coverage",
  comparator: "LT",
  errorThreshold: "80",
  actualValue: "92.0",
  status: "OK",
};

describe("readGateStatus", () => {
  // ----- 正常系 -----
  it("判定をそのまま読む", () => {
    expect(readGateStatus({ projectStatus: { status: "OK" } })).toBe("OK");
  });

  it("ゲートが割り当てられていない状態も、そのまま読む", () => {
    expect(readGateStatus({ projectStatus: { status: "NONE" } })).toBe("NONE");
  });

  // ----- 異常系 -----
  it("判定が読めなければ UNKNOWN とし、合格へ寄せない", () => {
    expect(readGateStatus({ projectStatus: {} })).toBe("UNKNOWN");
    expect(readGateStatus(null)).toBe("UNKNOWN");
  });
});

describe("renderFailingConditions", () => {
  // ----- 正常系 -----
  it("落ちた条件を、比較の向きと実測値を添えて 1 行にする", () => {
    const payload = { projectStatus: { conditions: [FAILING_CONDITION] } };

    expect(renderFailingConditions(payload)).toBe(
      "- `new_duplicated_lines_density` gt 3 — actual 7.4\n",
    );
  });

  it("通った条件は書かない", () => {
    const payload = { projectStatus: { conditions: [PASSING_CONDITION, FAILING_CONDITION] } };

    expect(renderFailingConditions(payload)).toBe(
      "- `new_duplicated_lines_density` gt 3 — actual 7.4\n",
    );
  });

  it("落ちた条件が無ければ空にし、貼る側が節ごと落とせるようにする", () => {
    const payload = { projectStatus: { conditions: [PASSING_CONDITION] } };

    expect(renderFailingConditions(payload)).toBe("");
  });

  it("閾値が数値で返っても綴りとして書く", () => {
    const condition = { ...FAILING_CONDITION, errorThreshold: 3, actualValue: 7.4 };
    const payload = { projectStatus: { conditions: [condition] } };

    expect(renderFailingConditions(payload)).toBe(
      "- `new_duplicated_lines_density` gt 3 — actual 7.4\n",
    );
  });

  // ----- 異常系 -----
  it("条件の一覧を持たない応答は空にする", () => {
    expect(renderFailingConditions({ projectStatus: {} })).toBe("");
  });

  it("応答として読めない形も空にする", () => {
    expect(renderFailingConditions("応答ではない")).toBe("");
  });

  it("読めない項目を持つ条件も、落ちたことだけは伝える", () => {
    const payload = { projectStatus: { conditions: [{ status: "ERROR" }] } };

    expect(renderFailingConditions(payload)).toBe("- `?` ? ? — actual ?\n");
  });
});
