import { describe, expect, it } from "vitest";

import {
  buildConcernPrompt,
  INTEGRATION_LABEL,
  parseConcerns,
  ROLLED_UP_REASON,
  type RollupSource,
  renderIntegrationBody,
  renderRollupComment,
  rollupDestinations,
  rollupTargets,
} from "./integration";
import type { Observation } from "./observation";

const OBSERVATION: Observation = { windowId: "w1-x", openedAt: 0, closedAt: 100, phases: [] };

function sourceOf(number: number, sections: Record<string, string>): RollupSource {
  return { number, observation: OBSERVATION, sections };
}

describe("INTEGRATION_LABEL", () => {
  // ----- 正常系 -----
  it("所見そのもののラベルと衝突しない", () => {
    expect(INTEGRATION_LABEL).not.toBe("feedback");
  });
});

describe("ROLLED_UP_REASON", () => {
  // ----- 正常系 -----
  it("着地を表す理由と区別できる", () => {
    expect(ROLLED_UP_REASON).not.toBe("completed");
  });
});

describe("rollupTargets", () => {
  // ----- 正常系 -----
  it("改善案を持つものだけを通す", () => {
    const targets = rollupTargets([
      sourceOf(1, { 改善案: "commit スキルへ寄せる" }),
      sourceOf(2, { 摩擦: "重かった" }),
    ]);

    expect(targets.map((target) => target.number)).toEqual([1]);
  });

  // ----- 異常系 -----
  it("「該当なし」を改善案として扱わない", () => {
    expect(rollupTargets([sourceOf(1, { 改善案: "該当なし" })])).toEqual([]);
    expect(rollupTargets([sourceOf(2, { 改善案: "" })])).toEqual([]);
  });
});

describe("buildConcernPrompt", () => {
  // ----- 正常系 -----
  it("所見の番号と中身を並べる", () => {
    const prompt = buildConcernPrompt([sourceOf(7, { 改善案: "commit スキルへ寄せる" })]);

    expect(prompt).toContain("## 所見 #7");
    expect(prompt).toContain("### 改善案");
    expect(prompt).toContain("commit スキルへ寄せる");
  });

  it("まとめる軸が窓ではないことを述べる", () => {
    expect(buildConcernPrompt([])).toContain("「どの窓で起きたか」ではなく「何が問題か」");
  });

  // ----- 異常系 -----
  it("空と「該当なし」の節を材料に載せない", () => {
    const prompt = buildConcernPrompt([sourceOf(7, { 摩擦: "該当なし", 改善案: "x" })]);

    expect(prompt).not.toContain("### 摩擦");
  });
});

describe("parseConcerns", () => {
  // ----- 正常系 -----
  it("見出し・根拠・本文を読み分ける", () => {
    const concerns = parseConcerns(
      "## skill: commit が重い\nsources: #1, 2\n説明の本文\n\n## doc: 索引が古い\nsources: 2\nもう 1 つ",
      [1, 2],
    );

    expect(concerns).toEqual([
      { title: "skill: commit が重い", body: "説明の本文", sources: [1, 2] },
      { title: "doc: 索引が古い", body: "もう 1 つ", sources: [2] },
    ]);
  });

  // ----- 異常系 -----
  it("根拠を持たない関心を捨てる", () => {
    expect(parseConcerns("## 根拠の無い関心\n本文だけ", [1])).toEqual([]);
  });

  it("知らない番号を根拠にしない", () => {
    expect(parseConcerns("## x\nsources: 1, 99\n本文", [1])[0]?.sources).toEqual([1]);
  });

  it("見出しが無ければ何も返さない", () => {
    expect(parseConcerns("sources: 1\n本文", [1])).toEqual([]);
  });

  it("H3 を関心の見出しと見なさない", () => {
    expect(parseConcerns("### x\nsources: 1\n本文", [1])).toEqual([]);
  });
});

describe("renderIntegrationBody", () => {
  // ----- 正常系 -----
  it("根拠を必ず並べる", () => {
    const body = renderIntegrationBody({ title: "x", body: "説明", sources: [1, 2] });

    expect(body).toContain("## 根拠");
    expect(body).toContain("- #1");
    expect(body).toContain("- #2");
  });
});

describe("renderRollupComment", () => {
  // ----- 正常系 -----
  it("畳み先を全部書く", () => {
    expect(renderRollupComment([10, 11])).toContain("#10 #11");
  });
});

describe("rollupDestinations", () => {
  // ----- 正常系 -----
  it("大元を鍵に、畳み先を集める", () => {
    const destinations = rollupDestinations([
      { issue: 10, sources: [1, 2] },
      { issue: 11, sources: [2] },
    ]);

    expect(destinations.get(1)).toEqual([10]);
    expect(destinations.get(2)).toEqual([10, 11]);
  });

  // ----- 異常系 -----
  it("作られた関心が無ければ空にする", () => {
    expect(rollupDestinations([]).size).toBe(0);
  });
});
