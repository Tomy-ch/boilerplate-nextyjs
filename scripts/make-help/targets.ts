/**
 * `.mk` から make ターゲットの一覧を組み立てる。
 *
 * @remarks
 * 一覧に出ないターゲットは利用者から見えないのと同じなので、説明コメントを持たない
 * `.PHONY` は落とさずに別枠で返します。呼び出し側が警告として出すことで、`make help` を
 * 通ったのに存在を知られないターゲットが増えるのを止めます。
 */

/** 走査した `.mk` 1 本分。 */
export type MakefileSource = {
  /** リポジトリ相対のパス。警告の出力に使う。 */
  file: string;
  content: string;
};

/** 組み立てた一覧。 */
export type TargetListing = {
  /** そのまま出力する一覧の行。 */
  lines: string[];
  /** 説明コメントを持たない `.PHONY` 行（`<file>: <行>` 形式）。 */
  undocumented: string[];
};

// カテゴリ見出し行。
const CATEGORY_PATTERN = /^## (.*)/;
// `.PHONY` 行（説明コメント付き。1 行に複数ターゲットを書いた場合は全件を一覧に出す）。
const PHONY_PATTERN = /^\.PHONY:\s+([^#]+?)\s*##\s*(.*)$/;
// 説明コメント（`## ...`）を持たない `.PHONY` 行。
const UNDOCUMENTED_PHONY_PATTERN = /^\.PHONY:(?!.*##)/;

const TARGET_COLUMN_WIDTH = 24;

/** 一覧の見出し。 */
export const LISTING_HEADER = [
  "📦 Makeターゲット一覧",
  "-------------------------------------------",
];

export function buildTargetListing(sources: readonly MakefileSource[]): TargetListing {
  const lines = [...LISTING_HEADER];
  const undocumented: string[] = [];

  for (const source of sources) {
    for (const line of source.content.split("\n")) {
      const category = CATEGORY_PATTERN.exec(line);

      if (category) {
        lines.push("", `📂 ${category[1]}`);
        continue;
      }

      const [, targets, comment] = PHONY_PATTERN.exec(line) ?? [];

      if (targets !== undefined && comment !== undefined) {
        for (const target of targets.split(/\s+/)) {
          lines.push(`🛠  ${target.padEnd(TARGET_COLUMN_WIDTH)} ${comment}`);
        }

        continue;
      }

      if (UNDOCUMENTED_PHONY_PATTERN.test(line)) {
        undocumented.push(`${source.file}: ${line.trim()}`);
      }
    }
  }

  return { lines, undocumented };
}
