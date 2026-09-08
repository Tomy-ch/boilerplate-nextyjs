import { describe, expect, it } from "vitest";

import type { Observation } from "./observation";
import {
  clusterIssues,
  clusterKey,
  DEFAULT_WEIGHTS,
  type FeedbackIssue,
  failureRate,
  labelsToKinds,
  mergeWaitSec,
  REEVALUATION_DAYS,
  reevaluations,
  UNCLASSIFIED,
  waitDominated,
} from "./score";
import type { FindingKind } from "./summarize";

const DAY = 86_400;

function observationOf(over: Partial<Observation> = {}): Observation {
  return { windowId: "w1-x", openedAt: 0, closedAt: 100, phases: [], ...over };
}

function issueOf(number: number, over: Partial<FeedbackIssue> = {}): FeedbackIssue {
  return {
    number,
    kinds: [],
    observation: observationOf(),
    sections: {},
    ...over,
  };
}

describe("UNCLASSIFIED", () => {
  // ----- 正常系 -----
  it("分類の名前と衝突しない", () => {
    expect(labelsToKinds([`feedback/${UNCLASSIFIED}`])).toEqual([]);
  });
});

describe("labelsToKinds", () => {
  // ----- 正常系 -----
  it("接頭辞の付いたラベルを分類にする", () => {
    expect(labelsToKinds(["feedback", "feedback/skill", "feedback/ci"])).toEqual(["skill", "ci"]);
  });

  // ----- 異常系 -----
  it("知らない分類を捨てる", () => {
    expect(labelsToKinds(["feedback/未知", "bug"])).toEqual([]);
  });
});

describe("DEFAULT_WEIGHTS", () => {
  // ----- 正常系 -----
  it("人の介入と再発を、件数より高く置く", () => {
    expect(DEFAULT_WEIGHTS.humanIntervention).toBeGreaterThan(DEFAULT_WEIGHTS.frequency);
    expect(DEFAULT_WEIGHTS.recurrence).toBeGreaterThan(DEFAULT_WEIGHTS.frequency);
  });
});

describe("failureRate", () => {
  // ----- 正常系 -----
  it("失敗を呼び出しで割る", () => {
    expect(failureRate(observationOf({ toolCalls: 200, toolFailures: 20 }))).toBeCloseTo(0.1);
  });

  // ----- 異常系 -----
  it("観測できていなければ undefined を返す", () => {
    expect(failureRate(observationOf({ toolFailures: 20 }))).toBeUndefined();
    expect(failureRate(observationOf({ toolCalls: 0, toolFailures: 0 }))).toBeUndefined();
  });
});

describe("mergeWaitSec", () => {
  // ----- 正常系 -----
  it("PR を開いてからマージまでの区間を取り出す", () => {
    const observation = observationOf({
      phases: [
        { from: "openedAt", to: "prOpenedAt", sec: 100 },
        { from: "prOpenedAt", to: "mergedAt", sec: 900 },
      ],
    });

    expect(mergeWaitSec(observation)).toBe(900);
  });

  // ----- 異常系 -----
  it("その区間が無ければ undefined を返す", () => {
    expect(mergeWaitSec(observationOf())).toBeUndefined();
  });
});

describe("clusterKey", () => {
  // ----- 正常系 -----
  it("分類を並べ替えて鍵にする", () => {
    expect(clusterKey(issueOf(1, { kinds: ["skill", "ci"] }))).toBe("ci+skill");
  });

  // ----- 異常系 -----
  it("分類が無ければ、まとめる鍵へ落とす", () => {
    expect(clusterKey(issueOf(1))).toBe(UNCLASSIFIED);
  });
});

describe("clusterIssues", () => {
  // ----- 正常系 -----
  it("同じ鍵をまとめ、点の高い順に並べる", () => {
    const clusters = clusterIssues([
      issueOf(1, { kinds: ["skill"], observation: observationOf({ toolFailures: 1 }) }),
      issueOf(2, { kinds: ["skill"], observation: observationOf({ interrupts: 3 }) }),
      issueOf(3, { kinds: ["ci"] }),
    ]);

    expect(clusters[0]?.key).toBe("skill");
    expect(clusters[0]?.issues).toEqual([1, 2]);
    expect(clusters[0]?.isRecurring).toBe(true);
    // 件数 2 + 影響 1*2 + 介入 3*3 + 再発 1*4 = 17
    expect(clusters[0]?.score).toBe(17);
    expect(clusters[1]?.key).toBe("ci");
  });

  it("重みを差し替えられる", () => {
    const clusters = clusterIssues([issueOf(1, { kinds: ["skill"] })], {
      frequency: 10,
      impact: 0,
      humanIntervention: 0,
      recurrence: 0,
    });

    expect(clusters[0]?.score).toBe(10);
  });

  // ----- 異常系 -----
  it("issue が無ければ空にする", () => {
    expect(clusterIssues([])).toEqual([]);
  });

  it("観測できていない値を 0 として数える", () => {
    const clusters = clusterIssues([issueOf(1, { kinds: ["skill"] })]);

    expect(clusters[0]?.impact).toBe(0);
    expect(clusters[0]?.humanIntervention).toBe(0);
  });

  it("点が並んだら鍵の順で決める", () => {
    const found = clusterIssues([
      issueOf(1, { kinds: ["tooling"] }),
      issueOf(2, { kinds: ["skill"] }),
    ]);

    expect(found.map((cluster) => cluster.key)).toEqual([...found.map((c) => c.key)].sort());
  });
});

