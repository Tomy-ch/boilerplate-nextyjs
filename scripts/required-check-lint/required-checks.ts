// 必須ステータスチェックの宣言と、それを報告する job の実体が噛み合っているかの判定。
//
// GitHub は「context が報告されない」を「該当なし」とは読まない。よって必須へ登録してよいのは
// **すべての PR で必ずその名前を報告する job** だけで、落とす条件は
// [0153](../../docs/adr/0153-ci-configuration.md) §5 と `.makefiles/README.md` が持つ。
//
// **`if:` で降りる job は違反にしない。**降りた job は `skipped` を報告し、必須チェックはそれを
// 成功として数えるため、報告は途切れない。検査していないのではなく、検査する必要が無い。

import { parseWorkflowDocument, readJobId, readWorkflowMaps } from "../lib/workflow-files.js";

/** `pull_request` トリガの宣言のうち、報告の有無に効くもの。 */
type PullRequestTrigger = {
  /** 報告を絞るフィルタのキー名（`paths` / `paths-ignore` / `branches` / `branches-ignore`）。 */
  filters: string[];
  /** `types:` で絞っている活動種別。絞っていなければ null。 */
  types: string[] | null;
};

/** job 1 つが報告する context と、その名前が実行時に枝分かれするかどうか。 */
type JobContext = {
  /** 報告される context 名。job の `name:` があればその値、無ければ job id。 */
  context: string;
  /** `strategy.matrix` を持つか。持つと context 名は行ごとに `<名前> (<値>)` へ枝分かれする。 */
  matrix: boolean;
  /** reusable workflow の呼び出しか。呼び出しだと context 名は `<名前> / <呼び出し先の job>` になる。 */
  reusable: boolean;
};

/** workflow 1 本から読み取った、context 名と報告条件。 */
export type WorkflowContexts = {
  /** リポジトリルート相対のパス。違反の報告に使う。 */
  file: string;
  jobs: JobContext[];
  /** `on.pull_request` の宣言。トリガを持たなければ null。 */
  pullRequest: PullRequestTrigger | null;
};

/** `pull_request` を絞り、報告されない PR を生むフィルタのキー。 */
const REPORT_NARROWING_FILTERS = ["paths", "paths-ignore", "branches", "branches-ignore"] as const;

/**
 * `types:` を絞る場合でも欠かせない活動種別。
 *
 * @remarks
 * `opened` が無ければ新規 PR が、`synchronize` が無ければ push した後の commit が、その名前を
 * 一度も報告しません。どちらも必須チェックの待ちに化けます。
 */
const REQUIRED_ACTIVITY_TYPES = ["opened", "synchronize"] as const;

/**
 * ruleset の宣言から必須 context の一覧を読む。
 *
 * @remarks
 * 必須チェックの規則が無い・空である場合は例外にします。0 件を「違反なし」として返すと、
 * 宣言を読み違えた状態が合格として通り、この検査が守っている不変条件が黙って消えます。
 *
 * @throws 宣言が JSON として読めない、必須チェックの規則が無い、または 0 件のとき
 */
export function readRequiredContexts(source: string): string[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch {
    throw new Error("JSON として読めません");
  }

  const rules = (parsed as { rules?: unknown } | null)?.rules;
  if (!Array.isArray(rules)) {
    throw new TypeError("rules: が配列として読めません");
  }

  const rule = rules.find(
    (entry) => (entry as { type?: unknown } | null)?.type === "required_status_checks",
  );
  if (rule === undefined) {
    throw new Error("required_status_checks の規則がありません");
  }

  const checks = (rule as { parameters?: { required_status_checks?: unknown } }).parameters
    ?.required_status_checks;
  if (!Array.isArray(checks) || checks.length === 0) {
    throw new Error("required_status_checks が空です");
  }

  return checks.map((check, index) => {
    const context = (check as { context?: unknown } | null)?.context;
    if (typeof context !== "string") {
      throw new TypeError(`required_status_checks[${index}] の context を読み取れません`);
    }
    return context;
  });
}

/**
 * workflow 定義から context 名と `pull_request` の報告条件を読む。
 *
 * @throws YAML として読めない、マッピングでない、または `jobs:` が読めないとき
 */
