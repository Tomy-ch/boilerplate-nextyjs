import { describe, expect, it } from "vitest";

import { parseTaskReport } from "./task-report";

describe("parseTaskReport", () => {
  // ----- 正常系 -----
  it("後段が使う鍵を、ファイルに現れた順で拾う", () => {
    const text = [
      "projectKey=example_project",
      "serverUrl=https://sonarcloud.io",
      "ceTaskId=AY-task",
      "dashboardUrl=https://sonarcloud.io/dashboard",
      "",
    ].join("\n");

    expect(parseTaskReport(text)).toEqual([
      { key: "projectKey", value: "example_project" },
      { key: "serverUrl", value: "https://sonarcloud.io" },
      { key: "ceTaskId", value: "AY-task" },
      { key: "dashboardUrl", value: "https://sonarcloud.io/dashboard" },
    ]);
  });

  it("値の中の = で切らない", () => {
    const text = "dashboardUrl=https://sonarcloud.io/dashboard?id=example&pullRequest=1";

    expect(parseTaskReport(text)).toEqual([
      { key: "dashboardUrl", value: "https://sonarcloud.io/dashboard?id=example&pullRequest=1" },
    ]);
  });

  it("後段が使わない鍵は写さない", () => {
    expect(parseTaskReport("organization=example\nceTaskId=AY-task")).toEqual([
      { key: "ceTaskId", value: "AY-task" },
    ]);
  });

  // ----- 異常系 -----
  it("= を持たない行を読み飛ばす", () => {
    expect(parseTaskReport("ceTaskId\n\nceTaskId=AY-task")).toEqual([
      { key: "ceTaskId", value: "AY-task" },
    ]);
  });

  it("鍵が 1 つも無ければ空を返す", () => {
    expect(parseTaskReport("")).toEqual([]);
  });
});
