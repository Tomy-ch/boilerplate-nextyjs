// tag → SHA の解決と、付け替え検知・解決先の経過日数。ネットワークに出るのはこのモジュール
// だけで、apply / check は完全にオフラインで動く。
//
// 供給網検疫そのものの判断は [pin-quarantine](../lib/pin-quarantine.ts) が持つ（container
// image 側と共通）。ここが渡すのは経過日数の調べ方だけ。
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const NETWORK_TIMEOUT_MS = 30_000;
const MS_PER_DAY = 86_400_000;
const LS_REMOTE_COLUMNS = 2;
const HTTP_OK = 200;
const HTTP_NOT_FOUND = 404;
const MOVING_TAG_PATTERN = /^v?\d+$/;

type ReleaseResponse = { published_at?: string };
type CommitResponse = { commit?: { committer?: { date?: string } } };

type GitHubResponse<T> = { status: number; body: T | null };

// 解決先がロックファイルの記録から変わったキー 1 件。
export type MovedRef = {
  key: string;
  from: string;
  to: string;
};

// 移動の分類。repointed は付け替えを疑うもの、accepted は採用してよいもの。
export type MoveReport = {
  repointed: MovedRef[];
  accepted: MovedRef[];
};

// 解決に使う候補 1 件。tag は版の SSOT である `uses:` 末尾のコメント tag。
export type MoveCandidate = {
  key: string;
  tag: string;
  sha: string;
};

// コメント tag が「前進してよい」と宣言しているか。bare な major 番号（`v6` / `6`）だけを
// moving とみなし、宣言の外にある形（`v6.1.0` / `v6.1` / `main`）はすべて不変として扱う。
export function isMovingTag(tag: string): boolean {
  return MOVING_TAG_PATTERN.test(tag);
}

// 解決先が変わったキーを、付け替えを疑うものと採用してよいものへ分ける。
//
// 渡す sha は検疫を掛ける前の候補でなければならない。
export function classifyMoves(
  existing: Map<string, string>,
  candidates: readonly MoveCandidate[],
  allowMoved: ReadonlySet<string>,
): MoveReport {
  const report: MoveReport = { repointed: [], accepted: [] };
  for (const candidate of candidates) {
    const from = existing.get(candidate.key);
    if (from === undefined || from === candidate.sha) continue;
    const accepted = isMovingTag(candidate.tag) || allowMoved.has(candidate.key);
    const target = accepted ? report.accepted : report.repointed;
    target.push({ key: candidate.key, from, to: candidate.sha });
  }
  return report;
}

// owner/repo の tag / branch を commit SHA へ解決する。
export async function resolveSHA(repo: string, tag: string): Promise<string> {
  // --end-of-options 以降を必ず ref 名として扱わせ、`-` 始まりの tag がオプションと
  // 誤解釈されるのを防ぐ。
  const { stdout } = await execFileAsync(
    "git",
    ["ls-remote", `https://github.com/${repo}`, "--end-of-options", tag, `${tag}^{}`],
    { timeout: NETWORK_TIMEOUT_MS },
  );
  return selectSHA(stdout, tag);
}

// git ls-remote の生出力から tag に対応する commit SHA を選ぶ。優先順位は
// annotated tag の deref（`^{}`）> 軽量 tag > branch head。
export function selectSHA(out: string, tag: string): string {
  let derefSHA = "";
  let tagSHA = "";
  let headSHA = "";
  for (const line of out.trim().split("\n")) {
    const columns = line.split(/\s+/).filter((column) => column !== "");
    if (columns.length !== LS_REMOTE_COLUMNS) continue;
    const [sha, name] = columns;
    if (name === `refs/tags/${tag}^{}`) derefSHA = sha;
    else if (name === `refs/tags/${tag}`) tagSHA = sha;
    else if (name === `refs/heads/${tag}`) headSHA = sha;
  }
  const sha = derefSHA || tagSHA || headSHA;
  if (sha === "") throw new Error(`ref "${tag}" が見つかりません`);
  return sha;
}

// 解決先の経過日数。Release の published_at と commit の日付の両方を取り、**新しい方**を採る。
//
// どちらも単独では解決先 SHA の新しさを表さない。Release は tag 名に紐づくだけで、tag が別の
// commit へ付け替えられても published_at は据え置かれる（＝乗っ取り直後の SHA に何年も前の
// 日付が付く）。commit の日付は git のメタデータなので発行者が任意の値を書ける。新しい方を
// 採れば、少なくとも片方が「新しい」と言っている限り検疫は掛かる。
//
// tag 付け替えそのものの検知は classifyMoves が担う。
export async function refAgeDays(repo: string, tag: string, sha: string): Promise<number> {
  const release = await githubGet<ReleaseResponse>(
    `https://api.github.com/repos/${repo}/releases/tags/${encodeURIComponent(tag)}`,
  );
  if (release.status !== HTTP_OK && release.status !== HTTP_NOT_FOUND) {
    throw new Error(
      `GitHub API が想定外の応答を返しました: releases/tags/${tag} status=${release.status}`,
    );
  }

  const commit = await githubGet<CommitResponse>(
    `https://api.github.com/repos/${repo}/commits/${encodeURIComponent(sha)}`,
  );
  if (commit.status !== HTTP_OK) {
    throw new Error(
      `GitHub API が想定外の応答を返しました: commits/${sha} status=${commit.status}`,
    );
  }
  const commitDate = commit.body?.commit?.committer?.date;
  if (!commitDate) throw new Error(`commit ${sha} の日付を取得できませんでした`);

  const ages = [daysSince(commitDate)];
  if (release.body?.published_at) ages.push(daysSince(release.body.published_at));
  return Math.min(...ages);
}

async function githubGet<T>(url: string): Promise<GitHubResponse<T>> {
  const headers: Record<string, string> = { Accept: "application/vnd.github+json" };
  // 未認証でも 60 req/h の枠内で足りるが、トークンがあれば枠を広げる。gh CLI を常用する
  // 手元では GH_TOKEN しか無いことがあるため両方を見る。
  const token = process.env["GITHUB_TOKEN"] || process.env["GH_TOKEN"];
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const response = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(NETWORK_TIMEOUT_MS),
  });
  if (response.status !== HTTP_OK) return { status: response.status, body: null };
  return { status: response.status, body: (await response.json()) as T };
}

function daysSince(iso: string): number {
  return Math.floor((Date.now() - Date.parse(iso)) / MS_PER_DAY);
}
