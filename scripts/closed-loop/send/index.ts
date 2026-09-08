#!/usr/bin/env node

// 閉じた窓を、このリポジトリの issue トラッカーへ送出する入口。
//
//   closed-loop-send             送る
//   closed-loop-send --dry-run   何を送るかだけ出す
//
// 送出先は `.git` の remote から導く（[remote.ts](../remote.ts)）。**設定項目で宛先を持たない**
// —— このリポジトリが押している先そのものが、[0160](../../../docs/adr/0160-agent-environment-loop.md)
// 決定 4 の言う issue トラッカーである。
//
// 外へ出るのは数えた事実と**読解の結果**だけで、セッションの記録の抜粋は出さない（同 決定 5）。
// 逐語は手元のモデルへ渡って終わる。
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { errorMessage } from "../../lib/error-message.js";
import { selectCandidates, type Candidate } from "../candidates.js";
import { parseTranscript, withinWindow } from "../events.js";
import { issueTitle, renderIssueBody } from "../issue.js";
import { collectWindows, toWorktreePaths, type MarksReader } from "../marks-store.js";
import { toObservation } from "../observation.js";
import { markAt } from "../phases.js";
import { toRepoSlug } from "../remote.js";
import { parseSent, unsent, withSent, type SentIndex } from "../sent-index.js";
import { buildPrompt, issueLabels, parseSummary, readingGap, type Summary } from "../summarize.js";
import { countEvents, toProjectSlug } from "../transcript.js";

/** 打刻の置き場（作業ツリー相対）。 */
const MARKS_DIR = "tmp/closed-loop/marks";

/** 送出済みの索引（作業ツリー相対、追跡外）。 */
const INDEX_FILE = ".agents/private/closed-loop-sent.json";

const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..", "..");

const DRY_RUN = process.argv.includes("--dry-run");

/** 読解を省く。モデルを呼べない環境と、呼びたくないときの両方に使う。 */
const NO_SUMMARY = process.argv.includes("--no-summary");

/**
 * 読解に許さない道具。
 *
 * @remarks
 * 読解に要るのは**渡したプロンプトだけ**なので、外界へ出る手段は落とします。許可側を空に
 * しても効かないので、**拒否側で列挙**します。
 */
const SUMMARY_DENIED_TOOLS = "Read Bash Glob Grep Edit Write NotebookEdit WebFetch WebSearch Task";

/** 読解の待ち時間。越えたら読解なしとして進む —— 送出を止めない。 */
const SUMMARY_TIMEOUT_MS = 180_000;

const reader: MarksReader = {
  listWindowIds: (root) => {
    const dir = path.join(root, MARKS_DIR);

    return fs.existsSync(dir)
      ? fs
          .readdirSync(dir, { withFileTypes: true })
          .filter((entry) => entry.isDirectory())
          .map((entry) => entry.name)
      : [];
  },
  readMark: (root, id, name) => {
    const file = path.join(root, MARKS_DIR, id, name);

    return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
  },
};

function git(args: readonly string[]): string {
  return execFileSync("git", args, { cwd: REPO_ROOT, encoding: "utf8" }).trim();
}

/** このリポジトリの作業ツリー。git が答えられなければ、いま居るものだけ。 */
function workingTreeRoots(): readonly string[] {
  try {
    return toWorktreePaths(git(["worktree", "list", "--porcelain"]));
  } catch {
    return [REPO_ROOT];
  }
}

/** 索引の置き場。窓が作業ツリーに散っても、索引は本体に 1 つだけ持つ。 */
function indexFile(): string {
  try {
    return path.join(
      git(["rev-parse", "--path-format=absolute", "--git-common-dir"]),
      "..",
      INDEX_FILE,
    );
  } catch {
    return path.join(REPO_ROOT, INDEX_FILE);
  }
}

function readIndex(file: string): SentIndex {
  try {
    return parseSent(JSON.parse(fs.readFileSync(file, "utf8")));
  } catch {
    return parseSent(undefined);
  }
}

