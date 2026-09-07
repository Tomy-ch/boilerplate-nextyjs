/**
 * カバレッジ除外の、所有側への記録の解決。
 *
 * @remarks
 * 除外の正は `untested-modules.ts` の宣言 1 箇所で、README が持つのは対象の並びだけである。
 * ここが持つのはその解決規則だけで、ツリーの走査は
 * `scripts/coverage-exclusion.gate.test.ts` が担う。
 */

import { parseFrontmatter } from "./frontmatter";

/** frontmatter で除外を記録するキー。 */
const DECLARATION_KEY = "coverage-exclusions";

/** ディレクトリ(リポジトリルート相対)の README を読む。無ければ null。 */
export type ReadmeReader = (directory: string) => string | null;

/**
 * パターンが指す範囲の起点ディレクトリ。
 *
 * @remarks
 * ワイルドカードより前の literal な部分だけを見る。`*` の先はパターンが選ぶ範囲であって、所有の
 * 所在ではない。`src/app/**\/page.tsx` の所有は `src/app` であり、`page.tsx` が実際に置かれた
 * 深さではない。
 *
 * @param pattern - リポジトリルート相対のパターン(区切りは `/`)
 */
function literalDirectory(pattern: string): string {
  const literal = pattern.split("*")[0];
  const segments = literal.split("/");

  // 末尾が区切りで終わっていれば、その手前までが確定したディレクトリ。そうでなければ最後の
  // 区切りより前まで（末尾はファイル名か、ワイルドカードを含む名前の断片）。
  return segments.slice(0, -1).join("/");
}

/**
 * パターンを記録する README を持つディレクトリ。
 *
 * @remarks
 * 起点から遡って**最初に README を持つ**ディレクトリが所有者である。README が在ることと除外を
 * 記録していることは別なので、記録の有無ではなく README の有無で決める —— 記録の有無で決めると、
 * 書き忘れが「所有者は上のディレクトリだった」に化けて、違反が消える。
 *
 * @param pattern - リポジトリルート相対のパターン(区切りは `/`)
 * @param readReadme - ディレクトリの README を読む
 * @returns 遡っても README が無ければ null
 */
export function ownerDirectory(pattern: string, readReadme: ReadmeReader): string | null {
  const segments = literalDirectory(pattern).split("/").filter(Boolean);

  for (let depth = segments.length; depth >= 0; depth -= 1) {
    const directory = segments.slice(0, depth).join("/");

    if (readReadme(directory) !== null) {
      return directory;
    }
  }

  return null;
}

/**
 * README の frontmatter が記録している除外を読む。
 *
 * @returns 記録が無ければ null。記録があっても並びとして読めなければ空の並び
 */
function parseRecorded(source: string): readonly string[] | null {
  const frontmatter = parseFrontmatter(source);

  if (frontmatter === null || !(DECLARATION_KEY in frontmatter)) {
    return null;
  }

  const recorded = frontmatter[DECLARATION_KEY];

  return (Array.isArray(recorded) ? recorded : [recorded]).filter(
    (entry): entry is string => typeof entry === "string",
  );
}

/** 宣言と記録の食い違い 1 件。 */
export type ExclusionDrift = {
  /** 記録を持つべき README(リポジトリルート相対)。所有者が無いパターンは `(所有 README なし)`。 */
  readonly directory: string;
  /** 宣言にあるのに記録が無いもの。 */
  readonly missing: readonly string[];
  /** 記録にあるのに宣言に無いもの。 */
  readonly extra: readonly string[];
};

/** 所有 README を持たないパターンをまとめる先。 */
export const UNOWNED = "(所有 README なし)";

/**
 * 宣言と、所有 README の記録との食い違いを集める。
 *
 * @remarks
 * **両方向を見る。** 記録漏れ（宣言にあるのに README に無い）は所有側が穴に気づけない状態で、
 * 逆向き（README にあるのに宣言に無い）は撤去済みの除外が記録に残った状態である。後者を見ないと、
 * README は実態より多くの穴を告げ続け、読む人が記録そのものを信用しなくなる。
 *
 * @param patterns - 宣言されている除外(リポジトリルート相対、区切りは `/`)
 * @param readReadme - ディレクトリの README を読む
 * @param readmeDirectories - README を持つディレクトリ(リポジトリルート相対)。走査の結果を受け取る
 * @returns 食い違いのある README。無ければ空。ディレクトリ名順に並ぶ
 */
export function findExclusionDrift(
  patterns: readonly string[],
  readReadme: ReadmeReader,
  readmeDirectories: readonly string[],
): ExclusionDrift[] {
  const owned = new Map<string, Set<string>>();

  for (const pattern of patterns) {
    const directory = ownerDirectory(pattern, readReadme) ?? UNOWNED;

    owned.set(directory, (owned.get(directory) ?? new Set()).add(pattern));
  }

  const directories = new Set(owned.keys());

  // 記録だけが残った README も拾う。宣言の側から歩くと、除外が 1 つ残らず撤去されたディレクトリ
  // には二度と到達できず、実態より多くの穴を告げる記録がそこに残り続ける。
  for (const directory of readmeDirectories) {
    const source = readReadme(directory);

    if (source !== null && parseRecorded(source) !== null) {
      directories.add(directory);
    }
  }

  const drift: ExclusionDrift[] = [];

  for (const directory of [...directories].sort()) {
    const declared = owned.get(directory) ?? new Set<string>();
    const source = directory === UNOWNED ? null : readReadme(directory);
    const recorded = new Set(source === null ? [] : (parseRecorded(source) ?? []));
    const missing = [...declared].filter((pattern) => !recorded.has(pattern)).sort();
    const extra = [...recorded].filter((pattern) => !declared.has(pattern)).sort();

    if (missing.length > 0 || extra.length > 0) {
      drift.push({ directory, missing, extra });
    }
  }

  return drift;
}
