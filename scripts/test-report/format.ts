// テスト実行系の JSON レポートから、失敗だけを取り出して報告の本文へ組む。
//
// **語彙で選り分けない。** 失敗行を文字列で拾う要約器は、分類が語彙に依存するぶん失敗の理由そのものを
// 通過行として捨てうる（[0157](../../docs/adr/0157-inspection-declaration-discipline.md)）。ここが読むのは
// 実行系が自分で分けた出口（vitest の `status` / `failureMessages`、Playwright の `ok` / `error`）なので、
// 選別は実行系が行っている。
//
// **何件のうち何件を出したかを必ず書く。** 出力を見た人が「これで全部か」を判断できないと、部分読みと
// 同じことになる。

import {
  asArray,
  isFailed,
  type JSONResult,
  type JSONSpec,
  type JSONTest,
  parseSpecs,
} from "../lib/playwright-report";

/** 失敗 1 件。どのファイルのどのケースが、何を言って落ちたか。 */
export type Failure = {
  readonly file: string;
  readonly name: string;
  readonly message: string;
};

/** 実行系によらない、報告に要るだけの形。 */
export type Summary = {
  /** 走った総数。母数を書けないと「これで全部か」に答えられない。 */
  readonly total: number;
  readonly failures: readonly Failure[];
  /** テストの失敗以外で実行が落ちたか（カバレッジの閾値割れ、実行系そのもの）。 */
  readonly failedWithoutTestFailure: boolean;
};

