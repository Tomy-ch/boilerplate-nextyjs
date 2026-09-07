// ワークフロー定義の列挙と、`jobs:` へ降りるまでの読み取り。
//
// `.github/workflows/**` を読む検査は複数あり、「どれを workflow と見るか」「読めない形を
// どう落とすか」はそのすべてで同一でなければならない。検査ごとに書き起こすと、片方だけが
// 直った状態が黙って生まれる。よってここが唯一の正となる。
//
// **読めない形は例外にする。**「job 0 件」へ寄せると、検査対象が縮んだまま緑になり、違反が
// 無いのと見分けが付かなくなる。
//
// **ジョブの境界も同じ理由で YAML パーサに判定させる。**行単位の正規表現で切ると、インデント幅や
// フロー記法といった書式の違いでヘッダが 1 つも一致せず、やはり検査対象が空のまま緑になる。書式に
// 依存しない形にしておけば、テンプレートから作った側がワークフローを別の記法で書き直しても検査は残る。
import path from "node:path";

import {
  type Document,
  isMap,
  isScalar,
  type LineCounter,
  parseDocument,
  type YAMLMap,
} from "yaml";

import { readDirOrEmpty } from "./composite-action-files.js";

/** ワークフロー定義を置くディレクトリ（リポジトリルート相対）。 */
export const WORKFLOW_DIR = ".github/workflows";

/** ワークフロー定義として読む拡張子。 */
const WORKFLOW_EXTENSIONS: ReadonlySet<string> = new Set([".yaml", ".yml"]);

const JOBS_KEY = "jobs";

/**
 * ディレクトリの中身からワークフロー定義を選び、リポジトリルート相対の一覧にする。
 *
 * @remarks
 * 読み取り自体は呼び出し側が行い、ここは「どれをワークフローと見るか」だけを決めます。並びを
 * 固定するのは、報告の順が実行環境の列挙順で変わると、同じツリーに対する出力が場所ごとに
 * 違って見えるためです。
 *
 * @param dir - リポジトリルート相対のディレクトリ
 * @param names - そのディレクトリに実在するファイル名
 */
export function selectWorkflowFiles(dir: string, names: readonly string[]): string[] {
  return names
    .filter((name) => WORKFLOW_EXTENSIONS.has(path.extname(name)))
    .map((name) => `${dir}/${name}`)
    .sort();
}

/**
 * リポジトリのワークフロー定義を、リポジトリルート相対のパスで並べて返す。
 *
 * @remarks
 * ディレクトリが無ければ空を返します。ワークフローを 1 つも持たないリポジトリはあり得るため、
 * 「無い」は読み取りの失敗ではありません。**0 件を検査不成立と見るかどうかは呼び出し側の
 * 判断**で、ここは事実だけを返します。
 */
export function listWorkflowFiles(root: string): string[] {
  const dir = path.join(root, WORKFLOW_DIR);
  const names = readDirOrEmpty(dir)
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name);

  return selectWorkflowFiles(WORKFLOW_DIR, names);
}

/**
 * ワークフロー定義を YAML として読む。
 *
 * @param lineCounter - 指摘をソースの行へ写し戻す呼び出し側だけが渡す
 * @throws YAML として読めないとき
 */
export function parseWorkflowDocument(
  file: string,
  source: string,
  lineCounter?: LineCounter,
): Document {
  const doc = parseDocument(source, lineCounter === undefined ? {} : { lineCounter });
  if (doc.errors.length > 0) {
    throw new Error(`${file}: YAML として読めません: ${doc.errors[0].message}`);
  }
  return doc;
}

/**
 * ワークフローのルートと `jobs:` をマッピングとして取り出す。
 *
 * @remarks
 * ルートも一緒に返すのは、`jobs:` の外に置かれた宣言まで走査する呼び出し側が、絞り込み済みの
 * 型を得るために同じ検査をもう一度書かずに済むようにするためです。
 *
 * @throws ワークフローがマッピングでない、または `jobs:` がマッピングとして読めないとき
 */
export function readWorkflowMaps(file: string, doc: Document): { root: YAMLMap; jobs: YAMLMap } {
  const root = doc.contents;
  if (!isMap(root)) {
    throw new Error(`${file}: ワークフローがマッピングとして読めません`);
  }

  const jobs = doc.getIn([JOBS_KEY], true);
  if (!isMap(jobs)) {
    throw new Error(`${file}: jobs: がマッピングとして読めません`);
  }

  return { root, jobs };
}

/**
 * `jobs:` のキーを job の ID として読む。
 *
 * @param key - `jobs:` のマッピングが持つ 1 組のキー側ノード
 * @throws キーが文字列として読めないとき
 */
export function readJobId(file: string, key: unknown): string {
  if (!isScalar(key) || typeof key.value !== "string") {
    throw new Error(`${file}: ジョブ名が文字列として読めません`);
  }
  return key.value;
}
