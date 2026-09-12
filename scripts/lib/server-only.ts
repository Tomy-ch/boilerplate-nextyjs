import ts from "typescript";

// server 専用として名乗った module が、client の束へ入ることを止める番人を持っているかの判定。

/** 走査する module 1 件。 */
export type ServerModule = {
  /** リポジトリルート相対のパス。 */
  readonly path: string;
  readonly content: string;
};

/** 番人を欠いた module。 */
export type UnguardedModule = {
  /** 欠けている module。 */
  readonly path: string;
  /** 何を欠いているか。番人が無いのか、import の先頭に無いのか。 */
  readonly reason: "missing" | "not-first";
};

/** server 専用と名乗る綴り。 */
const SERVER_MODULE = /\.server\.tsx?$/;

const GUARD_SPECIFIER = "server-only";

/**
 * その文が引いている先。引いていない文なら null。
 *
 * @remarks
 * **構文木で見ます。**行ごとの綴りで判定すると、複数行にまたがる import はどの行も import に
 * 見えず、番人より前にあっても「前に何も無い」として通ります。逆にコメントの中の import らしき
 * 1 行は import として数えられます。どちらも検査が黙る側・鳴りすぎる側へ倒れる壊れ方です。
 */
function specifierOf(statement: ts.Statement): string | null {
  const specifier =
    ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)
      ? statement.moduleSpecifier
      : undefined;

  // 綴りが壊れている（`from bad;` のような）文は、構文木の上では import だが引き先を持たない。
  // 引き先の無いものを「何かを引いた」と数えると、番人より前に何も無い module が not-first になる。
  return specifier !== undefined && ts.isStringLiteral(specifier) ? specifier.text : null;
}

/** 副作用だけの import か。番人はこの形で引かれる。 */
function isSideEffectImport(statement: ts.Statement): boolean {
  return ts.isImportDeclaration(statement) && statement.importClause === undefined;
}

/**
 * 名乗りに対して番人が居るかを見る。
 *
 * @remarks
 * 綴りの側（`*.server.ts`）だけを見ます。逆向き —— 番人を持つ module がその綴りを名乗っているか
 * —— は検査しません。`adapters/server` は層まるごとが server 専用で、綴りではなく置き場が
 * それを表しているためです。
 *
 * 番人を **import の先頭**に要求します。位置がずれても build は同じく落ちますが、読む側が
 * 「この module は server 専用か」を確かめる場所が module ごとに変わります。
 *
 * @param modules - 走査対象。テストと story は呼び出し側で外しておく。
 */
export function findUnguardedServerModules(modules: readonly ServerModule[]): UnguardedModule[] {
  return modules
    .filter((module) => SERVER_MODULE.test(module.path))
    .flatMap((module) => {
      const reason = guardStateOf(module);

      return reason === null ? [] : [{ path: module.path, reason }];
    });
}

/** 番人の在り方を 1 module ぶん見る。揃っていれば null。 */
function guardStateOf(module: ServerModule): UnguardedModule["reason"] | null {
  const source = ts.createSourceFile(
    module.path,
    module.content,
    ts.ScriptTarget.Latest,
    // 位置は要らない。要るのは文の並びだけで、親を張らないぶん速い。
    false,
    module.path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  let precededByImport = false;

  for (const statement of source.statements) {
    const specifier = specifierOf(statement);

    if (specifier === null) {
      continue;
    }

    if (specifier === GUARD_SPECIFIER && isSideEffectImport(statement)) {
      return precededByImport ? "not-first" : null;
    }

    precededByImport = true;
  }

  return "missing";
}

/** 見つかったものを人が読む形にする。 */
export function formatUnguardedServerModules(found: readonly UnguardedModule[]): string {
  return found
    .map(
      ({ path, reason }) =>
        `${path}: ${
          reason === "missing"
            ? 'import "server-only" がありません'
            : 'import "server-only" が import の先頭にありません'
        }`,
    )
    .sort((a, b) => a.localeCompare(b))
    .join("\n");
}