/** Vitest の JSON レポートのうち、報告に要る部分だけ。 */
export type VitestReport = {
  readonly numTotalTests?: number;
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

/**
 * Playwright のレポートのうち、spec の一覧以外に読むもの。
 *
 * @remarks
 * **spec の辿り方と「落ちた」の判定は [lib/playwright-report](../lib/playwright-report.ts) が持ちます。**
 * 同じ形を読むのは story 単位（`scripts/vrt`）と画面単位（`scripts/e2e`）で先例があり、ここが
 * 3 人目です。写すと判定が割れます —— 実際、spec の `ok` で足切りすると **flaky（再試行で通ったが
 * 1 度落ちた）を取りこぼします**（[0159](../../docs/adr/0159-script-structure.md)）。
 */
export type PlaywrightReport = {
  /** spec の一覧はここでは読まない。`parseSpecs` が持つ。 */
  readonly suites?: unknown;
  readonly errors?: readonly { readonly message?: string }[];
  readonly stats?: {
    readonly expected?: number;
    readonly unexpected?: number;
    readonly flaky?: number;
    readonly skipped?: number;
  };
};

const NO_REASON = "(理由の記録なし)";

/**
 * 端末の色付けだけを外す。
 *
 * @remarks
 * Playwright は `error.message` に SGR のエスケープを埋めたまま JSON へ書きます。端末なら色に
 * なりますが、コメントや issue の本文では `[2m` という字面で出て、失敗の文言に混ざります。
 *
 * **落とすのは制御文字だけで、テストの文言は 1 文字も落としません**（[0157](../../docs/adr/0157-inspection-declaration-discipline.md)）。
 */
// biome-ignore lint/suspicious/noControlCharactersInRegex: 落とす対象そのものが制御文字である。
const ANSI = /\u001B\[[0-9;]*m/g;

function decolour(text: string): string {
  return text.replace(ANSI, "");
}

/**
 * 1 つの塊に載せる上限。
 *
 * @remarks
 * 失敗 1 件だけで本文を埋めさせないため、{@link BODY_BUDGET} より十分に小さく取ります。切り出しの
 * 大きい表明や、長い call log を持つ 1 件がこれに当たります。
 */
const BLOCK_BUDGET = 8_000;

/**
 * 長すぎる塊を、落とした量を書いた上で切る。
 *
 * @remarks
 * **落としたことと落とした量を本文に残します。** 黙って切ると、読み手には短い失敗と区別が付きません
 * （[0157](../../docs/adr/0157-inspection-declaration-discipline.md)）。全文は artifact のレポートに
 * あります。
 */
function clamp(text: string, limit: number): string {
  if (text.length <= limit) return text;
  return `${text.slice(0, limit)}\n\n... (この文言は ${text.length} 文字あり、先頭 ${limit} 文字だけを載せています。全文は JSON レポートにあります)`;
}

/**
 * 道具が吐いた文字列を、1 行のコードスパンにする。
 *
 * @remarks
 * **見出しとファイル名も素通しにしません。** ケース名（`it` の説明文・story 名）とファイル名は
 * 失敗の文言と同じく**このリポジトリが書いたものではなく**、PR を出した側が決めます。素で
 * `### ${name}` に入れると、`@利用者` の通知と偽の見出し・偽のリンクが CI の名義で公開の面に
 * 載り、取り消せません。改行を潰して 1 行にし、中身より長いバッククォートで囲みます。
 */
export function codeSpan(text: string): string {
  const flat = decolour(text).replace(/\s+/g, " ").trim() || "(空)";
  const longest = Math.max(0, ...[...flat.matchAll(/`+/g)].map((run) => run[0].length));
  const fence = "`".repeat(longest + 1);
  const pad = flat.startsWith("`") || flat.endsWith("`") ? " " : "";
  return `${fence}${pad}${flat}${pad}${fence}`;
}

/**
 * 道具が吐いた文字列を、記法として読まれない塊にする。
 *
 * @remarks
 * **フェンスの長さを中身から決めます。** 失敗の文言はこのリポジトリが書いたものではなく、
 * バッククォート 3 つの行を含みうる —— 固定長のフェンスだとそこで閉じ、残りが markdown として
 * 描かれます。本文は issue やコメントへ `authored` として渡るので、閉じ損なうと道具の出力が
 * そのまま記法になります（`scripts/lib/issue-body.ts`）。
 */
export function codeBlock(text: string, limit = BLOCK_BUDGET): readonly string[] {
  const plain = clamp(decolour(text), limit);
  const longest = Math.max(0, ...[...plain.matchAll(/`+/g)].map((run) => run[0].length));
  const fence = "`".repeat(Math.max(3, longest + 1));
  return [`${fence}text`, plain, fence];
}

/**
 * Vitest のレポートから失敗を全件取り出す。
 *
 * @remarks
 * ケース単位の失敗（`assertionResults`）に加えて、**ケースへ到達しなかったファイル**（import が落ちた、
 * suite の外で throw した）も拾います。前者だけを見ると、1 件も走らなかったファイルが「失敗 0 件」として
 * 報告されます。
 */
export function collectVitestFailures(report: VitestReport): readonly Failure[] {
  const failures: Failure[] = [];

  for (const file of asArray<NonNullable<VitestReport["testResults"]>[number]>(
    report.testResults,
  )) {
    const name = file.name ?? "(不明なファイル)";
    const cases = asArray<NonNullable<typeof file.assertionResults>[number]>(file.assertionResults);

    for (const testCase of cases) {
      if (testCase.status !== "failed") continue;
      failures.push({
        file: name,
        name: testCase.fullName ?? "(不明なケース)",
        message: asArray<string>(testCase.failureMessages).join("\n").trim() || NO_REASON,
      });
    }

    const hasFailedCase = cases.some((testCase) => testCase.status === "failed");
    if (file.status === "failed" && !hasFailedCase) {
      failures.push({
        file: name,
        name: "(ケースへ到達せず)",
        message: (file.message ?? "").trim() || NO_REASON,
      });
    }
  }

  return failures;
}

/**
 * Playwright のレポートから失敗を全件取り出す。
 *
 * @remarks
 * **落ちたかの判定は `isFailed` に委ねます** —— `unexpected` と `flaky` の 2 つが落ちた側で、
 * spec の `ok` で見ると flaky が通ったことになります。spec の外で落ちたもの（config の読み込み
 * 失敗など）は `errors` が持つので、そちらも足します。
 */
export function collectPlaywrightFailures(
  specs: readonly JSONSpec[],
  report: PlaywrightReport,
): readonly Failure[] {
  const failures: Failure[] = [];

  for (const spec of specs) {
    for (const test of asArray<JSONTest>(spec.tests)) {
      if (!isFailed(test)) continue;

      const messages = asArray<JSONResult>(test.results)
        .flatMap((result) => [
          typeof (result.error as { message?: unknown })?.message === "string"
            ? String((result.error as { message: string }).message)
            : "",
          ...asArray<{ message?: unknown }>(result.errors).map((error) =>
            typeof error.message === "string" ? error.message : "",
          ),
        ])
        .filter(Boolean);

      failures.push({
        file: typeof spec.file === "string" ? spec.file : "(不明なファイル)",
        name: typeof spec.title === "string" ? spec.title : "(不明なケース)",
        message: [...new Set(messages)].join("\n").trim() || NO_REASON,
      });
    }
  }

  // **配列でない値を反復させない。** 文字列を渡されると 1 文字につき 1 件の偽の失敗を組む。
  for (const error of asArray<{ message?: string }>(report.errors)) {
    failures.push({
      file: "(spec の外)",
      name: "(実行系の失敗)",
      message: (error.message ?? "").trim() || NO_REASON,
    });
  }

  return failures;
}

/**
 * どちらの実行系のレポートかを見分けて、共通の形へ均す。
 *
 * @remarks
 * 見分けは**その実行系にしか無いキーの有無**で行い、内容の語彙は読みません。どちらでもないものは
 * `undefined` を返し、呼び出し側が「判定できない」と報告します —— 0 件の成功へ倒しません。
 *
 * **母数は実際に報告する失敗を下回らせません。** ケースへ到達せずに落ちたファイルは
 * `numTotalTests` に寄与しないので、素で書くと「全 0 件中 2 件が失敗」という自分に矛盾した
 * 見出しになります。
 *
 * @param raw - JSON レポートの中身そのもの
 */
export function summarise(raw: string): Summary | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return undefined;
  }
  if (typeof parsed !== "object" || parsed === null) return undefined;

  if ("testResults" in parsed) {
    const vitest = parsed as VitestReport;
    const failures = collectVitestFailures(vitest);
    return {
      total: Math.max(vitest.numTotalTests ?? 0, failures.length),
      failures,
      failedWithoutTestFailure: failures.length === 0 && vitest.success === false,
    };
  }

  if ("stats" in parsed || "suites" in parsed) {
    const playwright = parsed as PlaywrightReport;
    const stats = playwright.stats ?? {};
    const total =
      (stats.expected ?? 0) + (stats.unexpected ?? 0) + (stats.flaky ?? 0) + (stats.skipped ?? 0);
    const failures = collectPlaywrightFailures(parseSpecs(raw), playwright);
    return {
      total: Math.max(total, failures.length),
      failures,
      failedWithoutTestFailure: failures.length === 0 && (stats.unexpected ?? 0) > 0,
    };
  }

  return undefined;
}

/**
 * 本文の長さの上限。
 *
 * @remarks
 * 載せる先の上限より内側に置きます。PR コメントは 45,000 字で切り、issue の本文は GitHub 自体が
 * 65,536 字で拒む —— **後者は切られるのではなく issue が立ちません**。切る側に任せると、フェンスの
 * 途中で切れて残りが記法として描かれもします。
 *
 * 1,474 story を数える面で全数が一度に落ちる形は実在し（`docs/design/vrt.md` の「限界」）、失敗
 * 1 件あたりの本文は実測 2.1〜2.4 KB なので、上限が無ければ本文は MB の桁へ届きます。
 */
const BODY_BUDGET = 40_000;

/**
 * 報告の本文を組む。
 *
 * @remarks
 * **テストが 1 件も落ちていないのに実行が失敗しているときは、原因がテストではありません**（カバレッジの
 * 閾値割れ、実行系そのものの失敗）。その場合だけ、判定を持っている末尾のログを添えます。分岐は
 * 構造化された値だけで決まり、ログの語彙を読みません。
 *
 * **上限に達したら、落とした件数と残りの在処を本文へ書きます。** 黙って行を落とすのが
 * [0157](../../docs/adr/0157-inspection-declaration-discipline.md) の禁じる濾過であって、長さに
 * 上限があること自体ではありません。母数と失敗の総数は必ず先頭に出るので、載せた件数がその一部で
 * あることは本文だけで分かります。
 *
 * @param budget - 本文の上限。既定は {@link BODY_BUDGET}
 */
export function formatReport(summary: Summary, tailLog: string, budget = BODY_BUDGET): string {
  const { total, failures } = summary;

  if (failures.length === 0 && !summary.failedWithoutTestFailure) {
    return `全 ${total} 件のテストが通りました。`;
  }

  if (failures.length === 0) {
    return [
      `テストは全 ${total} 件が通り、**実行はテスト以外の理由で失敗しています**（カバレッジの閾値、`,
      "または実行系そのもの）。判定を持つ末尾のログを添えます。",
      "",
      ...codeBlock(tailLog.trim()),
    ].join("\n");
  }

  const head = `全 ${total} 件中 **${failures.length} 件が失敗**しました。`;
  const lines: string[] = [];
  let shown = 0;
  let used = head.length;

  for (const failure of failures) {
    const block = [
      `### ${codeSpan(failure.name)}`,
      "",
      codeSpan(failure.file),
      "",
      ...codeBlock(failure.message),
      "",
    ];
    const size = block.join("\n").length;
    if (shown > 0 && used + size > budget) break;
    lines.push(...block);
    used += size;
    shown += 1;
  }

  const dropped = failures.length - shown;
  const lead =
    dropped === 0
      ? `${head}以下がその全件です。`
      : `${head}本文の長さの上限に達したため、**以下はそのうち ${shown} 件**です。` +
        `残る ${dropped} 件は JSON レポート（artifact）に入っています。`;

  return [lead, "", ...lines].join("\n").trimEnd();
}
