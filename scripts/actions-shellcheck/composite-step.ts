// composite action の定義ファイルの列挙と、その `runs.steps[].run` の抽出。
//
// 抽出は YAML パーサで行う。`run:` の値はブロックスカラーで書かれ、その中に heredoc や
// `#` を含みうるため、行単位の正規表現では本文の終端を誤る。alias（`run: *anchor`）と
// マージキー（`<<: *base`）も、`get` は解決しないため手で辿る。
//
// 各ステップは shellcheck の指摘を action.yaml の行・列へ写し戻すための位置を併せて持つ。
// スカラーの範囲の先頭はブロックスカラーなら指示子（`|`）を、そうでなければ値の先頭（引用符
// 付きなら開き引用符）を指すため、本文の開始行と列の基準は書式で分けて求める。
import path from "node:path";
import {
  type Document,
  isAlias,
  isMap,
  isScalar,
  isSeq,
  LineCounter,
  type Node,
  parseDocument,
  Scalar,
} from "yaml";
import { COMPOSITE_ACTION_DIR, collectActionDefinitions } from "../lib/composite-action-files.js";
import { errorMessage } from "../lib/error-message.js";

const COMPOSITE = "composite";
const MERGE_KEY = "<<";

// composite action の run ステップ 1 件。
export type CompositeStep = {
  // リポジトリルートからの相対パス。指摘の出力に使う。
  file: string;
  // `shell:` の値。shellcheck に渡す方言の決定に使う。
  shell: string;
  // 検査対象のシェルスクリプト本体。action.yaml から抽出したままの生テキストで、`${{ }}` を含みうる。
  script: string;
  // script の 1 行目が action.yaml の何行目に当たるか（1 始まり）。
  firstLine: number;
  // shellcheck が報告した列に加算すると action.yaml の列になる幅。
  columnBase: number;
};

// action 定義ファイル 1 件の抽出結果。
export type ActionFile = {
  file: string;
  steps: CompositeStep[];
  // パーサ自身の JS 変換で数えた run ステップ数。下の抽出（手書きのノード走査）とは
  // 経路が分かれるため、件数を突き合わせれば片方の破損を検出できる。
  expectedSteps: number;
};

// 検査対象の composite action 定義ファイル。指摘をルート相対で出すため、絶対パスで
// 集めたものを相対へ直して返す。
export function targetFiles(root: string): string[] {
  const files: string[] = [];
  collectActionDefinitions(path.join(root, COMPOSITE_ACTION_DIR), files);
  return files.map((file) => path.relative(root, file)).sort();
}

// action 定義から run ステップを抽出する。composite でない action（`using: node24` 等）と
// run を持たないステップは対象外。
export function parseActionFile(file: string, source: string): ActionFile {
  const lineCounter = new LineCounter();
  const doc = parseDocument(source, { lineCounter });
  const [parseError] = doc.errors;
  if (parseError !== undefined) {
    throw new Error(`${file}: YAML として読めません: ${parseError.message}`);
  }

  // 件数は `using:` の値と無関係に数える。`using` の綴りを取り違えた action を「対象外」に
  // 寄せると、run を持つのに 1 件も検査されない状態が緑で通る。
  const expectedSteps = countRunSteps(file, doc);

  const runs = mapValue(doc, doc.contents, "runs");
  const using = mapValue(doc, runs, "using");
  if (!using || !isScalar(using) || using.value !== COMPOSITE) {
    return { file, steps: [], expectedSteps };
  }
  // composite action の `runs.steps` はリストであることが必須。読めない形を「対象外」に
  // 寄せると、検査範囲が黙って縮んだまま緑になるため、異常として落とす。
  const steps = mapValue(doc, runs, "steps");
  if (!steps || !isSeq(steps)) {
    throw new Error(`${file}: composite action の runs.steps がリストとして読めません`);
  }

  return {
    file,
    steps: steps.items.map((item) => stepOf(doc, lineCounter, file, source, item)).filter(isStep),
    expectedSteps,
  };
}

function countRunSteps(file: string, doc: Document): number {
  let js: unknown;
  try {
    js = doc.toJS({ merge: true });
  } catch (e) {
    throw new Error(`${file}: YAML を解決できません: ${errorMessage(e)}`);
  }
  const steps = (js as { runs?: { steps?: unknown } } | null)?.runs?.steps;
  if (!Array.isArray(steps)) return 0;
  return steps.filter((step) => typeof (step as { run?: unknown } | null)?.run === "string").length;
}

function isStep(step: CompositeStep | null): step is CompositeStep {
  return step !== null;
}

