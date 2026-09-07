import ts from "typescript";

/**
 * 1:1 テスト対応原則を機械判定する。
 *
 * @remarks
 * 原則は「呼べる export はすべて、自分の名前の最上位 `describe` を 1 つだけ持つ」。`describe` が
 * 主語で `it` が述語という JS/TS の一般的な構成に、export との 1 対 1 を機械判定として足したもの。
 *
 * `describe` の内側をどう束ねるかは判定しない。観点はコメント区切りで束ね、入れ子の `describe`
 * は共有 setup を持つ文脈にだけ置くという規約はあるが、束ね方はテストの中身しだいで妥当な形が
 * 変わり、名前を固定すると実態と合わないグループを置くだけの作業になる。ここが見るのは
 * 「どの export の契約がどこに在るか」だけ。
 *
 * このモジュールは fs も `ts.Program` も持たない。走査と型解決はゲート側が担い、ここは
 * 「読み取り済みの構文木と、呼べるかどうかの判定」から違反を導くところだけを持つ。
 */

/** export 1 件。 */
export type ExportedSymbol = {
  readonly name: string;
  readonly line: number;
  /**
   * 専用の describe を要求する対象か。
   *
   * @remarks
   * 呼べる値(関数・クラス・React コンポーネント・`cva()` の戻り値など)だけが true になります。
   * 定数や zod スキーマは false で、describe を要求されません。ただし describe を書くこと自体は
   * 許されます(production シンボルに対応しない契約テストは 1:1 違反ではない、という規約に従う)。
   */
  readonly testable: boolean;
};

/** テストファイル中の最上位 describe 1 件。 */
export type DescribeNode = {
  readonly name: string;
  readonly line: number;
};

type ViolationKind =
  /** export に対応する describe が無い。 */
  | "missing-describe"
  /** テストファイルそのものが無い。 */
  | "missing-test-file"
  /** 同じ export に describe が 2 つ以上ある。 */
  | "duplicate-describe"
  /** 最上位 describe の名前がどの export とも対応しない(束ね describe を含む)。 */
  | "unknown-describe"
  /** テストファイルに対応する production ファイルが無く、宣言もされていない。 */
  | "orphan-test-file";

export type Violation = {
  readonly kind: ViolationKind;
  readonly file: string;
  readonly line: number;
  readonly message: string;
};

/** 1 ファイル分の検査入力。 */
export type FileInput = {
  /** 検査対象の production ファイル(リポジトリ相対)。 */
  readonly file: string;
  /** 対応するテストファイル(リポジトリ相対)。存在しなければ null。 */
  readonly testFile: string | null;
  readonly exports: readonly ExportedSymbol[];
  /** テストファイルの最上位 describe 一覧。入れ子は見ない。 */
  readonly describes: readonly DescribeNode[];
};

/** ノードの開始行(1 始まり)を返す。 */
function lineOf(source: ts.SourceFile, node: ts.Node): number {
  return source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
}

/** `describe` の第 1 引数がリテラル文字列なら取り出す。 */
function literalTitle(node: ts.CallExpression): string | null {
  const [first] = node.arguments;

  if (first === undefined) {
    return null;
  }

  return ts.isStringLiteralLike(first) ? first.text : null;
}

/** 呼び出しが `describe(...)` / `describe.only(...)` などであれば true。 */
function isDescribeCall(node: ts.CallExpression): boolean {
  const callee = node.expression;

  if (ts.isIdentifier(callee)) {
    return callee.text === "describe";
  }

  return (
    ts.isPropertyAccessExpression(callee) &&
    ts.isIdentifier(callee.expression) &&
    callee.expression.text === "describe"
  );
}

/**
 * テストファイルの最上位 describe を読む。
 *
 * @remarks
 * 型は見ない。`describe` は import 名で判別できる呼び出しであり、構文だけで拾える。
 * 入れ子へは降りない。内側の束ね方は判定対象ではなく、降りると内側の観点名を
 * 「export に対応しない describe」として誤って咎める。
 */
export function collectTopLevelDescribes(sourceText: string, fileName: string): DescribeNode[] {
  const source = ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.Latest, true);
  const found: DescribeNode[] = [];

  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && isDescribeCall(node)) {
      const title = literalTitle(node);

      if (title !== null) {
        found.push({ name: title, line: lineOf(source, node) });

        return;
      }
    }

    ts.forEachChild(node, visit);
  };

  ts.forEachChild(source, visit);

  return found;
}

/**
 * テスト対象になりうる export を読む。
 *
 * @remarks
 * `isCallable` に「その名前が呼べる値か」を渡す。呼べないもの(定数・配列・zod スキーマ)は
 * 対象外にします。呼べるかどうかは構文では決まらない(`cva(...)` は関数を返し `z.object(...)` は
 * 返さない)ため、判定は型を持つ側へ委ねます。
 */
