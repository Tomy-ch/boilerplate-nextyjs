// マーカー行の分布を固定するための判定。走査は scan.ts、ここは値を見て答えるところだけを持つ。
//
// 何のためにこれが在るか（発火するマーカーと規約の例示が同じ形をしていること、例示だと宣言し
// 忘れると閉じたペアが黙って消えること）は [../README.md](../README.md) の「撤去マーカーを足したら
// 数え直す」が持つ。
//
// 数えるのが**行**であって中身でないのは、マーカーを足した / 消した瞬間にしか行数が動かないから
// である。区間の中の散文を直しても差分は出ない。

/**
 * 撤去マーカーの行。両方の族の全接尾辞を 1 本で見る。
 *
 * @remarks
 * 族の名前をここへ直接書くのは、宣言を持つ 2 つのマニフェスト（`remove-sample` /
 * `remove-boilerplate-only`）がどちらも撤去と一緒に自消滅するからです。import で引くと、
 * 先に消えたほうと一緒にこの判定も壊れます。
 *
 * コメント記号を必須にします。付けないと、`sample:begin` をコード片として含む散文まで数え、
 * 文章を直すたびに差分が揺れます。
 */
const MARKER_LINE =
  /(?:\/\/|#|<!--)\s*(?:sample|boilerplate-only):(?:begin|end|line|replace-begin|replace-with|replace-end)\b/;

/**
 * ブロックで囲む形のマーカー行。行内で完結する `:line` は含めない。
 *
 * @remarks
 * `:line` を外すのは、行内形だけが表の行で安全だからです。Markdown の表は表の行でない行に
 * 出会った時点で終わるので、コメント**行**を表の途中へ置くとそれ以降の行が表から落ちます。
 * 行内形はセルの中に納まるため表を割りません。
 */
const MARKER_BLOCK_LINE =
  /(?:\/\/|#|<!--)\s*(?:sample|boilerplate-only):(?:begin|end|replace-begin|replace-with|replace-end)\b/;

/** 表の区切り行。列の数は問わない。 */
const TABLE_DELIMITER = /^\|[\s:|-]+\|\s*$/;

/** 囲みコードの境界。中の `|` は表ではないので数えない。 */
const CODE_FENCE = /^\s*(?:```|~~~)/;

/**
 * 表として成立していない `|` 始まりの行の行番号（1 始まり）。
 *
 * @remarks
 * 空行で区切られたひとまとまりを 1 つの表とみなし、**先頭行の次が区切り行**であるものだけを
 * 表として認めます。認められなかったまとまりの `|` 始まりの行は、描画すると生のパイプを含む
 * 段落になります。
 *
 * 割れ方は 2 通りあり、どちらも同じ症状に着地するのでここでまとめて見ます。
 *
 * - **ブロックマーカーを表の途中へ置いた** —— 表の行が「消える固有名を 1 セルに束ねている」と
 *   きに、部分置換のつもりで使われます。その形は退避側へ行を丸ごと複製するので、変えたいのが
 *   数文字でも数百字の写しができます。**表は 1 行 1 実体にし、消える実体は自分の行を持って
 *   行内の `:line` で落とす**のが置き換えです
 * - **表の途中に空行が入った** —— 以降の行が区切り行を持たない別のまとまりになります
 */
export function findRowsOutsideTable(content: string): number[] {
  const lines = content.split("\n");
  const outside: number[] = [];
  let block: number[] = [];
  let fenced = false;

  const flush = (): void => {
    const first = block[0];
    const second = block[1];
    const isTable =
      first !== undefined &&
      lines[first]?.startsWith("|") === true &&
      second !== undefined &&
      TABLE_DELIMITER.test(lines[second] ?? "");

    if (!isTable) {
      for (const index of block) {
        if (lines[index]?.startsWith("|") === true) outside.push(index + 1);
      }
    }
    block = [];
  };

  lines.forEach((line, index) => {
    if (CODE_FENCE.test(line)) {
      if (!fenced) flush();
      fenced = !fenced;
      return;
    }
    if (fenced) return;
    if (line.trim() === "") {
      flush();
      return;
    }
    if (MARKER_BLOCK_LINE.test(line)) {
      // マーカー行そのものは表の行ではない。ここでまとまりが切れる。
      flush();
      return;
    }
    block.push(index);
  });
  flush();

  return outside;
}

/** 走査から外すディレクトリ名。依存の取得物と VCS の内部、および生成物。 */
export const EXCLUDED_DIRECTORIES: ReadonlySet<string> = new Set([
  ".git",
  "node_modules",
  ".next",
  "blob-report",
  "coverage",
  "coverage-scripts",
  "dist",
  "storybook-static",
]);

/**
 * 走査から外す相対パス接頭辞。
 *
 * @remarks
 * 並ぶのは**このリポジトリのソースではない領域**だけです —— ツールの生成物、作業用の置き場、
 * 別ブランチの作業ツリー、別リポジトリである基準画像の置き場。載せても再生成で戻るか、そもそも
 * 手元にそれを持つ人だけ差分が出ます。
 *
 * この判定自身のディレクトリを外すのは、宣言とテストがマーカーの形を**入力**として持つためです
 * —— 外さないと、自分を数えて自分と食い違います。
 */
export const EXCLUDED_PATH_PREFIXES: readonly string[] = [
  ".claude/worktrees/",
  ".storybook/public/",
  "baseline/images/",
  "docs/portal/guides/",
  "graphify-out/",
  "out/",
  "scripts/marker-baseline/",
  "src/app/generated/",
  "src/model/generated/",
  "tmp/",
];

/** ファイルごとのマーカー行数。値が 0 の項目は持たない（持つと「無い」の表現が 2 通りになる）。 */
export type Baseline = Readonly<Record<string, number>>;

/** 走査対象か。ディレクトリ名の除外は列挙側が行うため、ここは接頭辞だけを見る。 */
export function isBaselineTarget(relativePath: string): boolean {
  const normalized = relativePath.replaceAll("\\", "/");

  return !EXCLUDED_PATH_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

export function countMarkerLines(content: string): number {
  return content.split("\n").filter((line) => MARKER_LINE.test(line)).length;
}

/**
 * 実際とベースラインの食い違い。人が読んで判断できる文にする。
 *
 * @remarks
 * 増えた側だけでなく減った側も出します。マーカーが移動・削除されたのにベースラインが古いままだと、
 * 次に増えたときの基準がずれ、検査は在るのに何も守っていない状態になります。
 */
export function diffBaseline(actual: Baseline, expected: Baseline): string[] {
  const failures: string[] = [];

  for (const [file, count] of Object.entries(actual)) {
    const before = expected[file];

    if (before === undefined) {
      failures.push(
        `マーカー行が現れました: ${file}（${count} 行）` +
          " — 本物のマーカーならベースラインへ、規約の例示なら除去側のリテラル宣言へ",
      );
      continue;
    }
    if (before !== count) {
      failures.push(`マーカー行数が変わりました: ${file}（${before} → ${count} 行）`);
    }
  }

  for (const file of Object.keys(expected)) {
    if (actual[file] === undefined) {
      failures.push(`マーカー行が無くなりました: ${file} — ベースラインのほうが古い`);
    }
  }

  return failures.sort();
}
