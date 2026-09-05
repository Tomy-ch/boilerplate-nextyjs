// リリース / hotfix ブランチを切るときの判断。git と gh の呼び出しは入口が持ち、ここは
// 受け取った観測だけで「何を、どの順で走らせるか」と「止めるときに出す行」を決める。

import {
  logStep,
  PRODUCTION_BRANCH,
  type ReleaseCommand,
  type ReleaseStep,
  runStep,
} from "./steps.js";

/** 切れるブランチの種別。そのまま接頭辞になる。 */
const RELEASE_BRANCH_PREFIXES = ["hotfix", "release"] as const;

export type ReleaseBranchPrefix = (typeof RELEASE_BRANCH_PREFIXES)[number];

/** 引数として渡された値がブランチの種別になっているか。 */
export function isReleaseBranchPrefix(value: string): value is ReleaseBranchPrefix {
  return (RELEASE_BRANCH_PREFIXES as readonly string[]).includes(value);
}

/**
 * 基準にできるタグが 1 本も無いときに出す行。
 *
 * @remarks
 * 次の版は最新のリリースタグから数えるので、1 本も無ければ数えようがありません。ここで
 * `v0.0.0` を勝手に補うと、初期タグを打っていないリポジトリが黙って `v0.0.1` から始まります。
 */
export const NO_LATEST_TAG_STEPS: readonly ReleaseStep[] = [
  logStep("❌ 最新のリリースタグを取得できませんでした。初期タグ作成が必要です。"),
  logStep("➡️ 先に make release-tag などで初期タグを作成してから再実行してください。"),
];

/** ブランチを切って既定ブランチを張り替えるまでの手順。 */
export type ReleaseBranchPlan = {
  readonly branchName: string;
  /** 名乗り。関門の手前で出す。 */
  readonly notices: readonly ReleaseStep[];
  /** 既に在るかを見る問い合わせ。成功したら在る。 */
  readonly existenceProbe: ReleaseCommand;
  /** 関門を抜けてから踏む手順。 */
  readonly steps: readonly ReleaseStep[];
};

/**
 * 次の版のブランチを `production` から切り、GitHub の既定ブランチをそこへ張り替える手順を組む。
 *
 * @remarks
 * hotfix も release も `production` から切ります([0150](../../docs/adr/0150-git-workflow.md))。
 * 出荷済みの断面から切らないと、まだ出していない変更をリリース版へ引き連れます。
 *
 * **順序は入れ替えられません。** 既定ブランチの張り替えは、push で ref が向こうに在ることが
 * 前提です。先に張り替えると、GitHub は存在しないブランチを既定として指したまま止まります。
 */
export function planReleaseBranch(input: {
  readonly latest: string;
  readonly next: string;
  readonly prefix: ReleaseBranchPrefix;
}): ReleaseBranchPlan {
  const branchName = `${input.prefix}/${input.next}`;

  return {
    branchName,
    notices: [
      logStep(`🔖 タグから最新リリースバージョンを取得: 【 ${input.latest} 】`),
      logStep(`➡️ 次のリリースバージョンを作成: 【 ${input.next} 】`),
      logStep(`🌱 ブランチを作成: ${PRODUCTION_BRANCH} → 【 ${branchName} 】`),
    ],
    existenceProbe: {
      command: "git",
      args: ["ls-remote", "--exit-code", "--heads", "origin", branchName],
    },
    steps: [
      runStep("git", ["fetch", "origin", PRODUCTION_BRANCH]),
      runStep("git", ["switch", "-c", branchName, `origin/${PRODUCTION_BRANCH}`]),
      // 切り替えで lockfile が production のものへ入れ替わる。次の段は pnpm 越しに走るため、
      // 依存の検証（`verifyDepsBeforeRun`）に掛かって手順ごと止まらないよう、ここで揃え直す。
      runStep("pnpm", ["install", "--frozen-lockfile", "--ignore-scripts"]),
      // 版はここで焼き込む。切った時点がその版を決めた時点であり、後から気づく機会は無い ——
      // production へ入ってしまえば、出荷した版と `package.json` が名乗る版がずれたまま残る。
      // コミットを作るかどうかは焼き込む側が決める（`.makefiles/README.md` の「版の焼き込み関連」）。
      runStep("make", ["version-stamp-commit", `REF=${branchName}`]),
      // push も `--no-verify`。押すのは production が全ゲートを通過した木と、その上へブランチ名
      // から導いた 1 行だけ。bypass の可否は [0151](../../docs/adr/0151-git-hooks.md) に従う。
      runStep("git", ["push", "--no-verify", "origin", branchName]),
      logStep(`⚙️ GitHub上のデフォルトブランチを ${branchName} に設定します。`),
      runStep("gh", ["repo", "edit", "--default-branch", branchName]),
      logStep(`✅ デフォルトブランチを ${branchName} に切り替えて、プッシュしました。`),
    ],
  };
}

/** 基準画像ストアを取り込んでいる位置。 */
const BASELINE_STORE_PATH = "baseline/images";

/**
 * 汚れがストアの指し先のずれだけか。
 *
 * @remarks
 * **ここを分けないと、案内が嘘になります。** ずれは撮り直しでポインタが進んだ後に実体が
 * 追いつかないと起き、`git status` には他の変更と同じ顔で出ます。案内どおり commit すると
 * **間違った基準画像の指し先を保護ブランチへ載せる**ことになり、押した後では取り消せません。
 */
function isOnlyBaselinePointer(workTreeStatus: string): boolean {
  const paths = workTreeStatus
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "")
    .map((line) => line.slice(line.indexOf(" ") + 1).trim());

  return paths.length > 0 && paths.every((path) => path === BASELINE_STORE_PATH);
}

/**
 * ブランチを切ってよいか。止めるときだけ、出す行を返す。
 *
 * @remarks
 * 見る順は変えられません。既に在るブランチを先に弾かないと、作業ツリーの汚れを直した人が
 * 二度目に「既に存在します」で止まり、直すべき対象が入れ替わって見えます。
 *
 * 汚れた作業ツリーで進めないのは、`git switch -c` が持ち越した変更をリリースブランチへ連れて
 * 行くためです。**押した後では取り消せません** —— 保護ブランチは force push を受けません。
 */
export function branchCreationBlocker(input: {
  readonly branchName: string;
  readonly branchExists: boolean;
  readonly workTreeStatus: string;
}): readonly ReleaseStep[] | null {
  if (input.branchExists) {
    return [logStep(`❌ ブランチ【 ${input.branchName} 】は既に存在します。処理を中止します。`)];
  }

  if (input.workTreeStatus.trim() !== "") {
    if (isOnlyBaselinePointer(input.workTreeStatus)) {
      return [
        logStep(
          `❌ ${BASELINE_STORE_PATH} の実体が、いま居るブランチの指す版とずれています。` +
            `git submodule update --init ${BASELINE_STORE_PATH} で合わせてから再実行してください。`,
        ),
      ];
    }

    return [
      logStep(
        "❌ 作業ツリーに未コミットの変更があります。変更をコミットまたは退避してから再実行してください。",
      ),
      runStep("git", ["status", "--short"]),
    ];
  }

  return null;
}
