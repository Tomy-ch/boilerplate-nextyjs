import { existsSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

import {
  checkFile,
  checkTestFile,
  collectTestableExports,
  collectTopLevelDescribes,
  formatViolations,
  resolveSourceFile,
  resolveTestFile,
  type Violation,
} from "./lib/one-to-one";
import { EXCLUDED_FROM_CHECKS, SUBJECTLESS_TESTS } from "./lib/untested-modules";

/**
 * リポジトリ全体の 1:1 テスト対応ゲート。
 *
 * @remarks
 * 検査の中身は `lib/one-to-one.ts` が持ち、ここはツリーの走査と型解決だけを担う。
 * ゲートを `scripts/` へ置くのは、これがアプリの振る舞いではなく開発機構の検査だから。
 *
 * 走査は production ファイルとテストファイルの**両側**から行う。ソース側から歩くだけだと、
 * 対応するソースを持たないテストファイルに入口が無く、そこに置かれたものは一度も検査に
 * 掛からない。
 */

const REPOSITORY_ROOT = resolve(import.meta.dirname, "..");

/**
 * 走査する範囲(リポジトリルート相対)。
 *
 * @remarks
 * ここに並ばないディレクトリは丸ごと無検査になります。範囲を足したら、除外したいものは
 * `lib/untested-modules.ts` へ理由付きで宣言してください。走査範囲を狭めて回避すると、
 * 外した記録がどこにも残りません。
 */
const SCAN_ROOTS = [
  "src",
  "scripts",
  "tokens",
  "mocks",
  "docs-viewer/src",
  "eslint-rules",
  "baseline/lib",
  "vrt",
  "e2e",
  ".storybook",
] as const;

/** 除外宣言を、リポジトリ相対パスに当てる正規表現へ変える。 */
function toMatcher(pattern: string): RegExp {
  // `**/` は区切りを跨ぐため、そこで分割してから、残る `*` を 1 階層分の任意文字へ変える。
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .split("**/")
    .map((part) => part.replace(/\*/g, "[^/]*"))
    .join("(?:.*/)?");

  return new RegExp(`^${escaped}$`);
}

/** 宣言のいずれかに当たるか。末尾が `/**` の宣言はディレクトリ接頭辞として扱う。 */
function matchesAny(relativePath: string, patterns: readonly string[]): boolean {
  return patterns.some((pattern) =>
    pattern.endsWith("/**")
      ? relativePath.startsWith(pattern.slice(0, -2))
      : toMatcher(pattern).test(relativePath),
  );
}

/** module symbol の各 export が「呼べる値」かを型から判定する述語を作る。 */
function callablePredicate(
  checker: ts.TypeChecker,
  source: ts.SourceFile,
): (name: string) => boolean {
  const moduleSymbol = checker.getSymbolAtLocation(source);
  const exports = moduleSymbol === undefined ? [] : checker.getExportsOfModule(moduleSymbol);
  const byName = new Map(exports.map((symbol) => [symbol.getName(), symbol]));

  return (name) => {
    const symbol = byName.get(name);
    const declaration = symbol?.valueDeclaration ?? symbol?.declarations?.[0];

    if (symbol === undefined || declaration === undefined) {
      return false;
    }

    const type = checker.getTypeOfSymbolAtLocation(symbol, declaration);

    return type.getCallSignatures().length > 0 || type.getConstructSignatures().length > 0;
  };
}

function createProgram(): ts.Program {
  const configPath = ts.findConfigFile(REPOSITORY_ROOT, ts.sys.fileExists, "tsconfig.json");

  if (configPath === undefined) {
    throw new Error(`${REPOSITORY_ROOT}/tsconfig.json が見つかりません`);
  }

  const parsed = ts.parseJsonConfigFileContent(
    ts.readConfigFile(configPath, ts.sys.readFile).config,
    ts.sys,
    REPOSITORY_ROOT,
  );

  return ts.createProgram(parsed.fileNames, parsed.options);
}

/** 走査結果。 */
type Scan = {
  violations: Violation[];
  /**
   * 型を解決できなかった import。
   *
   * @remarks
   * 「呼べる値か」は型で決まるため、依存が解決できないと `any` になり、呼べる export が
   * 呼べないものとして扱われます。ゲートは違反ゼロを報告したまま黙るので、別に検出します。
   */
  unresolved: string[];
  /** 検査した production ファイル数。0 なら走査が的を外している。 */
  checkedFiles: number;
};

function scanRepository(): Scan {
  const program = createProgram();
  const checker = program.getTypeChecker();
  const scan: Scan = { violations: [], unresolved: [], checkedFiles: 0 };

  for (const source of program.getSourceFiles()) {
    const absolute = source.fileName;

    if (source.isDeclarationFile || absolute.includes("node_modules")) {
      continue;
    }

    const inRepository = relative(REPOSITORY_ROOT, absolute);

    if (!SCAN_ROOTS.some((root) => inRepository.startsWith(`${root}/`))) {
      continue;
    }
    if (matchesAny(inRepository, EXCLUDED_FROM_CHECKS)) {
      continue;
    }

    // ソース側からは辿れないテスト。宣言されているかどうかをここで見る。
    if (/\.test\.tsx?$/.test(inRepository)) {
      const sourcePath = resolveSourceFile(absolute, existsSync);

      scan.violations.push(
        ...checkTestFile(
          inRepository,
          sourcePath === null ? null : relative(REPOSITORY_ROOT, sourcePath),
          matchesAny(inRepository, SUBJECTLESS_TESTS),
        ),
      );

      continue;
    }

    if (/\.stories\.tsx?$/.test(inRepository)) {
      continue;
    }

    for (const diagnostic of program.getSemanticDiagnostics(source)) {
      // TS2307: モジュールを解決できない。依存未導入で型が any へ落ちる唯一の入口。
      if (diagnostic.code === 2307) {
        scan.unresolved.push(
          `${inRepository}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, " ")}`,
        );
      }
    }

    const testPath = resolveTestFile(absolute, existsSync);

    scan.checkedFiles += 1;
    scan.violations.push(
      ...checkFile({
        file: inRepository,
        testFile: testPath === null ? null : relative(REPOSITORY_ROOT, testPath),
        exports: collectTestableExports(
          source.getFullText(),
          absolute,
          callablePredicate(checker, source),
        ),
        describes:
          testPath === null
            ? []
            : collectTopLevelDescribes(readFileSync(testPath, "utf8"), testPath),
      }),
    );
  }

  return scan;
}

// リポジトリ全体の TypeScript プログラムを構築して型検査まで走らせるため、既定の 5 秒では足りない。
const TIMEOUT_MS = 300_000;

describe("1:1 テスト対応", () => {
  // ----- 正常系 -----
  it(
    "テストは production ファイルと 1:1 で対応し、呼べる export はすべて自分の名前の最上位 describe を 1 つだけ持つ",
    () => {
      const scan = scanRepository();

      // 違反より先に `unresolved` を主張して、ゲートが黙った状態を緑にしない。
      expect(scan.unresolved.join("\n")).toBe("");
      expect(scan.checkedFiles).toBeGreaterThan(0);
      expect(formatViolations(scan.violations)).toBe("");
    },
    TIMEOUT_MS,
  );
});
