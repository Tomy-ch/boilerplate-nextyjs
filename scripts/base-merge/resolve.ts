// ベースの取り込みを実行してよいかの判定と、引数・git 出力の読み取り。git の呼び出しは
// 入口([index.ts](index.ts))が持ち、ここは渡された文字列だけから答えを出す。

/** 直接の取り込み先にしないブランチ。一覧の出どころは [README](README.md)。 */
const PROTECTED_BRANCHES: ReadonlySet<string> = new Set(["production", "staging", "develop"]);

/** 保護されたブランチ族の接頭辞。`release/v1.2.3` / `hotfix/1234-...` を族ごと弾く。 */
const PROTECTED_PREFIXES = ["release/", "hotfix/"] as const;

const BASE_FLAG = "--base=";
const DRY_RUN_FLAG = "--dry-run";

/**
 * 引数の使い方を示す 1 行。
 *
 * @remarks
 * `--base` は hotfix ラインが絡むときに人が渡すためにあります。ブランチ名から推測すると、
 * 推測が最も高くつく瞬間に推測することになります。
 */
export const USAGE_MESSAGE = "使い方: base-merge [--base=<ref>] [--dry-run]";

/**
 * 取り込み先にできないブランチに立っているときに出す行。
 *
 * @remarks
 * マージしてから気付くと、作業ツリーが MERGING のまま行き場を失います。理由は
 * [README](README.md)「拒む 2 つの状態」。
 */
export const PROTECTED_BRANCH_MESSAGE =
  "保護ブランチの上ではベースを取り込みません。フィーチャーブランチへ切り替えてください";

/** 作業ツリーが汚れているときに出す行。 */
export const DIRTY_TREE_MESSAGE =
  "作業ツリーに未コミットの変更があります。マージの前に確定させてください";

/**
 * 解釈できない引数を受け取っていれば案内の 1 行を返す。すべて解釈できれば null。
 *
 * @remarks
 * 黙って捨てると、指定したつもりのベースが無視されたまま別のラインを取り込みます。
 */
export function invalidArguments(argv: readonly string[]): string | null {
  const unknown = argv.filter((arg) => !arg.startsWith(BASE_FLAG) && arg !== DRY_RUN_FLAG);

  return unknown.length === 0 ? null : `${USAGE_MESSAGE}: ${unknown.join(" ")}`;
}

/**
 * `--base=<ref>` で明示されたベース。指定が無ければ null。
 *
 * @remarks
 * 複数回渡されたときは最後の指定を採ります。シェルの慣習に合わせるためで、
 * ここで弾くと「上書きしたつもり」が使い方の誤りとして返ります。
 * 値が空(`--base=`)のものは指定と数えません —— 空のベースでマージすると
 * `origin/` を取り込もうとして、遠回りな失敗になります。
 */
export function baseOverride(argv: readonly string[]): string | null {
  const values = argv
    .filter((arg) => arg.startsWith(BASE_FLAG))
    .map((arg) => arg.slice(BASE_FLAG.length).trim())
    .filter((value) => value !== "");

  return values.at(-1) ?? null;
}

/** `--dry-run` が渡されたか。 */
export function isDryRun(argv: readonly string[]): boolean {
  return argv.includes(DRY_RUN_FLAG);
}

/**
 * いま立っているブランチが取り込み先にできないなら、その理由の 1 行を返す。できるなら null。
 *
 * @param branch - `git rev-parse --abbrev-ref HEAD` の出力
 */
export function refuseProtectedBranch(branch: string): string | null {
  const name = branch.trim();
  const isProtected =
    PROTECTED_BRANCHES.has(name) || PROTECTED_PREFIXES.some((prefix) => name.startsWith(prefix));

  return isProtected ? `${PROTECTED_BRANCH_MESSAGE}（現在: ${name}）` : null;
}

/**
 * `git status --porcelain` の出力が「マージしてよい状態」かを見る。汚れていれば理由の 1 行。
 *
 * @remarks
 * 混ざると、どちらが衝突由来かを後から見分けられません。理由は
 * [README](README.md)「拒む 2 つの状態」。
 */
export function refuseDirtyTree(statusOutput: string): string | null {
  return statusOutput.trim() === "" ? null : DIRTY_TREE_MESSAGE;
}

/**
 * `git diff --name-only --diff-filter=U` の出力から、未解決のパスを並べる。
 *
 * @remarks
 * 空行を落とすだけで、分類はしません。どのクラスに属するかは呼び出す側(`resolve-merge`)の
 * 判断で、ここが持つと分類表が 2 か所に住みます。
 */
export function conflictedPaths(diffOutput: string): readonly string[] {
  return diffOutput
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");
}