export function collectTestableExports(
  sourceText: string,
  fileName: string,
  isCallable: (name: string) => boolean,
): ExportedSymbol[] {
  const source = ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.Latest, true);
  const found: ExportedSymbol[] = [];

  const add = (name: string, node: ts.Node, exportedAs: string = name): void => {
    found.push({ name, line: lineOf(source, node), testable: isCallable(exportedAs) });
  };

  const hasModifier = (node: ts.Node, kind: ts.SyntaxKind): boolean =>
    ts.canHaveModifiers(node) && (ts.getModifiers(node) ?? []).some((m) => m.kind === kind);

  const exported = (node: ts.Node): boolean => hasModifier(node, ts.SyntaxKind.ExportKeyword);

  // `export default function X` は module の export 名が `default` になる。呼べるかの判定は
  // その名前で引き、describe に要求するのは宣言名の `X` 側。両者を分けないと Next.js の
  // `layout.tsx` / `error.tsx` のような default export がまるごと検査から外れる。
  const exportedName = (node: ts.Node, declaredName: string): string =>
    hasModifier(node, ts.SyntaxKind.DefaultKeyword) ? "default" : declaredName;

  ts.forEachChild(source, (node) => {
    if (ts.isFunctionDeclaration(node) && exported(node) && node.name !== undefined) {
      add(node.name.text, node, exportedName(node, node.name.text));

      return;
    }

    if (ts.isClassDeclaration(node) && exported(node) && node.name !== undefined) {
      add(node.name.text, node, exportedName(node, node.name.text));

      return;
    }

    if (ts.isVariableStatement(node) && exported(node)) {
      for (const decl of node.declarationList.declarations) {
        if (ts.isIdentifier(decl.name)) {
          add(decl.name.text, decl);
        }
      }

      return;
    }

    // `export default Foo`。宣言側に export 修飾子が付かないため上の分岐に掛からない。
    // 公開名は `default` で、describe に要求するのは参照している識別子の側。arrow function を
    // default export する形はこれしか書けないので、拾わないとその component がまるごと外れる。
    // `export = Foo`(TS 独自の legacy 形)は default export ではないため対象外。
    if (ts.isExportAssignment(node) && node.isExportEquals !== true) {
      if (ts.isIdentifier(node.expression)) {
        const name = node.expression.text;

        // 同じ名前が `export const Foo` としても出ている場合は二重に数えない。
        if (!found.some((symbol) => symbol.name === name)) {
          add(name, node, "default");
        }
      }

      return;
    }

    // `export { A, B as C }`。宣言に export 修飾子を付けず末尾でまとめて出す形は珍しくなく、
    // 見落とすと 1 ファイル分の export がまるごと検査から外れる。公開される名前は別名の側。
    if (ts.isExportDeclaration(node) && node.exportClause !== undefined) {
      const clause = node.exportClause;

      if (ts.isNamedExports(clause)) {
        for (const element of clause.elements) {
          if (!element.isTypeOnly && !node.isTypeOnly) {
            add(element.name.text, element);
          }
        }
      }
    }
  });

  return found;
}

/**
 * どの export にも対応しない最上位 describe を挙げる。
 *
 * @remarks
 * describe を「要求する」のは呼べる export だけですが、「許す」のは export 全体です。
 * 定数の契約テストは production の関数に対応しませんが、退行を単独で捕まえるので違反ではない。
 */
function unknownDescribes(input: FileInput, testFile: string): Violation[] {
  const exportNames = new Set(input.exports.map((s) => s.name));

  return input.describes
    .filter((node) => !exportNames.has(node.name))
    .map((node) => ({
      kind: "unknown-describe" as const,
      file: testFile,
      line: node.line,
      message: `describe("${node.name}") はどの export にも対応しません。最上位の describe は export 名にし、観点ごとの束ねは \`// ----- 正常系 -----\` のコメント区切りで行ってください`,
    }));
}

/**
 * ソースに対応するテストファイルの位置を決める。見つからなければ `null` を返す。
 *
 * @remarks
 * 拡張子はソースに合わせるが、`.ts` のモジュールは `.test.tsx` も受け付ける。hook は本体に JSX を
 * 持たないまま、検証には React のツリーが必要になる。テストの拡張子はハーネス側の性質であって
 * subject の性質ではないため、どちらかへ寄せると本体か検証のどちらかが歪む。
 *
 * 逆向きは受け付けません。`.tsx` の subject を JSX 無しで描画する手段はありません。
 */
export function resolveTestFile(
  sourcePath: string,
  exists: (path: string) => boolean,
): string | null {
  const candidates = sourcePath.endsWith(".tsx")
    ? [sourcePath.replace(/\.tsx$/, ".test.tsx")]
    : [sourcePath.replace(/\.ts$/, ".test.ts"), sourcePath.replace(/\.ts$/, ".test.tsx")];

  return candidates.find((candidate) => exists(candidate)) ?? null;
}

