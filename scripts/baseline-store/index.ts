#!/usr/bin/env node

// 基準画像の置き場に対する操作の入口。
//
//   ref <branch>   撮影を指す ref 名を出す
//   push [branch]  撮り直した一式を置き場へ送り、サブモジュールのポインタを進める
//   report         掃除の要否を判定して本文を出す。促すときだけ終了コード 10 を返す
//   outcome        撮り直しが成立したときの文面を出す（値は環境変数から取る）
//   prune          消してよい ref を実際に消す
//
// 置き場側に workflow を持たせないため、GitHub への問い合わせはすべてここから出る。
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

import { retakenTargets } from "../../baseline/lib/targets.js";
import { composeRetakeOutcome } from "./outcome.js";
import {
  formatPrunePlan,
  isNotFound,
  needsPrune,
  parseDefaultBranch,
  planPrune,
  type SnapshotRef,
  selectLiveBranches,
  selectRetainedTags,
  snapshotRefName,
} from "./plan.js";
import { RETAINED_TAG_COUNT } from "./retention.js";

/** 主リポジトリ側のサブモジュールの位置。ここの gitlink が保持すべきコミットを指す。 */
const SUBMODULE_PATH = "baseline/images";

/** 促すときの終了コード。1 は問い合わせ自体の失敗に取ってある。 */
const NEEDS_PRUNE_EXIT_CODE = 10;

function main(argv: readonly string[]): void {
  const [command, ...rest] = argv;

  switch (command) {
    case "ref":
      printSnapshotRef(rest[0]);
      break;
    case "push":
      push(rest[0]);
      break;
    case "report":
      report();
      break;
    case "outcome":
      printOutcome();
      break;
    case "prune":
      prune(rest.includes("--dry-run"));
      break;
    default:
      fail(
        "使い方: baseline-store <ref <branch> | push [branch] | report | outcome | prune [--dry-run]>",
      );
  }
}

/**
 * 撮り直しの結果を出す。
 *
 * 値を引数ではなく環境変数から取るのは、workflow の出力をそのまま渡すため。1 つずつ引数へ
 * 並べ替えると、増やしたときに渡し忘れた 1 つが空文字として通る。
 */
function printOutcome(): void {
  const value = (name: string): string => process.env[name] ?? "";

  process.stdout.write(
    composeRetakeOutcome({
      sha: value("SHA"),
      count: value("COUNT"),
      ids: value("IDS"),
      pointerPrUrl: value("POINTER_PR"),
      screensPending: value("SCREENS_PENDING") === "true",
      headRef: value("HEAD_REF"),
      stories: value("STORIES"),
      screens: value("SCREENS"),
      images: value("IMAGES"),
      unpaired: value("UNPAIRED"),
      before: value("BEFORE"),
      after: value("AFTER"),
      storeRepository: value("STORE_REPOSITORY"),
    }),
  );
}

function printSnapshotRef(branch: string | undefined): void {
  if (!branch) fail("ブランチ名を渡してください。");
  console.log(snapshotRefName(branch));
}

/**
 * 撮り直した一式を置き場へ送り、サブモジュールのポインタを進める。
 *
 * 一式まるごとを 1 コミットにし、親は常に置き場の根にする。撮り直しどうしを繋げると古い一式が
 * 新しい一式の祖先になり、掃除でどれも落とせなくなる。
 *
 * **この形は GitHub の compare では読めない**（[vrt/README.md](../../vrt/README.md)）。動いた枚を
 * 見せるのは撮り直しのコメント側の仕事で、そのために `images=` を出す。
 *
 * 手元と CI が同じ形の木を積むよう、`make baseline-push` も撮り直しの workflow もここを通る。
 * 呼び出し側が読めるよう `before=` / `after=` / `count=` / `images=` / `unpaired=` と、撮り直した
 * 対象を見直しの入口が取る形にした `stories=` / `screens=` を出す。
 */
function push(branch: string | undefined): void {
  if (!existsSync(`${SUBMODULE_PATH}/.git`)) {
    fail(
      `${SUBMODULE_PATH} が取り込まれていません。git submodule update --init ${SUBMODULE_PATH} を実行してください。`,
    );
  }

  const target = branch ?? git(["rev-parse", "--abbrev-ref", "HEAD"]);
  const ref = snapshotRefName(target);
  const before = store(["rev-parse", "HEAD"]);

  store(["add", "--all"]);
  const staged = store(["diff", "--cached", "--name-only"]);
  if (staged === "") {
    fail("撮り直した画像が既存と同じです。基準画像は更新していません。");
  }

  // 読むのは commit の手前だけ —— 送出は置き場の根へ reset してから積むので、そのあとでは
  // 差分の相手が変わる。
  const { stories, screens, images, unpaired } = retakenTargets(
    store(["diff", "--cached", "--name-status"]).split("\n"),
  );

  const root = parseDefaultBranch(store(["ls-remote", "--symref", "origin", "HEAD"]));
  store(["fetch", "--quiet", "--depth", "1", "origin", root]);
  store(["reset", "--soft", "FETCH_HEAD"]);
  store(["commit", "--quiet", "-m", `Test: ${target} の基準画像を撮り直す`]);
  store(["push", "--quiet", "--force", "origin", `HEAD:refs/heads/${ref}`]);

  git(["add", SUBMODULE_PATH]);

  console.log(`before=${before}`);
  console.log(`after=${store(["rev-parse", "HEAD"])}`);
  // 数えるのは画像だけ。`staged` には絵を決める入力のハッシュも載る。
  console.log(`count=${images.length}`);
  console.log(`images=${images.join(",")}`);
  console.log(`unpaired=${unpaired.join(",")}`);
  console.log(`stories=${stories.join(",")}`);
  console.log(`screens=${screens.join(",")}`);
}

