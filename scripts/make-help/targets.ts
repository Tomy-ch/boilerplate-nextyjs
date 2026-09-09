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

/**
 * `.mk` の 1 行が一覧へ出す行。
 *
 * @remarks
 * カテゴリ見出しは空行と見出しの 2 行、説明コメント付きの `.PHONY` はターゲットごとの 1 行。
 * どちらでもなければ空。
 */
function listingLinesIn(line: string): string[] {
  const category = CATEGORY_PATTERN.exec(line);

  if (category) return ["", `📂 ${category[1]}`];

  const [, targets, comment] = PHONY_PATTERN.exec(line) ?? [];

  if (targets === undefined || comment === undefined) return [];

  return targets
    .split(/\s+/)
    .map((target) => `🛠  ${target.padEnd(TARGET_COLUMN_WIDTH)} ${comment}`);
}

export function buildTargetListing(sources: readonly MakefileSource[]): TargetListing {
  const lines = [...LISTING_HEADER];
  const undocumented: string[] = [];

  for (const source of sources) {
    for (const line of source.content.split("\n")) {
      const listed = listingLinesIn(line);

      if (listed.length > 0) {
        lines.push(...listed);
        continue;
      }

      if (UNDOCUMENTED_PHONY_PATTERN.test(line)) {
        undocumented.push(`${source.file}: ${line.trim()}`);
      }
    }
  }

  return { lines, undocumented };
}
