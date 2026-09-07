import { describe, expect, it } from "vitest";

import {
  findViolations,
  readRequiredContexts,
  readWorkflowContexts,
  type WorkflowContexts,
} from "./required-checks";

/** 必須チェックの規則を 1 つ持つ ruleset の宣言。 */
function settings(contexts: unknown): string {
  return JSON.stringify({
    rules: [
      { type: "deletion" },
      { type: "required_status_checks", parameters: { required_status_checks: contexts } },
    ],
  });
}

/** すべての PR で報告する workflow。 */
function workflow(overrides: Partial<WorkflowContexts> = {}): WorkflowContexts {
  return {
    file: ".github/workflows/lint.yaml",
    jobs: [{ context: "lint", matrix: false, reusable: false }],
    pullRequest: { filters: [], types: null },
    ...overrides,
  };
}

describe("readRequiredContexts", () => {
  // ----- 正常系 -----
  it("必須チェックの規則から context 名を順に読む", () => {
    expect(readRequiredContexts(settings([{ context: "lint" }, { context: "test" }]))).toEqual([
      "lint",
      "test",
    ]);
  });

  // ----- 異常系 -----
  it("JSON として読めない宣言を落とす", () => {
    expect(() => readRequiredContexts("{")).toThrow("JSON として読めません");
  });

  it("rules が配列でない宣言を落とす", () => {
    expect(() => readRequiredContexts(JSON.stringify({ rules: "deletion" }))).toThrow(
      "rules: が配列として読めません",
    );
  });

  it("必須チェックの規則が無い宣言を落とす", () => {
    expect(() => readRequiredContexts(JSON.stringify({ rules: [{ type: "deletion" }] }))).toThrow(
      "required_status_checks の規則がありません",
    );
  });

  it("必須チェックが 0 件の宣言を、違反なしへ寄せずに落とす", () => {
    expect(() => readRequiredContexts(settings([]))).toThrow("required_status_checks が空です");
  });

  it("必須チェックが配列でない宣言を、空と同じ扱いで落とす", () => {
    expect(() => readRequiredContexts(settings(null))).toThrow("required_status_checks が空です");
  });

  it("必須チェックの規則が parameters を持たない宣言を落とす", () => {
    const source = JSON.stringify({ rules: [{ type: "required_status_checks" }] });

    expect(() => readRequiredContexts(source)).toThrow("required_status_checks が空です");
  });

  it("rules に null が混ざっていても、規則を読み飛ばさずに探す", () => {
    const source = JSON.stringify({
      rules: [
        null,
        {
          type: "required_status_checks",
          parameters: { required_status_checks: [{ context: "lint" }] },
        },
      ],
    });

    expect(readRequiredContexts(source)).toEqual(["lint"]);
  });

  it("context を読み取れない要素の位置を示して落とす", () => {
    expect(() => readRequiredContexts(settings([{ context: "lint" }, { name: "test" }]))).toThrow(
      "required_status_checks[1]",
    );
  });
});

