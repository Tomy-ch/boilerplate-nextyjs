#!/usr/bin/env node

// 送出された所見を期間ぶん集め、順位を付け、着地した改善を測り直す入口。
//
//   closed-loop-weekly                            直近 7 日
//   closed-loop-weekly --from A --to B            期間を指定する
//   closed-loop-weekly --consolidate              関心へ畳む（issue を作って大元を閉じる）
//
// **再計測はこのループの必須の段である**（[0160](../../../docs/adr/0160-agent-environment-loop.md)
// 決定 1）。省略した時点でループは蓄積器へ退化し、効かなかった改善も環境に残り続ける。
//
// ここは記録を読み直さない。読むのは issue に書かれた観測だけである —— 記録は手元にしか無く、
// 週次が動く時点では別の機械かもしれない（同 決定 5）。
import { execFileSync } from "node:child_process";
import os from "node:os";
import path from "node:path";

import { errorMessage } from "../../lib/error-message.js";
import { issueRefs } from "../format.js";
import {
  buildConcernPrompt,
  INTEGRATION_LABEL,
  parseConcerns,
  renderIntegrationBody,
  renderRollupComment,
  ROLLED_UP_REASON,
  rollupDestinations,
  rollupTargets,
  type Concern,
  type RollupSource,
} from "../integration.js";
import { parseObservation } from "../observation.js";
import { resolvePeriod, withinPeriod } from "../period.js";
import { toRepoSlug } from "../remote.js";
import {
  clusterIssues,
  labelsToKinds,
  reevaluations,
  waitDominated,
  type FeedbackIssue,
} from "../score.js";
import { parseSections } from "../summarize.js";
import { reportWeekly } from "../weekly-report.js";

const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..", "..");

/** 一度に読む issue の上限。越えたぶんは次の期間指定で拾う。 */
const ISSUE_LIMIT = 200;

/** 畳み込みに許さない道具。読解と同じく、外界へ出る手段は落とす。 */
const CONSOLIDATE_DENIED_TOOLS =
  "Read Bash Glob Grep Edit Write NotebookEdit WebFetch WebSearch Task";

const CONSOLIDATE_TIMEOUT_MS = 180_000;

type RawIssue = {
  readonly number: number;
  readonly body: string;
  readonly createdAt: string;
  readonly closedAt: string | null;
  readonly stateReason: string | null;
  readonly labels: readonly { readonly name: string }[];
};

function flag(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);

  return index >= 0 ? process.argv[index + 1] : undefined;
}

function gh(args: readonly string[]): string {
  return execFileSync("gh", args, { cwd: REPO_ROOT, encoding: "utf8" }).trim();
}

function epoch(iso: string | null): number | undefined {
  if (iso === null) {
    return undefined;
  }

  const seconds = Math.floor(Date.parse(iso) / 1000);

  return Number.isFinite(seconds) ? seconds : undefined;
}

/**
 * 送出先のリポジトリ。
 *
 * @remarks
 * 送出と同じく `.git` の remote から導きます。**設定項目で宛先を持たない**のは、別の項目を
 * 置いた時点でリポジトリと無関係な先を読み書きできる形が生まれるためです。
 */
function repoSlug(): string {
  const origin = gh(["repo", "view", "--json", "url", "-q", ".url"]);
  const slug = toRepoSlug(origin);

  if (slug === null) {
    throw new Error(`origin から GitHub のリポジトリを導けませんでした: ${origin}`);
  }

  return slug;
}

/**
 * 所見の issue をすべて読む。
 *
 * @remarks
 * `gh search` は REST の検索枠（30/h）を消費します。`issue list` は GraphQL 側（5,000/h）
 * なので、期間の絞り込みは取得ではなく**こちらで**行います。
 */
function fetchIssues(slug: string): readonly RawIssue[] {
  return JSON.parse(
    gh([
      "issue",
      "list",
      "-R",
      slug,
      "--label",
      "feedback",
      "--state",
      "all",
      "--limit",
      String(ISSUE_LIMIT),
      "--json",
      "number,body,createdAt,closedAt,stateReason,labels",
    ]),
  ) as RawIssue[];
}

/** モデルへ関心の分解を求める。呼べない・失敗した・時間切れなら空。 */
function consolidate(targets: readonly RollupSource[]): readonly Concern[] {
  try {
    const output = execFileSync(
      "claude",
      ["-p", "--model", "sonnet", "--disallowed-tools", CONSOLIDATE_DENIED_TOOLS],
      {
        cwd: os.tmpdir(),
        encoding: "utf8",
        input: buildConcernPrompt(targets),
        stdio: ["pipe", "pipe", "ignore"],
        timeout: CONSOLIDATE_TIMEOUT_MS,
      },
    );

    return parseConcerns(
      output,
      targets.map((target) => target.number),
    );
  } catch {
    return [];
  }
}

