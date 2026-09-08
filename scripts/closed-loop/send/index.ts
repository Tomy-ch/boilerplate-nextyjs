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
// 外へ出るのは打刻から数えた事実だけで、セッションの記録の抜粋は出さない（同 決定 5）。
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { errorMessage } from "../../lib/error-message.js";
import { issueTitle, renderIssueBody } from "../issue.js";
import { collectWindows, toWorktreePaths, type MarksReader } from "../marks-store.js";
import { toRepoSlug } from "../remote.js";
import { parseSent, unsent, withSent, type SentIndex } from "../sent-index.js";

/** 打刻の置き場（作業ツリー相対）。 */
const MARKS_DIR = "tmp/closed-loop/marks";

/** 送出済みの索引（作業ツリー相対、追跡外）。 */
const INDEX_FILE = ".agents/private/closed-loop-sent.json";

const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..", "..");

const DRY_RUN = process.argv.includes("--dry-run");

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
function createIssue(slug: string, title: string, body: string): number {
  const url = execFileSync("gh", ["issue", "create", "-R", slug, "-t", title, "-F", "-"], {
    encoding: "utf8",
    input: body,
  }).trim();
  const number = Number.parseInt(url.split("/").at(-1) ?? "", 10);

  if (!Number.isFinite(number)) {
    throw new Error(`issue の番号を読めませんでした: ${url}`);
  }

  return number;
}

function main(): void {
  const origin = git(["remote", "get-url", "origin"]);
  const slug = toRepoSlug(origin);

  if (slug === null) {
    throw new Error(`origin から GitHub の送出先を導けませんでした: ${origin}`);
  }

  const file = indexFile();
  let index = readIndex(file);
  const pending = unsent(collectWindows(workingTreeRoots(), reader), index);

  if (pending.length === 0) {
    console.log("送る窓はありません（閉じていて、段を越えていて、未送出のもの）");

    return;
  }

  console.log(`送出先: ${slug} / 対象: ${pending.length} 件`);

  for (const window of pending) {
    const title = issueTitle(window);

    if (DRY_RUN) {
      console.log(`\n--- ${title}`);
      console.log(renderIssueBody(window));

      continue;
    }

    const number = createIssue(slug, title, renderIssueBody(window));

    // 索引は投稿の後に書く。先に書くと、投稿に失敗した窓が送出済みとして残る。
    index = withSent(index, {
      windowId: window.id,
      issue: number,
      sentAt: Math.floor(Date.now() / 1000),
    });
    writeIndex(file, index);
    console.log(`  #${number} ${title}`);
  }
}

/* istanbul ignore next -- CLI entry。起動経路は make closed-loop-send が実地で通す。 */
try {
  main();
} catch (error) {
  console.error(`❌ ${errorMessage(error)}`);
  process.exit(1);
}
