// Vitest の JSON レポートから、失敗だけを取り出して報告の本文へ組む。
//
// **語彙で選り分けない。** 失敗行を文字列で拾う要約器は、分類が語彙に依存するぶん失敗の理由そのものを
// 通過行として捨てうる（[0157](../../docs/adr/0157-inspection-declaration-discipline.md)）。ここが読むのは
// 実行系が自分で分けた出口（`status` と `failureMessages`）なので、選別は vitest が行っている。
//
// **何件のうち何件を出したかを必ず書く。** 出力を見た人が「これで全部か」を判断できないと、部分読みと
// 同じことになる。

/** Vitest の JSON レポートのうち、報告に要る部分だけ。 */
export type VitestReport = {
  readonly numTotalTests?: number;
  readonly numFailedTests?: number;
  readonly success?: boolean;
  readonly testResults?: readonly {
    readonly name?: string;
    readonly status?: string;
    readonly message?: string;
    readonly assertionResults?: readonly {
      readonly fullName?: string;
      readonly status?: string;
      readonly failureMessages?: readonly string[];
    }[];
  }[];
};

/** 失敗 1 件。どのファイルのどのケースが、何を言って落ちたか。 */
export type Failure = {
  readonly file: string;
  readonly name: string;
  readonly message: string;
};

/**
 * レポートから失敗を全件取り出す。
 *
 * @remarks
 * ケース単位の失敗（`assertionResults`）に加えて、**ケースへ到達しなかったファイル**（import が落ちた、
 * suite の外で throw した）も拾います。前者だけを見ると、1 件も走らなかったファイルが「失敗 0 件」として
 * 報告されます。
 */
export function collectFailures(report: VitestReport): readonly Failure[] {
  const failures: Failure[] = [];

  for (const file of report.testResults ?? []) {
    const name = file.name ?? "(不明なファイル)";
    const cases = file.assertionResults ?? [];

    for (const testCase of cases) {
      if (testCase.status !== "failed") continue;
      failures.push({
        file: name,
        name: testCase.fullName ?? "(不明なケース)",
        message: (testCase.failureMessages ?? []).join("\n").trim() || "(理由の記録なし)",
      });
    }

    // ケースが 1 件も無いのにファイルが落ちている = 到達する前に壊れた。
    const hasFailedCase = cases.some((testCase) => testCase.status === "failed");
    if (file.status === "failed" && !hasFailedCase) {
      failures.push({
        file: name,
        name: "(ケースへ到達せず)",
        message: (file.message ?? "").trim() || "(理由の記録なし)",
      });
    }
  }

  return failures;
}

/**
 * 報告の本文を組む。
 *
 * @remarks
 * **テストが 1 件も落ちていないのに実行が失敗しているときは、原因がテストではありません**（カバレッジの
 * 閾値割れ、実行系そのものの失敗）。その場合だけ、判定を持っている末尾のログを添えます。分岐は
 * `numFailedTests` と `success` という構造化された値だけで決まり、ログの語彙を読みません。
 */
export function formatReport(report: VitestReport, tailLog: string): string {
  const total = report.numTotalTests ?? 0;
  const failures = collectFailures(report);

  if (failures.length === 0 && report.success !== false) {
    return `全 ${total} 件のテストが通りました。`;
  }

  if (failures.length === 0) {
    return [
      `テストは全 ${total} 件が通り、**実行はテスト以外の理由で失敗しています**（カバレッジの閾値、`,
      "または実行系そのもの）。判定を持つ末尾のログを添えます。",
      "",
      "```text",
      tailLog.trim(),
      "```",
    ].join("\n");
  }

  const lines = [
    `全 ${total} 件中 **${failures.length} 件が失敗**しました。以下がその全件です。`,
    "",
  ];
  for (const failure of failures) {
    lines.push(
      `### ${failure.name}`,
      "",
      `\`${failure.file}\``,
      "",
      "```text",
      failure.message,
      "```",
      "",
    );
  }

  return lines.join("\n").trimEnd();
}
