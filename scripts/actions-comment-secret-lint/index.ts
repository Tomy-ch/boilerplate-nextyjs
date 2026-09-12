#!/usr/bin/env node

// PR コメントを投稿するジョブに secret が渡っていないかを検査する。
//
// Actions のシークレットマスキングは、ランナーがジョブ出力をログ表示用に捕捉する経路にしか
// 効かない。検査ログを `tee` でファイルへ落としたバイトは素通りするため、そのファイルを本文に
// する `upsert-pr-comment` では、ログ上はマスク済みに見える値でも生のまま公開 PR コメントに
// 載る。マスキングを当てにできない以上「本文を作るジョブに secret を渡さない」を規約として
// 守るしかなく、この検査はその規約が将来 `env:` 1 行で破られることへの退行ガード。
//
// `GITHUB_TOKEN` はコメント投稿そのものに必要で、かつ Actions がジョブごとに発行する短命
// トークンなので許可する。
//
// 検出できるのは `${{ }}` 式に現れる secrets コンテキストの直接参照だけ。別ジョブで secret を
// 読んで `needs.<job>.outputs` 経由で渡す間接参照は静的に追えないため、この検査は通る。
import { readFileSync } from "node:fs";
import path from "node:path";
import { listWorkflowFiles, WORKFLOW_DIR } from "../lib/workflow-files.js";
import { collectCommentActions, UPSERT_ACTION_DIR } from "./comment-actions.js";
import { findSecretReferences } from "./secret-reference.js";
import { parseWorkflow } from "./workflow.js";

const ALLOWED_SECRET = "GITHUB_TOKEN";

type Finding = {
  file: string;
  line: number;
  message: string;
};

function main(): void {
  const root = process.cwd();
  const commentActions = collectCommentActions(root, (absolute) => readFileSync(absolute, "utf8"));

  const files = listWorkflowFiles(root);
  // 検査対象 0 件は「問題なし」ではなく「検査が働いていない」。実行位置の誤りを緑で返さない。
  if (files.length === 0) {
    abort(`${WORKFLOW_DIR}/ にワークフローが見つかりません（リポジトリルートで実行してください）`);
  }

  const sources = new Map(files.map((file) => [file, readFileSync(path.join(root, file), "utf8")]));

  const postingWorkflows = resolvePostingWorkflows(sources, commentActions.dirs);
  const { findings, postingJobs } = collectFindings(sources, commentActions.dirs, postingWorkflows);

  // 定義があるのに投稿ジョブが 1 つも見つからないのは、参照の同定が壊れていることを意味する。
  // `files` の 0 件と同じで、緑で返さない。
  if (commentActions.defined && postingJobs === 0) {
    abort(
      `${UPSERT_ACTION_DIR} の定義があるのに、それを使うジョブが 1 つも見つかりません（参照の同定が壊れています）`,
    );
  }

  report(commentActions.defined, files.length, postingJobs, dedupe(findings));
}

/**
 * 投稿する workflow の集合を、増えなくなるまで回して求める。
 *
 * @remarks
 * reusable workflow の呼び出し元が投稿ジョブかどうかは、呼び出し先が投稿するかで決まる。
 * 呼び出し先がさらに別の reusable workflow を呼ぶ形も書けるため、1 巡では収まらない
 * （ローカル action の到達可能性と同じ形）。
 */
function resolvePostingWorkflows(
  sources: ReadonlyMap<string, string>,
  actionDirs: ReadonlySet<string>,
): Set<string> {
  const postingWorkflows = new Set<string>();

  for (let grew = true; grew; ) {
    grew = false;

    for (const [file, source] of sources) {
      if (postingWorkflows.has(file)) continue;
      if (parseWorkflow(file, source, actionDirs, postingWorkflows).postingJobIds.length === 0) {
        continue;
      }

      postingWorkflows.add(file);
      grew = true;
    }
  }

  return postingWorkflows;
}

/** 投稿ジョブが読む scalar から、渡してはいけない secret の参照を拾う。 */
function collectFindings(
  sources: ReadonlyMap<string, string>,
  actionDirs: ReadonlySet<string>,
  postingWorkflows: ReadonlySet<string>,
): { findings: Finding[]; postingJobs: number } {
  const findings: Finding[] = [];
  let postingJobs = 0;

  for (const [file, source] of sources) {
    const workflow = parseWorkflow(file, source, actionDirs, postingWorkflows);
    postingJobs += workflow.postingJobIds.length;
    if (workflow.postingJobIds.length === 0) continue;

    for (const scalar of workflow.texts) {
      for (const reference of findSecretReferences(scalar.text)) {
        if (reference.name?.toUpperCase() === ALLOWED_SECRET) continue;

        findings.push({
          file,
          line: scalar.lineAt(reference.offset),
          message: describeViolation(scalar.jobId, reference.name),
        });
      }
    }
  }

  return { findings, postingJobs };
}

function describeViolation(jobId: string | null, name: string | null): string {
  const reason = "マスキングは tee したファイルに効かず、生値が公開 PR コメントに載ります";
  return jobId
    ? `ジョブ \`${jobId}\` は PR コメントを投稿するため ${describe(name)} を渡せません（${reason}）`
    : `ワークフロー全体に及ぶ ${describe(name)} は PR コメントを投稿するジョブにも届きます（${reason}）`;
}

function describe(name: string | null): string {
  return name ? `\`secrets.${name}\`` : "`secrets` コンテキスト全体";
}

// 複数の投稿ジョブが同じ anchor を参照していると、同じ位置の違反が人数分積まれる。
function dedupe(findings: Finding[]): Finding[] {
  const seen = new Set<string>();
  return findings.filter((finding) => {
    const key = `${finding.file}:${finding.line}:${finding.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function report(
  defined: boolean,
  workflows: number,
  postingJobs: number,
  findings: Finding[],
): void {
  if (findings.length === 0) {
    // 投稿 action が無いリポジトリ（削除した場合など）で「N ジョブ検査した」と出すと、
    // 検査が働いた結果に見える。実際は対象が無いだけなので、そう書く。
    console.log(
      defined
        ? `✅ ワークフロー ${workflows} 件のうち PR コメントを投稿する ${postingJobs} ジョブに secret の混入はありません`
        : `✅ ${UPSERT_ACTION_DIR} の定義が無いため検査対象はありません（ワークフロー ${workflows} 件）`,
    );
    return;
  }

  let current: string | null = null;
  for (const finding of findings) {
    if (finding.file !== current) {
      console.error(`  ${finding.file}`);
      current = finding.file;
    }
    console.error(`    :${finding.line}  ${finding.message}`);
  }
  console.error(
    `❌ PR コメントを投稿するジョブへの secret の混入が ${findings.length} 件あります（検査 ${workflows} ワークフロー / ${postingJobs} ジョブ）`,
  );
  process.exit(1);
}

// 検査そのものが成立していない状態。違反（exit 1）とは区別して返す。
function abort(message: string): never {
  console.error(`❌ ${message}`);
  process.exit(2);
}

try {
  main();
} catch (e) {
  console.error(`❌ ${e instanceof Error ? e.message : String(e)}`);
  process.exit(2);
}