export function readWorkflowContexts(file: string, source: string): WorkflowContexts {
  const doc = parseWorkflowDocument(file, source);
  const { jobs: jobsNode } = readWorkflowMaps(file, doc);

  // 値は解決済みの JS として読む。ノードのまま辿ると、alias で他の job へ退避させた宣言が
  // 参照先まで届かず、`matrix` を持つ job を持たないものとして通してしまう。
  const resolved = doc.toJS() as { on?: unknown; jobs?: Record<string, unknown> };

  const jobs = jobsNode.items.map((pair) => {
    const id = readJobId(file, pair.key);
    const job = (resolved.jobs?.[id] ?? null) as Record<string, unknown> | null;
    const name = job?.["name"];
    return {
      context: typeof name === "string" ? name : id,
      matrix: (job?.["strategy"] as { matrix?: unknown } | undefined)?.matrix !== undefined,
      reusable: typeof job?.["uses"] === "string",
    };
  });

  return { file, jobs, pullRequest: readPullRequestTrigger(resolved.on) };
}

/** `on:` の値から `pull_request` の宣言を取り出す。3 つの記法（文字列・配列・マッピング）を受ける。 */
function readPullRequestTrigger(on: unknown): PullRequestTrigger | null {
  const empty: PullRequestTrigger = { filters: [], types: null };

  if (typeof on === "string") return on === "pull_request" ? empty : null;
  if (Array.isArray(on)) return on.includes("pull_request") ? empty : null;
  if (on === null || typeof on !== "object") return null;

  if (!("pull_request" in on)) return null;
  const trigger = (on as Record<string, unknown>)["pull_request"];
  if (trigger === null || typeof trigger !== "object") return empty;

  const declared = trigger as Record<string, unknown>;
  return {
    filters: REPORT_NARROWING_FILTERS.filter((key) => key in declared),
    types: Array.isArray(declared["types"]) ? declared["types"].map(String) : null,
  };
}

/**
 * 必須 context ごとに、報告し続ける job が 1 つあるかを判定し、違反を人が読める文で返す。
 *
 * @param required - ruleset が必須に登録している context 名
 * @param workflows - リポジトリの全 workflow から読んだ context と報告条件
 */
export function findViolations(
  required: readonly string[],
  workflows: readonly WorkflowContexts[],
): string[] {
  const violations: string[] = [];

  for (const context of required) {
    // 数えるのは workflow ではなく job。同じ名前を名乗る job は 1 つの workflow の中にも並べられ
    // （job id と、別の job の `name:`）、そちらを workflow 単位で数えると 1 件に見える。
    const declaring = workflows.flatMap((candidate) =>
      candidate.jobs
        .filter((job) => job.context === context)
        .map((job) => ({ workflow: candidate, job })),
    );

    if (declaring.length === 0) {
      violations.push(
        `\`${context}\`: この名前を宣言する job がありません。報告されない context は永久に待たれます`,
      );
      continue;
    }
    if (declaring.length > 1) {
      const where = [...new Set(declaring.map((entry) => entry.workflow.file))].join(" / ");
      violations.push(
        `\`${context}\`: ${declaring.length} 個の job が同じ名前を宣言しています（${where}）。どの結果を必須にしているのか決まりません`,
      );
      continue;
    }

    const only = declaring[0];
    violations.push(
      ...findJobViolations(context, only.workflow, only.job),
      ...findTriggerViolations(context, only.workflow),
    );
  }

  return violations;
}

/** 名前が実行時に枝分かれする job を違反として挙げる。 */
function findJobViolations(context: string, workflow: WorkflowContexts, job: JobContext): string[] {
  const violations: string[] = [];
  if (job.matrix) {
    violations.push(
      `\`${context}\`: ${workflow.file} の job が matrix を持ちます。報告される名前が行ごとに枝分かれするため、この名前では報告されません`,
    );
  }
  if (job.reusable) {
    violations.push(
      `\`${context}\`: ${workflow.file} の job が reusable workflow を呼び出しています。報告される名前が \`${context} / <呼び出し先の job>\` になります`,
    );
  }
  return violations;
}

/** すべての PR で報告されるトリガになっているかを見る。 */
function findTriggerViolations(context: string, workflow: WorkflowContexts): string[] {
  const trigger = workflow.pullRequest;
  if (trigger === null) {
    return [
      `\`${context}\`: ${workflow.file} が pull_request で走りません。PR で報告されない context は永久に待たれます`,
    ];
  }

  const violations: string[] = [];
  if (trigger.filters.length > 0) {
    violations.push(
      `\`${context}\`: ${workflow.file} の pull_request が ${trigger.filters.join(" / ")} で絞られています。条件に合わない PR では報告されません`,
    );
  }

  const types = trigger.types;
  if (types !== null) {
    const missing = REQUIRED_ACTIVITY_TYPES.filter((type) => !types.includes(type));
    if (missing.length > 0) {
      violations.push(
        `\`${context}\`: ${workflow.file} の pull_request の types が ${missing.join(" / ")} を含みません。その活動では報告されません`,
      );
    }
  }

  return violations;
}