describe("readWorkflowContexts", () => {
  // ----- 正常系 -----
  it("job id を context 名として読む", () => {
    const parsed = readWorkflowContexts(
      "lint.yaml",
      "on:\n  pull_request:\njobs:\n  lint:\n    runs-on: ubuntu-latest\n",
    );

    expect(parsed.jobs).toEqual([{ context: "lint", matrix: false, reusable: false }]);
  });

  it("条件を持たない pull_request を、絞りなしとして読む", () => {
    const parsed = readWorkflowContexts("lint.yaml", "on:\n  pull_request:\njobs:\n  lint:\n");

    expect(parsed.pullRequest).toEqual({ filters: [], types: null });
  });

  it("pull_request をスカラーで書いた workflow を、絞りなしとして読む", () => {
    const parsed = readWorkflowContexts("lint.yaml", "on:\n  pull_request: true\njobs:\n  lint:\n");

    expect(parsed.pullRequest).toEqual({ filters: [], types: null });
  });

  it("job の name: があればそちらを context 名として読む", () => {
    const parsed = readWorkflowContexts(
      "lint.yaml",
      "on:\n  pull_request:\njobs:\n  lint:\n    name: Lint everything\n",
    );

    expect(parsed.jobs).toEqual([expect.objectContaining({ context: "Lint everything" })]);
  });

  it("matrix と reusable workflow の呼び出しを見分ける", () => {
    const parsed = readWorkflowContexts(
      "lint.yaml",
      [
        "on:",
        "  pull_request:",
        "jobs:",
        "  spread:",
        "    strategy:",
        "      matrix:",
        "        node: [22, 24]",
        "  delegated:",
        "    uses: ./.github/workflows/inner.yaml",
      ].join("\n"),
    );

    expect(parsed.jobs).toEqual([
      { context: "spread", matrix: true, reusable: false },
      { context: "delegated", matrix: false, reusable: true },
    ]);
  });

  it("pull_request のフィルタと types を読む", () => {
    const parsed = readWorkflowContexts(
      "lint.yaml",
      [
        "on:",
        "  pull_request:",
        "    paths:",
        "      - src/**",
        "    branches-ignore:",
        "      - production",
        "    types: [opened]",
        "jobs:",
        "  lint:",
      ].join("\n"),
    );

    expect(parsed.pullRequest).toEqual({
      filters: ["paths", "branches-ignore"],
      types: ["opened"],
    });
  });

  it("types を絞っていない pull_request を null で返す", () => {
    const parsed = readWorkflowContexts(
      "lint.yaml",
      "on:\n  pull_request:\n    paths:\n      - src/**\njobs:\n  lint:\n",
    );

    expect(parsed.pullRequest).toEqual({ filters: ["paths"], types: null });
  });

  it("トリガを配列で書いた workflow を読む", () => {
    const parsed = readWorkflowContexts("lint.yaml", "on: [pull_request, push]\njobs:\n  lint:\n");

    expect(parsed.pullRequest).toEqual({ filters: [], types: null });
  });

  it("トリガを文字列で書いた workflow を読む", () => {
    const parsed = readWorkflowContexts("lint.yaml", "on: pull_request\njobs:\n  lint:\n");

    expect(parsed.pullRequest).toEqual({ filters: [], types: null });
  });

  it("pull_request で走らない workflow を null で返す", () => {
    const byString = readWorkflowContexts("d.yaml", "on: push\njobs:\n  build:\n");
    const bySequence = readWorkflowContexts("d.yaml", "on: [push]\njobs:\n  build:\n");
    const byMapping = readWorkflowContexts("d.yaml", "on:\n  push:\njobs:\n  build:\n");
    const byScalar = readWorkflowContexts("d.yaml", "on: 3\njobs:\n  build:\n");

    expect([byString, bySequence, byMapping, byScalar].map((parsed) => parsed.pullRequest)).toEqual(
      [null, null, null, null],
    );
  });

  it("on: が値を持たない workflow を、pull_request で走らないものとして読む", () => {
    const parsed = readWorkflowContexts("lint.yaml", "on:\njobs:\n  lint:\n");

    expect(parsed.pullRequest).toBeNull();
  });

  // ----- 異常系 -----
  it("YAML として読めない workflow を落とす", () => {
    expect(() => readWorkflowContexts("lint.yaml", "jobs: [lint")).toThrow("YAML として読めません");
  });

  it("マッピングでない workflow を落とす", () => {
    expect(() => readWorkflowContexts("lint.yaml", "- lint")).toThrow(
      "ワークフローがマッピングとして読めません",
    );
  });

  it("jobs: が読めない workflow を、job 0 件へ寄せずに落とす", () => {
    expect(() => readWorkflowContexts("lint.yaml", "on:\n  pull_request:\n")).toThrow(
      "jobs: がマッピングとして読めません",
    );
  });

  it("ジョブ名が文字列でない workflow を落とす", () => {
    expect(() => readWorkflowContexts("lint.yaml", "jobs:\n  2026:\n")).toThrow(
      "ジョブ名が文字列として読めません",
    );
  });
});