function stepOf(
  doc: Document,
  lineCounter: LineCounter,
  file: string,
  source: string,
  item: unknown,
): CompositeStep | null {
  const run = mapValue(doc, item, "run");
  if (!run) return null;

  const { line, col } = position(lineCounter, run);
  if (!isScalar(run) || typeof run.value !== "string") {
    throw new Error(`${file}:${line}: run: の値が文字列ではありません`);
  }
  // ブロック折り畳み（`>`）は隣接する非空行を空白へ畳むため、本文の行と action.yaml の行が
  // 1 対 1 で対応しない。指摘の位置を写し戻せないうえ、畳まれた行がソースに無い構文を作って
  // 誤検知を生むため、リテラル（`|`）を要求する。
  if (run.type === Scalar.BLOCK_FOLDED) {
    throw new Error(
      `${file}:${line}: run: にブロック折り畳み（>）は使えません。リテラル（|）で書いてください`,
    );
  }
  // composite action の run ステップは shell: が必須。省略は GitHub 側の実行時エラーに
  // なるが、actionlint は composite action を見ないため検査の入口で落とす。
  const shell = mapValue(doc, item, "shell");
  if (!shell || !isScalar(shell) || typeof shell.value !== "string") {
    throw new Error(`${file}:${line}: run ステップに shell: の指定がありません`);
  }

  const block = run.type === Scalar.BLOCK_LITERAL;
  const firstLine = block ? line + 1 : line;
  return {
    file,
    shell: shell.value,
    script: run.value,
    firstLine,
    columnBase: columnBase(run, source, firstLine, col),
  };
}

function columnBase(run: Scalar, source: string, firstLine: number, col: number): number {
  // ブロックスカラーの本文はインデントを剥がした形で得られるため、剥がされた幅を足し戻す。
  if (run.type === Scalar.BLOCK_LITERAL) return blockIndentWidth(source, firstLine);
  // 引用符付きスカラーは範囲の先頭が開き引用符を指すため、その 1 文字分を読み飛ばす。
  if (run.type === Scalar.QUOTE_SINGLE || run.type === Scalar.QUOTE_DOUBLE) return col;
  return col - 1;
}

// ブロックスカラーのインデント幅は最初の非空行が決める（YAML の規則）。本文が空行で
// 始まる場合にその行の幅 0 を採ると、そのステップの全指摘の列がずれる。
function blockIndentWidth(source: string, firstLine: number): number {
  for (const line of source.split("\n").slice(firstLine - 1)) {
    if (line.trim() === "") continue;
    return line.length - line.trimStart().length;
  }
  return 0;
}

// マッピングからキーの値を取り出す。alias は解決し、キーが直接無ければマージキー
// （`<<`）の参照先を辿る。`get` は alias もマージキーも解決しないため手で行う。
function mapValue(doc: Document, node: unknown, key: string): Node | null {
  const map = resolveAlias(doc, node);
  /* istanbul ignore next -- 呼び出し元が渡すのはマッピングか、解決できない値のどちらか。
     前者は必ずマッピングとして解決されるため、両方が false になる経路は辿れない。 */
  if (!map || !isMap(map)) return null;

  let merged: unknown = null;
  for (const pair of map.items) {
    const name = isScalar(pair.key) ? pair.key.value : null;
    if (name === key) return resolveAlias(doc, pair.value);
    if (name === MERGE_KEY) merged = pair.value;
  }
  return mergeValue(doc, merged, key);
}

// マージキーの参照先は単一のマッピングでも、優先順に並べたシーケンスでもよい。
function mergeValue(doc: Document, merged: unknown, key: string): Node | null {
  const base = resolveAlias(doc, merged);
  if (!base) return null;
  if (!isSeq(base)) return mapValue(doc, base, key);
  for (const item of base.items) {
    const value = mapValue(doc, item, key);
    if (value) return value;
  }
  return null;
}

// alias を参照先のノードへ置き換える。参照先の無い alias は YAML として不正だが、
// パーサは errors に載せず未解決を返すため、ここで落とす。
function resolveAlias(doc: Document, node: unknown): Node | null {
  let current = node;
  while (isAlias(current)) {
    const resolved = current.resolve(doc);
    /* istanbul ignore next -- 参照先の無い alias は走査より前に通る countRunSteps の toJS が
       落とすため、ここへは届かない。走査の入口が増えたときに素通りさせないよう残す。 */
    if (!resolved) throw new Error(`参照先の無い alias があります: *${current.source}`);
    current = resolved;
  }
  return isScalar(current) || isMap(current) || isSeq(current) ? current : null;
}

function position(lineCounter: LineCounter, node: Node): { line: number; col: number } {
  /* istanbul ignore next -- 位置を問うのは定義ファイルから読んだノードだけで、必ず range を持つ。
     範囲を持たない合成ノードが混ざったときに 0 行目を指して黙らないよう残す。 */
  return node.range ? lineCounter.linePos(node.range[0]) : { line: 0, col: 1 };
}
