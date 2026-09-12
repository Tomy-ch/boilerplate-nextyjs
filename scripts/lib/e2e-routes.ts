// E2E の spec が指す経路と、実在する route を突き合わせる判定。走査と宣言は
// [`../e2e-routes.gate.test.ts`](../e2e-routes.gate.test.ts) が持ち、なぜこの検査が要るかは
// [`e2e/README.md`](../../e2e/README.md)「spec が指す経路は、実在する route でなければならない」。
//
// ソースから文字列リテラルを拾う字句走査は [`string-literals.ts`](string-literals.ts) が持つ。
// あちらが追うのは TypeScript の綴り方で、ここが追うのは App Router の route 規約である。
import { listStringLiterals } from "./string-literals.js";

/** route を持つ特殊ファイルと、名前だけで決まる配信経路。空文字はディレクトリから決まる側。 */
const ROUTE_FILES: ReadonlyMap<string, string> = new Map([
  ["page.tsx", ""],
  // 開発と CI の build にだけ含まれる route segment（`next.config.ts` の `pageExtensions`）。
  ["page.dev.tsx", ""],
  ["route.ts", ""],
  ["route.dev.ts", ""],
  ["robots.ts", "/robots.txt"],
  ["sitemap.ts", "/sitemap.xml"],
  ["icon.tsx", "/icon"],
  ["apple-icon.tsx", "/apple-icon"],
  ["opengraph-image.tsx", "/opengraph-image"],
]);

/** route segment の置き場。 */
export const APP_DIR = "src/app";

/** 正規表現の中でリテラルとして扱うための逃がし。 */
function escapeForRegExp(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}

/**
 * spec のソースから、経路の形をしたリテラルを拾う。
 *
 * @remarks
 * 拾うのは `/` で始まるものだけです。それ以外の文字列リテラル（URL・選択子・見出しの文言）は
 * 経路ではありません。
 *
 * @param source - spec 1 本のソース
 * @returns `/` で始まるリテラルの中身。クエリとフラグメントは付いたまま
 */
export function listRouteLiterals(source: string): string[] {
  return listStringLiterals(source).filter((value) => value.startsWith("/"));
}

/**
 * `src/app` 配下のファイルを、配信される route へ写す。
 *
 * @remarks
 * route group（`(name)`）は URL に現れないので落とします。並列ルート（`@slot`）は自分の URL を
 * 持たないので、その配下ごと対象外です。
 *
 * @param relativePath - リポジトリルート相対のパス（`/` 区切り）
 * @returns route。route を作らないファイルは `null`
 */
export function toAppRoute(relativePath: string): string | null {
  if (!relativePath.startsWith(`${APP_DIR}/`)) {
    return null;
  }

  const withinApp = relativePath.slice(APP_DIR.length + 1);
  const lastSeparator = withinApp.lastIndexOf("/");
  const segments = lastSeparator === -1 ? [] : withinApp.slice(0, lastSeparator).split("/");
  const fixedPath = ROUTE_FILES.get(withinApp.slice(lastSeparator + 1));

  if (fixedPath === undefined || segments.some((segment) => segment.startsWith("@"))) {
    return null;
  }

  if (fixedPath !== "") {
    return fixedPath;
  }

  const joined = segments.filter((segment) => !segment.startsWith("(")).join("/");

  return joined === "" ? "/" : `/${joined}`;
}

/** route 1 つを、経路に当てる正規表現へ組み立てる。動的区間は中身を問わない。 */
export function toRoutePattern(route: string): RegExp {
  const body = route
    .split("/")
    .filter((segment) => segment !== "")
    .map((segment) => {
      if (segment.startsWith("[[...") && segment.endsWith("]]")) {
        return "(?:/[^/]+)*";
      }

      if (segment.startsWith("[...") && segment.endsWith("]")) {
        return "(?:/[^/]+)+";
      }

      if (segment.startsWith("[") && segment.endsWith("]")) {
        return "/[^/]+";
      }

      return `/${escapeForRegExp(segment)}`;
    })
    .join("");

  return new RegExp(`^${body === "" ? "/" : body}$`);
}

/**
 * リテラルを、route と突き合わせられる経路へ整える。
 *
 * @remarks
 * クエリとフラグメントは route を決めないので落とします。末尾の区切りも同じで、`/reports/` と
 * `/reports` は同じ画面です。
 */
export function toRoutePath(literal: string): string {
  const cut = literal.search(/[?#]/);
  const withoutQuery = cut === -1 ? literal : literal.slice(0, cut);
  // 区切りの繰り返しを正規表現で剥がすと、末尾に固定した反復が後戻りを起こす。端から数える。
  let end = withoutQuery.length;

  while (end > 0 && withoutQuery[end - 1] === "/") {
    end -= 1;
  }

  return end === 0 ? "/" : withoutQuery.slice(0, end);
}

/** 経路が、実在する route のどれかに当たるか。 */
function isServed(routePath: string, routes: readonly string[]): boolean {
  return routes.some((route) => toRoutePattern(route).test(routePath));
}

/**
 * spec が指す経路のうち、実在せず、実在しない理由も宣言されていないものを洗い出す。
 *
 * @param literals - spec から拾った経路のリテラル
 * @param routes - `src/app` から採った実在する route
 * @param absentByDesign - 実在しないことが意図である経路の宣言
 */
export function findUnknownRoutes(
  literals: readonly string[],
  routes: readonly string[],
  absentByDesign: readonly string[],
): string[] {
  const unknown = literals
    .map(toRoutePath)
    .filter((routePath) => !absentByDesign.includes(routePath) && !isServed(routePath, routes));

  return [...new Set(unknown)].map(
    (routePath) => `指す先が実在しません: ${routePath}（画面を消したか、綴りが違う）`,
  );
}

/**
 * 実体を失った「実在しない」宣言を洗い出す。
 *
 * @remarks
 * 2 方向を見ます。**どの spec も指していない**宣言は、指していた spec が消えた跡です。
 * **実在するようになった**宣言は、その経路に画面が置かれた跡で、放っておくと以後その経路が
 * 検査を素通りします。宣言が実体を失ったまま居座らないのは、画面の宣言
 * （`e2e/lib/screens.ts`）と同じ規律です。
 *
 * @param literals - spec から拾った経路のリテラル
 * @param routes - `src/app` から採った実在する route
 * @param absentByDesign - 実在しないことが意図である経路の宣言
 */
export function findStaleAbsentDeclarations(
  literals: readonly string[],
  routes: readonly string[],
  absentByDesign: readonly string[],
): string[] {
  const referenced = new Set(literals.map(toRoutePath));

  return absentByDesign.flatMap((routePath) => {
    if (isServed(routePath, routes)) {
      return [`実在しないと宣言した経路に画面があります: ${routePath}`];
    }

    return referenced.has(routePath) ? [] : [`どの spec も指していない宣言です: ${routePath}`];
  });
}