function report(): void {
  const { plan, sizeMiB } = buildPlan();
  console.log(formatPrunePlan(plan, sizeMiB));

  if (needsPrune(plan, sizeMiB)) {
    process.exit(NEEDS_PRUNE_EXIT_CODE);
  }
}

function prune(dryRun: boolean): void {
  const { plan, sizeMiB, images } = buildPlan();
  console.log(formatPrunePlan(plan, sizeMiB));

  if (plan.remove.length === 0) {
    console.log("\n✅ 消す対象がありません。");
    return;
  }
  if (dryRun) {
    console.log("\n🟡 DRY_RUN のため何も消していません。");
    return;
  }

  for (const ref of plan.remove) {
    gh(["api", "-X", "DELETE", `repos/${images}/git/refs/heads/${ref.name}`, "--silent"]);
    console.log(`🔸 削除: ${ref.name}`);
  }
  console.log(`\n✅ ${plan.remove.length} 本の ref を消しました。`);
  console.log("   実体の回収は GitHub 側の gc に委ねられます。容量がすぐに落ちなくても正常です。");
}

function buildPlan(): { plan: ReturnType<typeof planPrune>; sizeMiB: number; images: string } {
  const parent = ghText(["repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner"]);
  const images = resolveImagesRepository();

  const branches = selectLiveBranches(
    ghJson<{ name: string }[]>(["api", `repos/${parent}/branches`, "--paginate"]).map(
      (branch) => branch.name,
    ),
  );
  const tags = selectRetainedTags(
    ghJson<{ name: string }[]>(["api", `repos/${parent}/tags?per_page=${RETAINED_TAG_COUNT}`]).map(
      (tag) => tag.name,
    ),
  );
  const pullRequestHeads = ghJson<{ headRefOid: string }[]>([
    "pr",
    "list",
    "--state",
    "open",
    "--limit",
    "200",
    "--json",
    "headRefOid",
  ]).map((pull) => pull.headRefOid);

  const retained = new Set<string>();
  for (const ref of [...branches, ...tags, ...pullRequestHeads]) {
    const sha = gitlinkAt(parent, ref);
    if (sha) retained.add(sha);
  }

  const refs: SnapshotRef[] = ghJson<{ ref: string; object: { sha: string } }[]>([
    "api",
    `repos/${images}/git/matching-refs/heads`,
    "--paginate",
  ]).map((entry) => ({ name: entry.ref.replace(/^refs\/heads\//, ""), sha: entry.object.sha }));

  // GitHub の size は KB。閾値は MiB で宣言してあるので揃える。
  const sizeMiB = Math.round(Number(ghText(["api", `repos/${images}`, "-q", ".size"])) / 1024);

  return { plan: planPrune(refs, retained), sizeMiB, images };
}

/** `.gitmodules` の URL から置き場の owner/repo を読む。正は配線であって設定値ではない。 */
function resolveImagesRepository(): string {
  const url = readFileSync(".gitmodules", "utf8")
    .split("\n")
    .map((line) => /^[ \t]*url[ \t]*=(.*)$/.exec(line)?.[1].trim())
    .find((candidate) => candidate !== undefined && candidate !== "");

  const owned = url === undefined ? null : /github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?$/.exec(url);
  if (owned === null) fail(".gitmodules から基準画像のリポジトリを読めません。");
  return owned[1];
}

/**
 * ある ref における gitlink の sha。
 *
 * サブモジュールを持たない時点の ref（配線より前のタグなど）では 404 になる。保持すべき
 * ものが無いだけなので、そこは黙って飛ばす。
 *
 * 404 以外は投げ直す。取れなかった ref は保持しない側へ倒れるので、通信の失敗まで飛ばすと
 * 生きた基準画像が消える対象に混ざる。
 */
function gitlinkAt(parent: string, ref: string): string | undefined {
  try {
    return ghText([
      "api",
      `repos/${parent}/contents/${SUBMODULE_PATH}?ref=${encodeURIComponent(ref)}`,
      "-q",
      ".sha",
    ]);
  } catch (error) {
    if (isNotFound(stderrOf(error))) return undefined;
    throw error;
  }
}

/** `execFileSync` が投げた例外が持つ、子プロセスの stderr。 */
function stderrOf(error: unknown): string {
  if (error === null || typeof error !== "object") return "";
  const { stderr } = error as { stderr?: unknown };
  return typeof stderr === "string" ? stderr : "";
}

function ghJson<T>(args: readonly string[]): T {
  return JSON.parse(gh(args)) as T;
}

// `-q` を付けたときの gh はスカラーを裸で出す（文字列も引用符なし）ため、JSON としては読めない。
function ghText(args: readonly string[]): string {
  return gh(args).trim();
}

// 子の stderr を捕まえる。既定では親へ素通しするので、呼び出し側が握り潰した失敗
// （gitlinkAt が飛ばす 404）まで端末に出る。捕まえた stderr は失敗時の Error に載る。
function gh(args: readonly string[]): string {
  return execFileSync("gh", [...args], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function git(args: readonly string[]): string {
  return execFileSync("git", [...args], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).trim();
}

/** 置き場（サブモジュール）の中で走らせる git。 */
function store(args: readonly string[]): string {
  return git(["-C", SUBMODULE_PATH, ...args]);
}

function fail(message: string): never {
  console.error(`❌ ${message}`);
  process.exit(1);
}

try {
  main(process.argv.slice(2));
} catch (e) {
  fail(e instanceof Error ? e.message : String(e));
}
