// どの文書を見るかの宣言。走査そのものは入口([index.ts](index.ts))が持つ。
//
// 見るのは**残る側**である。前提を書いてよいのは前提と一緒に捨てられる文書だけで、それは
// `README.md` と `docs/get-started/` である（[`docs/rules.md`](../../docs/rules.md)）。

/** 走査するパス（リポジトリルート相対）。ディレクトリなら配下の `.md` を全部見る。 */
export const SCANNED_PATHS: readonly string[] = [
  "docs/adr",
  "docs/design",
  "docs/spec",
  "docs/project",
  "docs/reference",
  "docs/rules.md",
  "docs/testing-conventions.md",
  "docs/traceability.md",
  "src",
];

/**
 * 走査から外すパスと、その理由。
 *
 * @remarks
 * **理由を値の一部にしてあります。**外した覚えの無い除外は、規則として置いたつもりの無い規則と
 * 見分けが付きません（[0157](../../docs/adr/0157-inspection-declaration-discipline.md)）。
 */
export const EXCLUDED_PATHS: Readonly<Record<string, string>> = {
  // 進行中の状態を書くための文書であり、「途中である」ことがそのまま中身である。
  "docs/adr/BACKLOG.md": "未決の待ち行列そのもの。途中であることを書くのが役目",
  // 同上。作った側へ渡らない。
  "docs/plan": "こちらの計画書。作った側は受け取らない",
  // 前提と一緒に捨てられる側。
  "docs/get-started": "作った側が読み終えたら捨てる文書",
  "docs/tutorial": "作った側が読み終えたら捨てる文書",
  // 生成物。手で書く場所ではない。
  "docs/portal": "生成物",
};

/** そのパスが走査の対象か。 */
export function isScanned(relativePath: string): boolean {
  if (!relativePath.endsWith(".md")) {
    return false;
  }

  for (const excluded of Object.keys(EXCLUDED_PATHS)) {
    if (relativePath === excluded || relativePath.startsWith(`${excluded}/`)) {
      return false;
    }
  }

  return SCANNED_PATHS.some(
    (scanned) => relativePath === scanned || relativePath.startsWith(`${scanned}/`),
  );
}