describe("findViolations", () => {
  // ----- 正常系 -----
  it("すべての PR で報告される context に違反を報告しない", () => {
    expect(findViolations(["lint"], [workflow()])).toEqual([]);
  });

  it("必須でない job のフィルタや衝突を咎めない", () => {
    const filtered = workflow({
      file: ".github/workflows/deploy-docs.yaml",
      jobs: [{ context: "docs-build", matrix: false, reusable: false }],
      pullRequest: { filters: ["paths"], types: null },
    });

    expect(findViolations(["lint"], [workflow(), filtered])).toEqual([]);
  });

  it("types を絞っていても opened と synchronize があれば通す", () => {
    const labelled = workflow({
      pullRequest: { filters: [], types: ["opened", "synchronize", "reopened", "labeled"] },
    });

    expect(findViolations(["lint"], [labelled])).toEqual([]);
  });

  // ----- 異常系 -----
  it("宣言する job が無い context を、その名前を添えて落とす", () => {
    expect(findViolations(["e2e"], [workflow()])).toEqual([
      "`e2e`: この名前を宣言する job がありません。報告されない context は永久に待たれます",
    ]);
  });

  it("同じ名前を宣言する workflow が複数あれば、job の中身を見ずに落とす", () => {
    const collided = workflow({ file: ".github/workflows/deploy-docs.yaml" });
    const dirty = workflow({ jobs: [{ context: "lint", matrix: true, reusable: false }] });

    expect(findViolations(["lint"], [dirty, collided])).toEqual([
      "`lint`: 2 個の job が同じ名前を宣言しています（.github/workflows/lint.yaml / .github/workflows/deploy-docs.yaml）。どの結果を必須にしているのか決まりません",
    ]);
  });

  it("1 つの workflow の中で名前が重なっていても落とす", () => {
    const collided = workflow({
      jobs: [
        { context: "lint", matrix: true, reusable: false },
        { context: "lint", matrix: false, reusable: false },
      ],
    });

    expect(findViolations(["lint"], [collided])).toEqual([
      "`lint`: 2 個の job が同じ名前を宣言しています（.github/workflows/lint.yaml）。どの結果を必須にしているのか決まりません",
    ]);
  });

  it("pull_request で走らない workflow の context を落とす", () => {
    const violations = findViolations(["lint"], [workflow({ pullRequest: null })]);

    expect(violations).toEqual([
      "`lint`: .github/workflows/lint.yaml が pull_request で走りません。PR で報告されない context は永久に待たれます",
    ]);
  });

  it("絞っているフィルタを名指しして落とす", () => {
    const filtered = workflow({
      pullRequest: { filters: ["paths", "branches-ignore"], types: null },
    });

    expect(findViolations(["lint"], [filtered])).toEqual([
      "`lint`: .github/workflows/lint.yaml の pull_request が paths / branches-ignore で絞られています。条件に合わない PR では報告されません",
    ]);
  });

  it("types に足りない活動だけを名指しして落とす", () => {
    const labelled = workflow({ pullRequest: { filters: [], types: ["opened", "labeled"] } });

    expect(findViolations(["lint"], [labelled])).toEqual([
      "`lint`: .github/workflows/lint.yaml の pull_request の types が synchronize を含みません。その活動では報告されません",
    ]);
  });

  it("matrix を持つ job の context を落とす", () => {
    const spread = workflow({ jobs: [{ context: "lint", matrix: true, reusable: false }] });

    expect(findViolations(["lint"], [spread])).toEqual([
      "`lint`: .github/workflows/lint.yaml の job が matrix を持ちます。報告される名前が行ごとに枝分かれするため、この名前では報告されません",
    ]);
  });

  it("reusable workflow を呼び出す job の context を落とす", () => {
    const delegated = workflow({ jobs: [{ context: "lint", matrix: false, reusable: true }] });

    expect(findViolations(["lint"], [delegated])).toEqual([
      "`lint`: .github/workflows/lint.yaml の job が reusable workflow を呼び出しています。報告される名前が `lint / <呼び出し先の job>` になります",
    ]);
  });

  it("1 つの context が複数の理由で報告されないとき、理由をすべて並べて報告する", () => {
    const broken = workflow({
      jobs: [{ context: "lint", matrix: true, reusable: true }],
      pullRequest: { filters: ["paths", "branches"], types: ["labeled"] },
    });

    expect(findViolations(["lint"], [broken])).toEqual([
      "`lint`: .github/workflows/lint.yaml の job が matrix を持ちます。報告される名前が行ごとに枝分かれするため、この名前では報告されません",
      "`lint`: .github/workflows/lint.yaml の job が reusable workflow を呼び出しています。報告される名前が `lint / <呼び出し先の job>` になります",
      "`lint`: .github/workflows/lint.yaml の pull_request が paths / branches で絞られています。条件に合わない PR では報告されません",
      "`lint`: .github/workflows/lint.yaml の pull_request の types が opened / synchronize を含みません。その活動では報告されません",
    ]);
  });
});
