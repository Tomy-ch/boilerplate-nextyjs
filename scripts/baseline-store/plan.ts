// 基準画像の置き場に対する ref 名の組み立てと、掃除で消す ref の算出。
//
// 撮影のたびに基準画像の全数ぶんの木を持つコミットが 1 つ増える。git は内容で同一の blob を
// 共有するので枚数ぶんの実体は増えないが、ref が生きている限り木は残る。消してよいのは
// 「主リポジトリのどの生きた ref からも指されていない撮影」だけである。

import {
  LIVE_BRANCH_PATTERNS,
  PRUNE_THRESHOLDS,
  RETAINED_TAG_COUNT,
  SNAPSHOT_REF_PREFIX,
} from "./retention.js";

/** 置き場が持つブランチ 1 本。`name` は `refs/heads/` を落とした短い名前。 */
export type SnapshotRef = {
  readonly name: string;
  readonly sha: string;
};

/** 掃除の計画。`remove` に挙がった ref だけを消せば、残りは触らない。 */
export type PrunePlan = {
  readonly keep: readonly SnapshotRef[];
  readonly remove: readonly SnapshotRef[];
};

/**
 * 主リポジトリのブランチ名から、撮影を指す ref 名を作る。
 *
 * @throws ブランチ名が ref として使えない形のとき。撮り直しは push で確定するので、
 *   壊れた名前は push が拒否されるまで気づけない。手前で落とす。
 */
export function snapshotRefName(branch: string): string {
  if (!isUsableBranchName(branch)) {
    throw new Error(`ref 名に使えないブランチ名です: ${JSON.stringify(branch)}`);
  }
  return `${SNAPSHOT_REF_PREFIX}${branch}`;
}

/** 撮影を指す ref か。既定ブランチ（README を載せた根）はここに入らない。 */
export function isSnapshotRef(name: string): boolean {
  return name.startsWith(SNAPSHOT_REF_PREFIX) && name.length > SNAPSHOT_REF_PREFIX.length;
}

/**
 * 主リポジトリのブランチ全数から、基準画像を保持するものを選ぶ。
 *
 * @remarks
 * 宣言の `*` は区切りを跨ぎません。`release/*` が `release/v0.5.0/old` まで拾うと、
 * 消し忘れが「保持されている」側へ倒れて掃除が効かなくなります。
 */
export function selectLiveBranches(names: readonly string[]): string[] {
  const patterns = LIVE_BRANCH_PATTERNS.map(
    (pattern) => new RegExp(`^${pattern.split("*").map(escapeRegExp).join("[^/]*")}$`),
  );
  return names.filter((name) => patterns.some((pattern) => pattern.test(name)));
}

/** 新しい順のタグ全数から、基準画像を保持する本数だけを取る。 */
export function selectRetainedTags(names: readonly string[]): string[] {
  return names.slice(0, RETAINED_TAG_COUNT);
}

/**
 * 消してよい ref を選ぶ。
 *
 * @param refs 置き場が持つ ref の全数
 * @param retained 主リポジトリの生きた ref が指すコミットの集合
 *
 * @remarks
 * 撮影以外の ref は常に残します。置き場の既定ブランチ（README を載せた根）もここに入るので、
 * 名前を宣言して守る必要はありません。判らないものを消さないのは、掃除が取り消せないためです。
 */
export function planPrune(refs: readonly SnapshotRef[], retained: ReadonlySet<string>): PrunePlan {
  const keep: SnapshotRef[] = [];
  const remove: SnapshotRef[] = [];

  for (const ref of refs) {
    const removable = isSnapshotRef(ref.name) && !retained.has(ref.sha);
    (removable ? remove : keep).push(ref);
  }

  return { keep, remove };
}

/** 掃除を人へ促すか。閾値のどちらかを超えたときだけ鳴らす。 */
export function needsPrune(plan: PrunePlan, repositoryMiB: number): boolean {
  return (
    plan.remove.length >= PRUNE_THRESHOLDS.removableRefs ||
    repositoryMiB >= PRUNE_THRESHOLDS.repositoryMiB
  );
}

/** 報告と実行の双方が出す本文。何が消えて何が残るかを ref 名で示す。 */
export function formatPrunePlan(plan: PrunePlan, repositoryMiB: number): string {
  const lines = [
    `置き場の総量: ${repositoryMiB} MiB（閾値 ${PRUNE_THRESHOLDS.repositoryMiB} MiB）`,
    `消せる ref: ${plan.remove.length} 本（閾値 ${PRUNE_THRESHOLDS.removableRefs} 本） / 残す ref: ${plan.keep.length} 本`,
  ];

  if (plan.remove.length > 0) {
    lines.push("", "消す対象:");
    for (const ref of plan.remove) {
      lines.push(`- ${ref.name} (${ref.sha.slice(0, 7)})`);
    }
  }

  return lines.join("\n");
}

/**
 * `git ls-remote --symref origin HEAD` の出力から既定ブランチ名を取り出す。
 *
 * @remarks
 * 撮影したコミットの親はここが指す**根**です。名前を宣言側から引かずサーバへ聞くのは、
 * 置き場を作った人が既定ブランチ名を変えていても追随するためです。
 */
export function parseDefaultBranch(lsRemoteOutput: string): string {
  const branch = /^ref:\s+refs\/heads\/(\S+)\s+HEAD$/m.exec(lsRemoteOutput)?.[1];
  if (branch === undefined) {
    throw new Error("置き場の既定ブランチを解決できません。");
  }
  return branch;
}

/**
 * `gh` の失敗が 404 か。
 *
 * @param stderr 子プロセスが出した stderr そのもの。呼び出し側が組み立てた文面を渡さないこと。
 *   引数を連ねた文面を渡すと、問い合わせ先の ref 名が判定の材料に混ざる。
 *
 * @remarks
 * 見ているのは gh の人間向けの診断文です。綴りが変われば 404 を拾えなくなります。
 */
export function isNotFound(stderr: string): boolean {
  return stderr.includes("(HTTP 404)");
}

function escapeRegExp(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}

// git の ref 名の制約のうち、ブランチ名として実際に踏むものだけを見る。全数の検証は
// git 自身が push のときに行う。
function isUsableBranchName(branch: string): boolean {
  if (branch.length === 0) return false;
  if (branch.startsWith("/") || branch.endsWith("/")) return false;
  if (branch.startsWith("-") || branch.endsWith(".lock")) return false;
  if (branch.includes("//") || branch.includes("..") || branch.includes("@{")) return false;
  if (/[\s~^:?*[\\]/.test(branch)) return false;
  return ![...branch].some((character) => character < " " || character === "\u007f");
}