function writeIndex(file: string, index: SentIndex): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(index, null, 2)}\n`);
}

/**
 * issue を 1 件立て、その番号を返す。
 *
 * @remarks
 * `gh` の出力は issue の URL なので、末尾の数だけを取ります。数として読めなければ
 * **投稿は成ったが番号が分からない**状態であり、索引に嘘を書くより例外で止めるほうが安全です
 * —— 止まれば人が見て、同じ窓が二度立っても題で気づけます。
 */
function createIssue(slug: string, title: string, body: string, labels: readonly string[]): number {
  const args = ["issue", "create", "-R", slug, "-t", title, "-F", "-"];

  for (const label of labels) {
    args.push("-l", label);
  }

  const url = execFileSync("gh", args, {
    encoding: "utf8",
    input: body,
  }).trim();
  const number = Number.parseInt(url.split("/").at(-1) ?? "", 10);

  if (!Number.isFinite(number)) {
    throw new Error(`issue の番号を読めませんでした: ${url}`);
  }

  return number;
}

/** 記録の全行。置き場が無ければ空。 */
function readTranscripts(roots: readonly string[]): readonly string[] {
  const parent = path.join(os.homedir(), ".claude", "projects");

  return roots.flatMap((root) => {
    const dir = path.join(parent, toProjectSlug(root));

    if (!fs.existsSync(dir)) {
      return [];
    }

    return fs
      .readdirSync(dir)
      .filter((name) => name.endsWith(".jsonl"))
      .flatMap((name) => fs.readFileSync(path.join(dir, name), "utf8").split("\n"));
  });
}

/**
 * 手元のモデルに読解させる。呼べない・失敗した・時間切れなら `undefined`。
 *
 * @remarks
 * **リポジトリの外で走らせます。**中で走らせると 2 つ壊れます —— `SessionEnd` のフックが発火して
 * **いま観測している窓が閉じられ**、1 つの作業が 2 窓に割れます。加えて `.claude/settings.json` の
 * 広い `allow` を継承し、リポジトリ内のファイルへ到達できてしまいます。
 *
 * stderr は捨てます。設定の警告などが混ざると本文の解析が壊れ、**読解の成否と関係の無い出力で
 * 節が欠けます**。
 */
function readWithModel(prompt: string, candidates: readonly Candidate[]): Summary | undefined {
  try {
    const output = execFileSync(
      "claude",
      ["-p", prompt, "--disallowed-tools", SUMMARY_DENIED_TOOLS],
      {
        cwd: os.tmpdir(),
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
        timeout: SUMMARY_TIMEOUT_MS,
      },
    );

    return parseSummary(output, candidates);
  } catch {
    return undefined;
  }
}

function main(): void {
  const origin = git(["remote", "get-url", "origin"]);
  const slug = toRepoSlug(origin);

  if (slug === null) {
    throw new Error(`origin から GitHub の送出先を導けませんでした: ${origin}`);
  }

  const file = indexFile();
  let index = readIndex(file);
  const roots = workingTreeRoots();
  const pending = unsent(collectWindows(roots, reader), index);

  if (pending.length === 0) {
    console.log("送る窓はありません（閉じていて、段を越えていて、未送出のもの）");

    return;
  }

  console.log(`送出先: ${slug} / 対象: ${pending.length} 件`);

  const events = parseTranscript(readTranscripts(roots));

  for (const window of pending) {
    const openedAt = markAt(window, "openedAt");
    // 窓の時間帯に入る出来事だけを読む。開いた時刻が無い窓は、どこからどこまでか決まらない。
    const inWindow =
      openedAt === null ? [] : withinWindow(events, openedAt, markAt(window, "closedAt"));
    const hasMaterial = inWindow.length > 0;
    const observation = toObservation(window, hasMaterial ? countEvents(inWindow) : undefined);
    const candidates = selectCandidates(inWindow);
    const summary =
      NO_SUMMARY || !hasMaterial
        ? undefined
        : readWithModel(buildPrompt(observation, candidates), candidates);
    const gap = readingGap(summary, hasMaterial, NO_SUMMARY);
    const title = issueTitle(window);
    const body = renderIssueBody(window, observation, summary, gap);

    if (DRY_RUN) {
      console.log(`\n--- ${title}  [${gap}]`);
      console.log(body);

      continue;
    }

    const number = createIssue(slug, title, body, issueLabels(summary));

    // 索引は投稿の後に書く。先に書くと、投稿に失敗した窓が送出済みとして残る。
    index = withSent(index, {
      windowId: window.id,
      issue: number,
      sentAt: Math.floor(Date.now() / 1000),
    });
    writeIndex(file, index);
    console.log(`  #${number} ${title}  [${gap}]`);
  }
}

/* istanbul ignore next -- CLI entry。起動経路は make closed-loop-send が実地で通す。 */
try {
  main();
} catch (error) {
  console.error(`❌ ${errorMessage(error)}`);
  process.exit(1);
}
