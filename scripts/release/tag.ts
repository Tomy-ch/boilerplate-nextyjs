// `production` HEAD へリリースタグを打ち、GitHub Release を作るときの判断。git と gh の
// 呼び出しは入口が持ち、ここは受け取った版だけで手順と文言を決める。

import {
  FETCH_TAGS_STEPS,
  logStep,
  PRODUCTION_BRANCH,
  type ReleaseStep,
  runStep,
} from "./steps.js";

/** リリースノートの置き場。 */
const RELEASE_NOTES_DIRECTORY = ".github/release";

/**
 * リリースタグが 1 本も無いときに出す行。
 *
 * @remarks
 * 次の版は最新のリリースタグから数えるので、1 本も無ければ数えようがありません。初期タグは
 * `make setup-repo` が `v0.0.0` として打ちます。
 */
export const NO_RELEASE_TAG_STEPS: readonly ReleaseStep[] = [
  logStep("❌ リリースタグが存在しません。先に初期タグ(v0.0.0)を作成してください。"),
];

/** タグを打って GitHub Release を作るまでの手順。 */
export type ReleaseTagPlan = {
  /** リリースノートの在り処。無ければ打たない。 */
  readonly notesPath: string;
  /** ノートの有無を見る前に踏む手順。 */
  readonly preparation: readonly ReleaseStep[];
  /** ノートが在るときに踏む手順。 */
  readonly steps: readonly ReleaseStep[];
  /** ノートが無いときに出す行。 */
  readonly missingNotes: readonly ReleaseStep[];
};

/** 版に対応するリリースノートのパス。 */
export function releaseNotesPath(version: string): string {
  return `${RELEASE_NOTES_DIRECTORY}/${version}.md`;
}

/**
 * `production` HEAD へタグを打ち、GitHub Release を作る手順を組む。
 *
 * @remarks
 * タグの注釈と Release の本文は同じ 1 ファイルから取ります。別々に渡せる形にすると、GitHub の
 * 表示だけが直った状態(タグの注釈は古いまま)が生まれ、どちらが正か決められなくなります。
 *
 * **ノートが無ければ何も打ちません。**タグだけ先に打つと、本文の無い版を指した ref が残り、
 * 保護されたタグは押し直せません。
 *
 * `--hard` で戻すのは、打つ対象を `origin/production` の先端に固定するためです。手元に残った
 * コミットへタグが載ると、リリースが誰の手元かで変わります。
 */
export function planReleaseTag(input: {
  readonly latest: string;
  readonly next: string;
}): ReleaseTagPlan {
  const notesPath = releaseNotesPath(input.next);

  return {
    notesPath,
    preparation: [
      logStep("🔄 productionブランチの最新を取得中..."),
      runStep("git", ["fetch", "origin", PRODUCTION_BRANCH]),
      runStep("git", ["switch", PRODUCTION_BRANCH]),
      runStep("git", ["reset", "--hard", `origin/${PRODUCTION_BRANCH}`]),
      logStep("✅ 最新のproductionを取得完了"),
      ...FETCH_TAGS_STEPS,
      logStep(`🔖 タグから最新タグバージョンを取得: ${input.latest}`),
      logStep(`➡️ 次のリリースバージョンを作成: ${input.next}`),
    ],
    steps: [
      runStep("git", ["tag", "-a", input.next, "-F", notesPath]),
      runStep("git", ["push", "origin", input.next]),
      runStep("gh", [
        "release",
        "create",
        input.next,
        "--title",
        input.next,
        "--notes-file",
        notesPath,
      ]),
      logStep(`✅ タグを打ちました ${input.next} on ${PRODUCTION_BRANCH} HEAD`),
    ],
    missingNotes: [logStep(`❌ ${notesPath} が存在しません。タグとリリースをスキップしました。`)],
  };
}
