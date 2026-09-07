/**
 * テストが負う層別責務の解決。
 *
 * @remarks
 * どの層の責務を負うかは、テストから遡って最も近い `README.md` の frontmatter が宣言する。
 * ここが持つのはその解決規則だけで、ツリーの走査は
 * `scripts/test-requirement.gate.test.ts` が担う。
 */

import { APP_ELEMENTS, ENTRY_POINTS } from "../../architecture";

import { parseFrontmatter } from "./frontmatter";
import { toPathPattern } from "./path-pattern";

/**
 * 宣言できる層。
 *
 * @remarks
 * 層別責務表と揃える。`visual` を含めないのは、対象が実装モジュールではなく story であり、
 * 宣言を持たないため。
 */
const TEST_LAYERS = ["unit", "component", "feature", "route", "integration", "e2e"] as const;

/** 宣言できる層。 */
type TestLayer = (typeof TEST_LAYERS)[number];

/**
 * README を持たないまま宣言を負う入口（`architecture.ts` の `ENTRY_POINTS`）。
 *
 * @remarks
 * 入口はカーネルの外に居るため層 README を持たず、宣言できるのは依存マトリクスだけです。
 * **ここで写しを持たないのは、宣言が 2 か所になると片方だけ動いた状態を誰も検出できないため**です。
 *
 * 入口の `pattern` は拡張子を持たない（`src/proxy*`）ので実装とテストの両方に当たりますが、
 * ここへ来るのはテストファイルだけなのでそのまま照合します。
 *
 * **層として読めない宣言は落とします。** `feature-story` が負う `none` は「テストを課さない」
 * 宣言であって層ではなく、story はそもそもこの解決を通りません。
 */
const ENTRY_DECLARATIONS: readonly { readonly matches: RegExp; readonly layer: TestLayer }[] =
  ENTRY_POINTS.flatMap(({ pattern, testRequirement }) =>
    isTestLayer(testRequirement)
      ? [{ matches: toPathPattern(pattern), layer: testRequirement }]
      : [],
  );

/** 入口宣言の出所。README ではなく依存マトリクスが持つため、報告にはこの経路を出す。 */
const ENTRY_DECLARATION_SOURCE = "architecture.ts";

/**
 * ファイル名が役割を決める element の宣言。
 *
 * @remarks
 * 対象のテストは、element のパターンの拡張子の手前へ `.test` を挿した位置に居ます。glob の
 * 解釈は [path-pattern](path-pattern.ts) が持ちます。
 */
const ELEMENT_DECLARATIONS: readonly { readonly matches: RegExp; readonly layer: TestLayer }[] =
  APP_ELEMENTS.flatMap(({ patterns, testRequirement }) =>
    patterns.map((pattern) => ({
      matches: toPathPattern(pattern.replace(/\.(tsx?)$/, ".test.$1")),
      layer: testRequirement,
    })),
  );

/** element の宣言の出所。README ではなく依存マトリクスが持つため、報告にはこの経路を出す。 */
const ELEMENT_DECLARATION_SOURCE = "architecture.ts";

/** frontmatter で層を宣言するキー。 */
const DECLARATION_KEY = "test-requirement";

function isTestLayer(value: unknown): value is TestLayer {
  return TEST_LAYERS.some((layer) => layer === value);
}

/**
 * README の frontmatter が宣言する層を読む。
 *
 * @remarks
 * 1 つのディレクトリが複数の層を抱えるときは並びで宣言する。負う責務が割れているのに 1 つしか
 * 書けないと、書かなかった側の観点を誰も負わなくなる。
 *
 * @returns 宣言が無ければ null。宣言があっても層として読めなければ空の並び
 */
function parseTestRequirement(source: string, origin: string): readonly TestLayer[] | null {
  const frontmatter = parseFrontmatter(source, origin);

  if (frontmatter === null || !(DECLARATION_KEY in frontmatter)) {
    return null;
  }

  const declared = frontmatter[DECLARATION_KEY];

  return (Array.isArray(declared) ? declared : [declared]).filter(isTestLayer);
}

/** ディレクトリ(リポジトリルート相対)の README を読む。無ければ null。 */
export type ReadmeReader = (directory: string) => string | null;

/** 宣言が見つかった場所と、そこが宣言している層。 */
export type ResolvedTestRequirement = {
  /** 宣言を持つ文書(リポジトリルート相対)。 */
  readonly declaredIn: string;
  /** 宣言された層。宣言はあるが層として読めなければ空。 */
  readonly layers: readonly TestLayer[];
};

/**
 * テストファイルを支配する宣言を解決する。
 *
 * @remarks
 * 3 段で答える。{@link ENTRY_DECLARATIONS} に載る入口が最優先、次にファイル名が element を
 * 決めるものを {@link ELEMENT_DECLARATIONS}、それ以外は遡って**最初に宣言を持つ** README。
 * 宣言を持たない README は素通しする。README が在ることと責務を宣言していることは別で、
 * 素通ししないと途中の 1 枚が上位の宣言を遮る。
 *
 * @param testFile - テストファイル(リポジトリルート相対、区切りは `/`)
 * @param readReadme - ディレクトリの README を読む
 * @returns 宣言が見つからなければ null
 */
export function resolveTestRequirement(
  testFile: string,
  readReadme: ReadmeReader,
): ResolvedTestRequirement | null {
  const entry = ENTRY_DECLARATIONS.find(({ matches }) => matches.test(testFile));

  if (entry !== undefined) {
    return { declaredIn: ENTRY_DECLARATION_SOURCE, layers: [entry.layer] };
  }

  const element = ELEMENT_DECLARATIONS.find(({ matches }) => matches.test(testFile));

  if (element !== undefined) {
    return { declaredIn: ELEMENT_DECLARATION_SOURCE, layers: [element.layer] };
  }

  const segments = testFile.split("/").slice(0, -1);

  for (let depth = segments.length; depth >= 0; depth -= 1) {
    const directory = segments.slice(0, depth).join("/");
    const source = readReadme(directory);

    if (source === null) {
      continue;
    }

    const declaredIn = directory === "" ? "README.md" : `${directory}/README.md`;
    const layers = parseTestRequirement(source, declaredIn);

    if (layers !== null) {
      return { declaredIn, layers };
    }
  }

  return null;
}

/**
 * 宣言を引けなかったテストを、置かれているディレクトリごとにまとめる。
 *
 * @remarks
 * 宣言が**空**のものも引けなかった側へ入れる。`test-requirement` の行はあるが層として読めない
 * 状態で、宣言したつもりで何も宣言できていない。素通しすると、書いた側だけが宣言済みだと思う。
 *
 * @param testFiles - テストファイル(リポジトリルート相対、区切りは `/`)
 * @param readReadme - ディレクトリの README を読む
 * @returns 宣言を引けなかったディレクトリ。重複を畳み、名前順に並ぶ
 */
export function findUndeclaredDirectories(
  testFiles: readonly string[],
  readReadme: ReadmeReader,
): string[] {
  const undeclared = new Set<string>();

  for (const file of testFiles) {
    const resolved = resolveTestRequirement(file, readReadme);

    if (resolved === null || resolved.layers.length === 0) {
      undeclared.add(file.split("/").slice(0, -1).join("/"));
    }
  }

  return [...undeclared].sort();
}