/**
 * テストファイルに対応するソースの位置を決める。見つからなければ `null` を返す。
 *
 * @remarks
 * {@link resolveTestFile} の逆向きです。`.test.tsx` は `.ts` のモジュールにも対応しうるため
 * (hook は本体に JSX を持たないまま、検証には React のツリーが要る)、候補が 1 つに定まりません。
 */
export function resolveSourceFile(
  testPath: string,
  exists: (path: string) => boolean,
): string | null {
  const candidates = testPath.endsWith(".test.tsx")
    ? [testPath.replace(/\.test\.tsx$/, ".tsx"), testPath.replace(/\.test\.tsx$/, ".ts")]
    : [testPath.replace(/\.test\.ts$/, ".ts")];

  return candidates.find((candidate) => exists(candidate)) ?? null;
}

/**
 * 主語を持たないテストファイルを違反として挙げる。
 *
 * @remarks
 * **ゲートはソース側から歩きます。**対応する production ファイルが無いテストファイルには
 * 入口が無く、`unknown-describe` の検査へ一度も掛かりません。別モジュールの export をまとめて
 * 1 つの describe へ束ねたテストがそこに置かれると、CI はそれを赤にできないまま黙ります。
 *
 * 主語を持たないテスト自体は在ってよいものです(契約から生成したハンドラを相手にする検査、
 * 開発機構そのもののゲート)。**在ってよいことと、黙って在れることは違う**ので、宣言を求めます。
 *
 * @param file - リポジトリ相対のテストファイル
 * @param sourceFile - 対応する production ファイル。無ければ null
 * @param declared - 主語を持たないテストとして宣言済みか
 */
export function checkTestFile(
  file: string,
  sourceFile: string | null,
  declared: boolean,
): Violation[] {
  if (sourceFile !== null || declared) {
    return [];
  }

  return [
    {
      kind: "orphan-test-file",
      file,
      line: 1,
      message: `対応する production ファイルがありません。テストは subject の隣に置き、最上位 describe はその export 名にしてください。主語を持たないテストは scripts/lib/untested-modules.ts の SUBJECTLESS_TESTS へ理由付きで宣言してください`,
    },
  ];
}

/**
 * 1 ファイル分の 1:1 対応を検査する。
 *
 * @remarks
 * 「export に describe が無い」と「describe に対応する export が無い」の両方向を見る。
 * 片方向だけだと、export を消してテストだけ残った状態や、テストを別名へ改名した状態が
 * 検査をすり抜ける。
 */
export function checkFile(input: FileInput): Violation[] {
  const required = input.exports.filter((s) => s.testable);

  if (required.length === 0) {
    // 呼べる export が無いファイルは describe を要求されないが、テストが在るなら
    // 「どの export にも対応しない最上位 describe」の検査だけは掛ける。ここで抜けると
    // 定数だけを export するモジュールのテストが束ね describe を置き放題になる。
    //
    // ただし export が 1 つも無いモジュール(副作用だけを持つ起動用の入口など)は対応先が
    // 存在しないので対象外。そこでの subject はモジュール自身であり、describe 名は
    // モジュール名を採る。
    return input.testFile === null || input.exports.length === 0
      ? []
      : unknownDescribes(input, input.testFile);
  }

  if (input.testFile === null) {
    return required.map((symbol) => ({
      kind: "missing-test-file" as const,
      file: input.file,
      line: symbol.line,
      message: `${symbol.name} に対応するテストファイルがありません`,
    }));
  }

  const testFile = input.testFile;
  const violations: Violation[] = [];
  const byName = new Map<string, DescribeNode[]>();

  for (const node of input.describes) {
    byName.set(node.name, [...(byName.get(node.name) ?? []), node]);
  }

  violations.push(...unknownDescribes(input, testFile));

  for (const symbol of required) {
    const nodes = byName.get(symbol.name) ?? [];
    const [first, second] = nodes;

    if (first === undefined) {
      violations.push({
        kind: "missing-describe",
        file: input.file,
        line: symbol.line,
        message: `${symbol.name} に対応する describe("${symbol.name}") が ${testFile} にありません`,
      });

      continue;
    }

    if (second !== undefined) {
      violations.push({
        kind: "duplicate-describe",
        file: testFile,
        line: second.line,
        message: `describe("${symbol.name}") が ${nodes.length} つあります。1 つにまとめてください`,
      });
    }
  }

  return violations;
}

/** 違反一覧を、失敗メッセージとして読める 1 つの文字列へ整形する。 */
export function formatViolations(violations: readonly Violation[]): string {
  return violations
    .map((v) => `${v.file}:${v.line}: [${v.kind}] ${v.message}`)
    .sort((a, b) => (a < b ? -1 : 1))
    .join("\n");
}
