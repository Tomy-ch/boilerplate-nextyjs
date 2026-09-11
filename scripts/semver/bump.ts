export type BumpType = "patch" | "minor" | "major";

const BUMP_TYPES: readonly BumpType[] = ["patch", "minor", "major"];

const VERSION_PATTERN = /^\d+\.\d+\.\d+$/;

/** 引数として渡された値が進め方の指定になっているか。 */
export function isBumpType(value: string): value is BumpType {
  return (BUMP_TYPES as readonly string[]).includes(value);
}

/**
 * 版の表記から `v` を落とし、`X.Y.Z` として読める形だけを通す。
 *
 * @remarks
 * `v` の有無は呼び出し側の表記ゆれで、進め方の判断には効きません。落としてから検査すれば
 * 「`v1.2.3` は通るのに `1.2.3` は通らない」といった入口ごとの差が出ません。
 */
export function normalizeVersion(version: string): string | null {
  const normalized = version.replace(/^v/, "");

  return VERSION_PATTERN.test(normalized) ? normalized : null;
}

/** 正規化済みの版を 1 段進め、`v` を付けて返す。 */
export function bumpVersion(version: string, type: BumpType): string {
  /* istanbul ignore next -- 受け取るのは正規化済みの `x.y.z` で、`split` は必ず 3 要素を返す。
     既定値は `noUncheckedIndexedAccess` の下で型を絞るためだけに置いている。 */
  const [major = 0, minor = 0, patch = 0] = version.split(".").map(Number);

  if (type === "major") {
    return `v${major + 1}.0.0`;
  }
  if (type === "minor") {
    return `v${major}.${minor + 1}.0`;
  }

  return `v${major}.${minor}.${patch + 1}`;
}
