// route と仕様書の対応の判定。ファイルの走査はゲート([../spec-routes.gate.test.ts](../spec-routes.gate.test.ts))が
// 持ち、ここは受け取ったパスの一覧だけから答えを出す。
//
// 写像の規約は [`docs/spec/README.md`](../../docs/spec/README.md) が持ち、検査の輪郭は
// [0143](../../docs/adr/0143-spec-driven-development.md)「存在の突合」が持つ。

/** 仕様書の置き場（リポジトリ相対）。 */
export const SPEC_ROOT = "docs/spec/route";

/**
 * 母数になる app の入口。
 *
 * @remarks
 * [0143](../../docs/adr/0143-spec-driven-development.md) の母数。**開発専用の route も約束を持ちます** ——
 * `page.dev.tsx` は build から外れますが（[0113](../../docs/adr/0113-development-access-surface.md)）、
 * build から外れることと、約束を持たないことは別です。
 */
const ROUTE_ENTRIES: readonly string[] = ["page.tsx", "page.dev.tsx", "layout.tsx"];

/** `src/app` の接頭辞。 */
const APP_PREFIX = "src/app/";

/**
 * route が 1 件も挙がらなかったときに出す行。
 *
 * @remarks
 * 母数が 0 件になるのは、走査の対象が動いたか接頭辞が変わったときです。そのまま「違反なし」を
 * 返すと、**検査が成立していないこと**と**違反が無いこと**が同じ緑になります
 * ([0157](../../docs/adr/0157-inspection-declaration-discipline.md))。
 */
export const NO_ROUTES_MESSAGE =
  "src/app に page / layout の入口が 1 件もありません。走査の対象が動いた可能性があります";

/**
 * `src/app` 配下のパスを、対応する仕様書のディレクトリへ写す。入口でなければ null。
 *
 * @remarks
 * route group は URL に現れないので括弧を外し、動的セグメントは URL に現れるので角括弧を保ちます
 * ([`docs/spec/README.md`](../../docs/spec/README.md))。ここが写像の唯一の実装で、ゲートも
 * `verify-spec` もこの関数の答えを使います —— 写像が 2 つあると、片方だけが規約に追随します。
 *
 * @param appPath - リポジトリ相対のパス（例: `src/app/(shop)/products/[id]/page.tsx`）
 * @returns 仕様書のディレクトリ（例: `docs/spec/route/shop/products/[id]`）。入口でなければ null
 */
export function toSpecDir(appPath: string): string | null {
  if (!appPath.startsWith(APP_PREFIX)) {
    return null;
  }

  const segments = appPath.slice(APP_PREFIX.length).split("/");
  const entry = segments.pop();

  if (entry === undefined || !ROUTE_ENTRIES.includes(entry)) {
    return null;
  }

  const mapped = segments
    .map((segment) =>
      segment.startsWith("(") && segment.endsWith(")") ? segment.slice(1, -1) : segment,
    )
    // 並行ルートのスロット（`@slot`）は URL に現れず、独立した画面でもない。その約束は
    // スロットを差し込む画面の仕様書が持つので、段ごと落として同じ置き場へ写す。
    .filter((segment) => segment !== "" && !segment.startsWith("@"));

  return [SPEC_ROOT, ...mapped].join("/");
}

/**
 * その入口が要求する画面要件のパス。
 *
 * @remarks
 * 機能要件（`*.function.md`）は要求しません。**機能要件を持たない画面には置かない**のが規約で、
 * 空のファイルは「まだ書いていない」と「無い」の区別を消します
 * ([`docs/spec/README.md`](../../docs/spec/README.md))。
 */
export function toScreenSpecPath(appPath: string): string | null {
  const dir = toSpecDir(appPath);

  if (dir === null) {
    return null;
  }

  const base = appPath.endsWith("layout.tsx") ? "layout" : "page";

  return `${dir}/${base}.screen.md`;
}

/**
 * 画面要件を持たない入口を挙げる。
 *
 * @param appPaths - `src/app` 配下の入口候補（リポジトリ相対）
 * @param specPaths - 実在する仕様書のパス（リポジトリ相対）
 * @returns 対応する `*.screen.md` が無い入口のパス
 */
export function findMissingScreenSpecs(
  appPaths: readonly string[],
  specPaths: readonly string[],
): readonly string[] {
  const existing = new Set(specPaths);

  return appPaths.filter((appPath) => {
    const expected = toScreenSpecPath(appPath);

    return expected !== null && !existing.has(expected);
  });
}

/**
 * 対応する route を持たない仕様書を挙げる。
 *
 * @remarks
 * **画面を消して約束だけが残った状態**です。逆向きに見ないと、消えた画面の仕様書が
 * 「まだ在る画面の約束」として読まれ続けます。
 */
export function findOrphanSpecs(
  appPaths: readonly string[],
  specPaths: readonly string[],
): readonly string[] {
  const expected = new Set(
    appPaths.flatMap((appPath) => {
      const dir = toSpecDir(appPath);

      return dir === null ? [] : [dir];
    }),
  );

  return specPaths.filter((specPath) => {
    const dir = specPath.slice(0, specPath.lastIndexOf("/"));

    return !expected.has(dir);
  });
}