/** 畳んだ先の issue を作り、大元を閉じる。 */
function applyRollup(slug: string, concerns: readonly Concern[]): void {
  const created: { issue: number; sources: readonly number[] }[] = [];

  // 1 つの関心で落ちても他は畳む。全体を落とすと、既に作った先だけが残って大元が開いたまま
  // になり、次回また同じ関心が作られる。
  for (const concern of concerns) {
    try {
      const url = gh([
        "issue",
        "create",
        "-R",
        slug,
        "--title",
        concern.title,
        "--body",
        renderIntegrationBody(concern),
        "--label",
        INTEGRATION_LABEL,
      ]);
      const number = Number.parseInt(url.split("/").at(-1) ?? "", 10);

      if (!Number.isFinite(number)) {
        throw new TypeError(`URL から番号を読めない: ${url}`);
      }

      console.log(
        `  #${number} ${concern.title}  ← ${issueRefs(concern.sources)}`,
      );
      created.push({ issue: number, sources: concern.sources });
    } catch (error) {
      console.error(`統合 issue を作れませんでした（この関心だけ飛ばす）: ${errorMessage(error)}`);
    }
  }

  for (const [source, destinations] of rollupDestinations(created)) {
    try {
      gh([
        "issue",
        "close",
        String(source),
        "-R",
        slug,
        "--reason",
        ROLLED_UP_REASON,
        "--comment",
        renderRollupComment(destinations),
      ]);
    } catch (error) {
      console.error(`#${source} を閉じられませんでした: ${errorMessage(error)}`);
    }
  }
}

function main(): void {
  const slug = repoSlug();
  const period = resolvePeriod(flag("from"), flag("to"), Math.floor(Date.now() / 1000));
  const raw = fetchIssues(slug);

  // 期間の内と外を両方組み立てる。検討課題は期間内で並べるが、測り直しは「期間より前に着地した
  // 改善が期間内で再発したか」を問うので、期間外が母数から落ちると答えが出せない。
  const all: FeedbackIssue[] = [];
  const inPeriod: FeedbackIssue[] = [];
  let unparsed = 0;

  for (const item of raw) {
    const observation = parseObservation(item.body);

    if (observation === undefined) {
      // 人が手で書き換えた 1 件で週次全体を落とさない。数だけ報告する。
      unparsed += 1;

      continue;
    }

    const createdAt = epoch(item.createdAt);
    const issue: FeedbackIssue = {
      number: item.number,
      kinds: labelsToKinds(item.labels.map((label) => label.name)),
      observation,
      sections: parseSections(item.body),
      ...(createdAt === undefined ? {} : { createdAt }),
      ...(epoch(item.closedAt) === undefined ? {} : { resolvedAt: epoch(item.closedAt) }),
      completed: item.stateReason === "COMPLETED",
    };

    all.push(issue);

    if (createdAt !== undefined && withinPeriod(createdAt, period)) {
      inPeriod.push(issue);
    }
  }

  for (const line of reportWeekly({
    period,
    issues: inPeriod,
    clusters: clusterIssues(inPeriod),
    reevaluated: reevaluations(all, period.to),
    waiting: waitDominated(inPeriod),
    unparsed,
  })) {
    console.log(line);
  }

  // 畳み込みは明示したときだけ走らせる。既定を読むだけに保つのは、issue を作って閉じる副作用が
  // 既定に入ると、意図しない畳み込みが起きたときに気づく人がいないため。
  if (!process.argv.includes("--consolidate")) {
    return;
  }

  const open = new Set(raw.filter((item) => item.closedAt === null).map((item) => item.number));
  const targets = rollupTargets(
    all
      .filter((issue) => open.has(issue.number))
      .map((issue) => ({
        number: issue.number,
        observation: issue.observation,
        sections: issue.sections,
      })),
  );

  if (targets.length === 0) {
    console.log("\n統合: 畳む対象がありません（改善案を持つ未クローズの所見が無い）");

    return;
  }

  const concerns = consolidate(targets);

  if (concerns.length === 0) {
    console.log("\n統合: 関心へ分解できませんでした（何も畳んでいません）");

    return;
  }

  console.log(`\n統合: ${targets.length} 件を ${concerns.length} の関心へ畳みます`);
  applyRollup(slug, concerns);
}

/* istanbul ignore next -- CLI entry。起動経路は make closed-loop-weekly が実地で通す。 */
try {
  main();
} catch (error) {
  console.error(`❌ ${errorMessage(error)}`);
  process.exit(1);
}