describe("waitDominated", () => {
  const dominated = issueOf(1, {
    observation: observationOf({
      phases: [
        { from: "openedAt", to: "prOpenedAt", sec: 100 },
        { from: "prOpenedAt", to: "mergedAt", sec: 900 },
      ],
    }),
  });

  // ----- 正常系 -----
  it("待ちが実装の時間を上回る窓を挙げる", () => {
    expect(waitDominated([dominated])).toEqual([1]);
  });

  // ----- 異常系 -----
  it("実装のほうが長ければ挙げない", () => {
    const worked = issueOf(2, {
      observation: observationOf({
        phases: [
          { from: "openedAt", to: "prOpenedAt", sec: 5000 },
          { from: "prOpenedAt", to: "mergedAt", sec: 900 },
        ],
      }),
    });

    expect(waitDominated([worked])).toEqual([]);
  });

  it("待ちを観測できていなければ挙げない", () => {
    expect(waitDominated([issueOf(3)])).toEqual([]);
  });

  it("番号を昇順に並べて返す", () => {
    const waiting = observationOf({
      phases: [
        { from: "prOpenedAt", to: "mergedAt", sec: 900 },
        { from: "implStartedAt", to: "commitAt", sec: 10 },
      ],
    });

    expect(
      waitDominated([issueOf(9, { observation: waiting }), issueOf(2, { observation: waiting })]),
    ).toEqual([2, 9]);
  });
});

describe("REEVALUATION_DAYS", () => {
  // ----- 正常系 -----
  it("1 週間より長い", () => {
    expect(REEVALUATION_DAYS).toBeGreaterThan(7);
  });
});

describe("reevaluations", () => {
  const kinds: readonly FindingKind[] = ["skill"];
  const landed = issueOf(1, { kinds, resolvedAt: 1000 * DAY, completed: true });

  // ----- 正常系 -----
  it("着地の後に立った同じ鍵の issue を、再発として並べる", () => {
    const found = reevaluations([landed, issueOf(2, { kinds, createdAt: 1001 * DAY })], 1020 * DAY);

    expect(found).toEqual([
      {
        key: "skill",
        landedIssue: 1,
        landedAt: 1000 * DAY,
        recurred: [2],
        due: true,
      },
    ]);
  });

  it("判定の時期が来ていなければ、その旨を返す", () => {
    expect(reevaluations([landed], 1005 * DAY)[0]?.due).toBe(false);
  });

  it("最後に閉じられたものを着地とする", () => {
    const found = reevaluations(
      [landed, issueOf(3, { kinds, resolvedAt: 1002 * DAY, completed: true })],
      1020 * DAY,
    );

    expect(found[0]?.landedIssue).toBe(3);
  });

  // ----- 異常系 -----
  it("着地が無い鍵を挙げない", () => {
    expect(reevaluations([issueOf(1, { kinds })], 1020 * DAY)).toEqual([]);
  });

  it("畳み込みで閉じたものを着地としない", () => {
    expect(
      reevaluations([issueOf(1, { kinds, resolvedAt: 1000 * DAY, completed: false })], 1020 * DAY),
    ).toEqual([]);
  });

  it("分類の無い issue を、再発の判定に使わない", () => {
    expect(
      reevaluations([issueOf(1, { resolvedAt: 1000 * DAY, completed: true })], 1020 * DAY),
    ).toEqual([]);
  });

  it("着地より前に立った issue を再発に数えない", () => {
    expect(
      reevaluations([landed, issueOf(2, { kinds, createdAt: 999 * DAY })], 1020 * DAY)[0]?.recurred,
    ).toEqual([]);
  });

  it("再発の番号を昇順に並べる", () => {
    const found = reevaluations(
      [
        landed,
        issueOf(9, { kinds, createdAt: 1002 * DAY }),
        issueOf(3, { kinds, createdAt: 1001 * DAY }),
      ],
      1100 * DAY,
    );

    expect(found[0]?.recurred).toEqual([3, 9]);
  });

  it("再発の数が並んだら鍵の順で決める", () => {
    const other = issueOf(2, { kinds: ["tooling"], resolvedAt: 1000 * DAY, completed: true });
    const found = reevaluations(
      [
        landed,
        other,
        issueOf(5, { kinds, createdAt: 1001 * DAY }),
        issueOf(6, { kinds: ["tooling"], createdAt: 1001 * DAY }),
      ],
      1100 * DAY,
    );

    expect(found.map((item) => item.key)).toEqual([...found.map((item) => item.key)].sort());
  });
});
